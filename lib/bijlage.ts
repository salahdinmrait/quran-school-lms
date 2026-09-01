import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { b2SleutelUitUrl, maakDownloadUrl } from "@/lib/b2";
import { verifyMobileToken, type MobileTokenPayload } from "@/lib/mobile-jwt";
import { prisma } from "@/lib/prisma";

/**
 * Bijlagen ophalen — één plek voor alle download-routes.
 *
 * Ingelogd zijn is niet genoeg. Per type wordt de bijlage opgehaald mét een
 * where-clausule die aan de rol van de aanvrager hangt, zodat een leerling niet
 * de bijlage van een andere klas (of een andere school) kan opvragen door een
 * id te raden. Niet-toegestaan en niet-bestaand geven allebei 404, zodat de
 * route ook niet verklapt dát een id bestaat.
 */

type Bijlage = {
  bijlageNaam: string | null;
  bijlageUrl: string | null;
  bijlageData: string | null;
  bijlageType: string | null;
};

const SELECT = { bijlageNaam: true, bijlageUrl: true, bijlageData: true, bijlageType: true };

/**
 * Alleen URL's uit onze eigen opslag zijn te vertrouwen.
 *
 * `bijlageUrl` komt rechtstreeks uit de body van de client en eindigt in
 * `bijlageAntwoord()` als een redirect. Zonder deze controle kan iedere
 * ingelogde gebruiker een bijlage plaatsen die het slachtoffer doorstuurt naar
 * een eigen server (phishing, en de ?token= uit de link lekt mee via Referer),
 * of een onzin-URL opslaan waar `NextResponse.redirect()` op stukloopt (500).
 *
 * Twee bronnen zijn geldig zolang de overstap loopt: Backblaze B2 (nieuw, en
 * alleen binnen `bijlagen/` — zie `b2SleutelUitUrl()`) en Vercel Blob (oud).
 * Zodra `scripts/migreer-naar-b2.ts` gedraaid heeft, kan de Blob-tak weg.
 */
export function veiligeBijlageUrl(waarde: unknown): string | null {
  if (typeof waarde !== "string") return null;
  const schoon = waarde.trim();
  if (schoon.length === 0 || schoon.length > 1024) return null;

  let u: URL;
  try {
    u = new URL(schoon);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  // Gebruikersnaam/wachtwoord in de URL is een klassieke verhullingstruc.
  if (u.username || u.password) return null;

  if (b2SleutelUitUrl(u)) return u.toString();
  // Vercel Blob serveert vanaf <store>.public.blob.vercel-storage.com
  if (/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i.test(u.hostname)) return u.toString();
  return null;
}

/** Gewone http(s)-link (studiemateriaal). Geen javascript:/data:/file:. */
export function veiligeLink(waarde: unknown): string | null {
  if (typeof waarde !== "string") return null;
  const schoon = waarde.trim();
  if (schoon.length === 0 || schoon.length > 2048) return null;
  try {
    const u = new URL(schoon);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export interface BijlageVelden {
  bijlageNaam: string | null;
  bijlageUrl: string | null;
  bijlageType: string | null;
}

/**
 * Haalt de bijlagevelden uit een verzoekbody en keurt ze.
 *
 * `bijlageData` (base64) wordt niet meer geaccepteerd: bijlagen gaan sinds de
 * overstap naar Vercel Blob via /api/bijlage-upload. Een base64-veld zou de
 * database van Neon (0,5 GB gratis) laten vollopen; bestaande rijen worden nog
 * wel uitgeleverd.
 */
export function leesBijlageVelden(
  body: Record<string, unknown>
): { ok: true; velden: BijlageVelden } | { ok: false; response: NextResponse } {
  const fout = (bericht: string) =>
    ({ ok: false as const, response: NextResponse.json({ error: bericht }, { status: 400 }) });

  if (body.bijlageData !== undefined && body.bijlageData !== null && body.bijlageData !== "") {
    return fout("bijlageData wordt niet meer geaccepteerd; upload via /api/bijlage-upload");
  }

  const ruweUrl = body.bijlageUrl;
  let url: string | null = null;
  if (ruweUrl !== undefined && ruweUrl !== null && ruweUrl !== "") {
    url = veiligeBijlageUrl(ruweUrl);
    if (!url) return fout("Ongeldige bijlage-URL");
  }

  const ruweNaam = body.bijlageNaam;
  let naam: string | null = null;
  if (ruweNaam !== undefined && ruweNaam !== null && ruweNaam !== "") {
    if (typeof ruweNaam !== "string" || ruweNaam.length > 255) {
      return fout("Ongeldige bijlagenaam");
    }
    naam = ruweNaam;
  }

  const ruwType = body.bijlageType;
  let type: string | null = null;
  if (ruwType !== undefined && ruwType !== null && ruwType !== "") {
    if (typeof ruwType !== "string" || ruwType.length > 128) {
      return fout("Ongeldig bijlagetype");
    }
    type = ruwType;
  }

  // Een naam zonder URL levert een bijlage-knop op die nergens heen gaat.
  if (naam && !url) return fout("Bijlage mist een geldige URL");
  if (url && !naam) naam = "bijlage";

  return { ok: true, velden: { bijlageNaam: naam, bijlageUrl: url, bijlageType: type } };
}

export type Gebruiker = MobileTokenPayload;

// Klassen van deze gebruiker, afhankelijk van zijn rol. Levert de filter die
// bij "hoort deze klas bij mij?" hoort.
function klasFilter(user: Gebruiker) {
  switch (user.role) {
    case "DOCENT":
      return { docenten: { some: { docentId: user.id } } };
    case "LEERLING":
      return { leerlingen: { some: { leerlingId: user.id } } };
    case "OUDER":
      return { leerlingen: { some: { leerling: { kindVan: { some: { ouderId: user.id } } } } } };
    default:
      return { schoolId: user.schoolId };
  }
}

// De leerling(en) waarvan deze gebruiker gegevens mag inzien: zichzelf, zijn
// kinderen, of — voor docent/admin — iedereen binnen het eigen bereik.
function leerlingFilter(user: Gebruiker) {
  switch (user.role) {
    case "LEERLING":
      return { leerlingId: user.id };
    case "OUDER":
      return { leerling: { kindVan: { some: { ouderId: user.id } } } };
    case "DOCENT":
      return { leerling: { leerlingKlassen: { some: { klas: { docenten: { some: { docentId: user.id } } } } } } };
    default:
      return { leerling: { schoolId: user.schoolId } };
  }
}

export async function loadBijlage(type: string, id: string, user: Gebruiker): Promise<Bijlage | null> {
  const isAdmin = user.role === "ADMIN";

  switch (type) {
    case "huiswerk":
      return prisma.huiswerk.findFirst({
        where: {
          id,
          vak: isAdmin
            ? { schoolId: user.schoolId }
            : { klassen: { some: { klas: klasFilter(user) } } },
          // Gericht huiswerk is alleen voor de leerling(en) in de doellijst;
          // een lege lijst betekent "hele klas".
          ...(user.role === "LEERLING"
            ? { OR: [{ doelLeerlingen: { none: {} } }, { doelLeerlingen: { some: { leerlingId: user.id } } }] }
            : {}),
        },
        select: SELECT,
      });

    case "bericht":
      // Alleen de twee mensen die het bericht aangaan — ook een admin leest
      // geen berichten van anderen mee.
      return prisma.bericht.findFirst({
        where: { id, OR: [{ verzenderId: user.id }, { ontvangerId: user.id }] },
        select: SELECT,
      });

    case "cijfer":
      return prisma.cijfer.findFirst({ where: { id, ...leerlingFilter(user) }, select: SELECT });

    case "inlevering":
      return prisma.inlevering.findFirst({ where: { id, ...leerlingFilter(user) }, select: SELECT });

    case "les":
      return prisma.les.findFirst({
        where: { id, klas: isAdmin ? { schoolId: user.schoolId } : klasFilter(user) },
        select: SELECT,
      });

    case "studiemateriaal":
      // Materiaal hangt aan een klas, aan een vak, of aan geen van beide
      // (schoolbreed). De docent die het plaatste mag er altijd bij.
      return prisma.studieMateriaal.findFirst({
        where: isAdmin
          ? { id, schoolId: user.schoolId }
          : {
              id,
              OR: [
                { docentId: user.id },
                { klas: klasFilter(user) },
                { klasId: null, vak: { klassen: { some: { klas: klasFilter(user) } } } },
                { klasId: null, vakId: null, schoolId: user.schoolId },
              ],
            },
        select: SELECT,
      });

    default:
      return null;
  }
}

/**
 * Wie vraagt dit op? Sessie, Bearer-header, of ?token= — bijlagen worden ook
 * geopend via een gewone browserlink, en die kan geen header meesturen.
 */
export async function bijlageGebruiker(req: NextRequest): Promise<Gebruiker | null> {
  const session = await auth();
  if (session?.user) return session.user as Gebruiker;

  const token = req.nextUrl.searchParams.get("token");
  if (token) return verifyMobileToken(token);

  return null;
}

/**
 * Opgeslagen URL → redirect; anders de base64 uit de database als download.
 *
 * De B2-bucket is privé: daar wordt per verzoek een handtekening van vijf
 * minuten voor gemaakt. Een gedeelde of gelekte link is dus snel waardeloos,
 * in tegenstelling tot de oude Blob-links die eeuwig blijven werken.
 */
export async function bijlageAntwoord(item: Bijlage | null): Promise<NextResponse> {
  if (!item || !item.bijlageNaam) {
    return NextResponse.json({ error: "Geen bijlage gevonden" }, { status: 404 });
  }

  // Ook rijen die vóór de URL-controle zijn opgeslagen worden hier nog gekeurd:
  // een kwaadaardige of kapotte URL wordt nooit een redirect.
  const veilig = veiligeBijlageUrl(item.bijlageUrl);
  if (veilig) {
    const sleutel = b2SleutelUitUrl(new URL(veilig));
    if (!sleutel) return NextResponse.redirect(veilig); // nog op Vercel Blob
    try {
      const link = await maakDownloadUrl(sleutel, { bestandsnaam: item.bijlageNaam });
      // Geen tussenopslag: de link erachter verloopt, een gecachte redirect
      // zou dus na vijf minuten een fout gaan opleveren.
      return NextResponse.redirect(link, { status: 302, headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      console.error("[bijlage] download-URL maken mislukt", err);
      return NextResponse.json({ error: "Bijlage niet beschikbaar" }, { status: 500 });
    }
  }
  if (item.bijlageUrl && !item.bijlageData) {
    return NextResponse.json({ error: "Geen bijlage gevonden" }, { status: 404 });
  }

  if (item.bijlageData) {
    const buffer = Buffer.from(item.bijlageData, "base64");
    const contentType = item.bijlageType ?? "application/octet-stream";
    const filename = encodeURIComponent(item.bijlageNaam);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  }

  return NextResponse.json({ error: "Geen bijlage gevonden" }, { status: 404 });
}
