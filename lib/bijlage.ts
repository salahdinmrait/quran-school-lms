import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
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

/** Blob-URL → redirect; anders de base64 uit de database als download. */
export function bijlageAntwoord(item: Bijlage | null): NextResponse {
  if (!item || !item.bijlageNaam) {
    return NextResponse.json({ error: "Geen bijlage gevonden" }, { status: 404 });
  }

  if (item.bijlageUrl) {
    return NextResponse.redirect(item.bijlageUrl);
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
