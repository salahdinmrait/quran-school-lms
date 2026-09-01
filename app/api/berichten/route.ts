import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { toegestaneOntvangerIds } from "@/lib/contacten";
import { leesJson } from "@/lib/json-body";
import { leesBijlageVelden } from "@/lib/bijlage";
import { mailNieuweBerichten } from "@/lib/bericht-notificatie";

// Bovengrens op een samengesteld bericht: voorkomt dat één verzoek per ongeluk
// een enorme transactie wordt.
const MAX_DOELEN = 50;

// GET /api/berichten — inbox + deduplicated verzonden
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const userId = session.user.id;

  const [inboxRaw, verzondenRaw] = await Promise.all([
    prisma.bericht.findMany({
      where: { ontvangerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        verzender: { select: { id: true, name: true, role: true } },
        // Replies sent by the inbox owner (e.g. leerling's own replies to this message)
        replies: {
          include: { verzender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
        // Context: the original message this is a reply to (e.g. docent sees their own original)
        replyTo: {
          include: { verzender: { select: { id: true, name: true, role: true } } },
        },
      },
      take: 50,
    }),
    prisma.bericht.findMany({
      where: { verzenderId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        ontvanger: { select: { id: true, name: true, role: true } },
        // Replies received on sent messages (e.g. leerling replied to docent's sent message)
        replies: {
          include: { verzender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);

  // Deduplicate verzonden: group by groepId, show one entry with count
  const verzondenMap = new Map<
    string,
    { bericht: (typeof verzondenRaw)[0]; count: number }
  >();

  for (const b of verzondenRaw) {
    const key = b.groepId ?? b.id;
    if (!verzondenMap.has(key)) {
      verzondenMap.set(key, { bericht: b, count: 1 });
    } else {
      verzondenMap.get(key)!.count++;
    }
  }

  // Strip large base64 bijlageData; expose hasBijlage + naam/type (download via /api/attachment)
  const strip = <T extends { bijlageData?: string | null; bijlageNaam?: string | null }>(b: T) => {
    const { bijlageData: _d, ...rest } = b as T & { bijlageData?: string | null };
    return { ...rest, hasBijlage: !!b.bijlageNaam };
  };

  const inbox = inboxRaw.map((b) => ({
    ...strip(b),
    replies: (b.replies ?? []).map(strip),
    replyTo: b.replyTo ? strip(b.replyTo) : null,
  }));

  const verzonden = Array.from(verzondenMap.values()).map(({ bericht, count }) => ({
    id: bericht.id,
    groepId: bericht.groepId,
    onderwerp: bericht.onderwerp,
    inhoud: bericht.inhoud,
    createdAt: bericht.createdAt,
    doelLabel: bericht.doelLabel,
    bijlageNaam: bericht.bijlageNaam,
    bijlageType: bericht.bijlageType,
    hasBijlage: !!bericht.bijlageNaam,
    aantalOntvangers: count,
    ontvanger: count === 1 ? bericht.ontvanger : null,
    replies: (bericht.replies ?? []).map(strip),
  }));

  return NextResponse.json({ inbox, verzonden });
}

/**
 * POST /api/berichten — send a message
 *
 * doelType options:
 *   "GEBRUIKERS"       — doelIds: string[]   (specific users, any role)
 *   "KLAS_LEERLINGEN"  — doelId: string      (all leerlingen in klas)
 *   "KLAS_OUDERS"      — doelId: string      (all ouders of leerlingen in klas)
 *   "ADMINS"           — (geen doel)         (alle admins van de school)
 *   "SAMENGESTELD"     — doelen: Doel[]      (groepen én personen door elkaar)
 *
 * Een Doel is { soort, id? } met soort:
 *   "GEBRUIKER" (id = user), "KLAS_LEERLINGEN" / "KLAS_OUDERS" (id = klas),
 *   "ALLE_DOCENTEN" of "ADMINS" (zonder id).
 *
 * Role rules:
 *   ADMIN/DOCENT: all doelTypes allowed
 *   LEERLING: mag zelf een gesprek starten met een docent van de eigen klas of
 *             met het beheer, en mag reageren. Geen leeftijdsonderscheid.
 *
 * Ontvangers worden bij LEERLING en OUDER altijd getoetst aan de
 * relatiestructuur (lib/contacten.ts) — de schoolgrens alleen is niet genoeg.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const role = session.user.role;
  const verzenderId = session.user.id;

  // Only allowed roles
  if (role !== "DOCENT" && role !== "ADMIN" && role !== "LEERLING") {
    return NextResponse.json(
      { error: "Alleen docenten, beheerders en leerlingen mogen hier berichten sturen" },
      { status: 403 }
    );
  }

  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;
  const { onderwerp, inhoud, doelType, doelId, doelIds, doelen, replyToId } = gelezen.data;

  const bijlage = leesBijlageVelden(gelezen.data);
  if (!bijlage.ok) return bijlage.response;

  if (!onderwerp || !inhoud || !doelType) {
    return NextResponse.json(
      { error: "onderwerp, inhoud en doelType zijn verplicht" },
      { status: 400 }
    );
  }

  // Groepsberichten (hele klas / alle ouders) zijn niet voor leerlingen
  const isLeerling = role === "LEERLING";

  // Een docent mag alleen een klas aanschrijven waar hij zelf aan gekoppeld is;
  // een admin mag elke klas van de eigen school. Zonder deze check was het
  // schoolId genoeg en kon een docent elke klas van de school mailen.
  async function klasVanDezeGebruiker(klasId: unknown) {
    // Zonder deze controle wordt een ontbrekend doelId een findFirst zonder id
    // en gaat het bericht naar de eerste willekeurige klas van de school.
    if (typeof klasId !== "string" || klasId.length === 0) return null;
    return prisma.klas.findFirst({
      where: {
        id: klasId,
        verwijderdOp: null,
        schoolId: session!.user.schoolId ?? null,
        ...(role === "DOCENT" ? { docenten: { some: { docentId: verzenderId } } } : {}),
      },
      include: { leerlingen: { select: { leerlingId: true } } },
    });
  }

  // Leerlingen en ouders mogen alleen schrijven naar mensen die via de gewone
  // relatiestructuur bereikbaar zijn: docenten van de eigen klas(sen) en het
  // beheer van de school. null = geen beperking (docent/admin).
  const toegestaan = await toegestaneOntvangerIds(
    verzenderId,
    role,
    session.user.schoolId ?? null
  );

  let ontvangerIds: string[] = [];
  let doelLabel: string = "";
  // Ontvangers die persoonlijk zijn aangeschreven. Alleen die krijgen een
  // notificatiemail; een klas-brede mededeling niet (zie lib/bericht-notificatie.ts).
  let persoonlijkeOntvangerIds: string[] = [];

  if (doelType === "GEBRUIKERS") {
    const ids: string[] = Array.isArray(doelIds) ? doelIds : doelId ? [doelId] : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Geen ontvangers opgegeven" }, { status: 400 });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: ids }, schoolId: session.user.schoolId ?? null },
      select: { id: true, name: true, role: true },
    });

    if (users.length === 0) {
      return NextResponse.json({ error: "Geen geldige ontvangers gevonden" }, { status: 404 });
    }

    // Leerling/ouder: elke ontvanger moet in de eigen contactenlijst staan.
    // Dit vangt ook het geval af waarin iemand langs de UI om een willekeurig
    // id meestuurt van een docent van een andere klas.
    if (toegestaan) {
      const buitenBereik = users.filter((u) => !toegestaan.has(u.id));
      if (buitenBereik.length > 0) {
        return NextResponse.json(
          { error: "Je kunt alleen berichten sturen naar je eigen docenten of het beheer" },
          { status: 403 }
        );
      }
    }

    ontvangerIds = users.map((u) => u.id);
    persoonlijkeOntvangerIds = ontvangerIds;
    doelLabel = users.length === 1 ? users[0].name : `${users.length} ontvangers`;

  } else if (doelType === "KLAS_LEERLINGEN") {
    if (isLeerling) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }
    if (typeof doelId !== "string" || !doelId) {
      return NextResponse.json({ error: "doelId is verplicht bij dit doelType" }, { status: 400 });
    }
    const klas = await klasVanDezeGebruiker(doelId);
    if (!klas) {
      return NextResponse.json({ error: "Klas niet gevonden" }, { status: 404 });
    }
    ontvangerIds = klas.leerlingen.map((kl) => kl.leerlingId);
    doelLabel = `Klas ${klas.naam} (leerlingen)`;

  } else if (doelType === "KLAS_OUDERS") {
    if (isLeerling) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }
    if (typeof doelId !== "string" || !doelId) {
      return NextResponse.json({ error: "doelId is verplicht bij dit doelType" }, { status: 400 });
    }
    const klas = await klasVanDezeGebruiker(doelId);
    if (!klas) {
      return NextResponse.json({ error: "Klas niet gevonden" }, { status: 404 });
    }
    const ouders = await prisma.ouderLeerling.findMany({
      where: { leerlingId: { in: klas.leerlingen.map((kl) => kl.leerlingId) } },
      select: { ouderId: true },
    });
    ontvangerIds = Array.from(new Set(ouders.map((o) => o.ouderId)));
    doelLabel = `Ouders van klas ${klas.naam}`;

  } else if (doelType === "ADMINS") {
    // Iedereen binnen de school mag het beheer aanschrijven
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", actief: true, schoolId: session.user.schoolId ?? null },
      select: { id: true },
    });
    ontvangerIds = admins.map((a) => a.id);
    doelLabel = "Beheer";

  } else if (doelType === "SAMENGESTELD") {
    // Groepen en losse personen door elkaar in één bericht. Elk doel wordt
    // apart opgelost met dezelfde controles als de losse doelTypes hierboven.
    if (isLeerling) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }
    if (!Array.isArray(doelen) || doelen.length === 0) {
      return NextResponse.json({ error: "Geen ontvangers opgegeven" }, { status: 400 });
    }
    if (doelen.length > MAX_DOELEN) {
      return NextResponse.json(
        { error: `Maximaal ${MAX_DOELEN} doelen per bericht` },
        { status: 400 }
      );
    }

    const labels: string[] = [];
    const persoonIds: string[] = [];
    const verzameld = new Set<string>();

    for (const ruw of doelen) {
      if (!ruw || typeof ruw !== "object") {
        return NextResponse.json({ error: "Ongeldig doel" }, { status: 400 });
      }
      const { soort, id } = ruw as { soort?: unknown; id?: unknown };

      if (soort === "GEBRUIKER") {
        if (typeof id !== "string" || !id) {
          return NextResponse.json({ error: "Doel zonder id" }, { status: 400 });
        }
        persoonIds.push(id);

      } else if (soort === "KLAS_LEERLINGEN" || soort === "KLAS_OUDERS") {
        const klas = await klasVanDezeGebruiker(id);
        if (!klas) {
          return NextResponse.json({ error: "Klas niet gevonden" }, { status: 404 });
        }
        const leerlingIds = klas.leerlingen.map((kl) => kl.leerlingId);
        if (soort === "KLAS_LEERLINGEN") {
          for (const lid of leerlingIds) verzameld.add(lid);
          labels.push(`Klas ${klas.naam} (leerlingen)`);
        } else {
          const ouders = await prisma.ouderLeerling.findMany({
            where: { leerlingId: { in: leerlingIds } },
            select: { ouderId: true },
          });
          for (const o of ouders) verzameld.add(o.ouderId);
          labels.push(`Ouders van klas ${klas.naam}`);
        }

      } else if (soort === "ALLE_DOCENTEN") {
        const docenten = await prisma.user.findMany({
          where: {
            role: "DOCENT",
            actief: true,
            verwijderdOp: null,
            schoolId: session.user.schoolId ?? null,
          },
          select: { id: true },
        });
        for (const d of docenten) verzameld.add(d.id);
        labels.push("Alle docenten");

      } else if (soort === "ADMINS") {
        const admins = await prisma.user.findMany({
          where: {
            role: "ADMIN",
            actief: true,
            verwijderdOp: null,
            schoolId: session.user.schoolId ?? null,
          },
          select: { id: true },
        });
        for (const a of admins) verzameld.add(a.id);
        labels.push("Beheer");

      } else {
        return NextResponse.json({ error: "Ongeldige doelsoort" }, { status: 400 });
      }
    }

    // Losse personen in één query, en alleen binnen de eigen school.
    if (persoonIds.length > 0) {
      const users = await prisma.user.findMany({
        where: {
          id: { in: Array.from(new Set(persoonIds)) },
          schoolId: session.user.schoolId ?? null,
          verwijderdOp: null,
        },
        select: { id: true, name: true },
      });
      if (users.length === 0) {
        return NextResponse.json({ error: "Geen geldige ontvangers gevonden" }, { status: 404 });
      }
      persoonlijkeOntvangerIds = users.map((u) => u.id);
      for (const u of users) verzameld.add(u.id);
      labels.push(users.length === 1 ? users[0].name : `${users.length} personen`);
    }

    ontvangerIds = Array.from(verzameld);
    doelLabel = labels.join(" + ");

  } else {
    return NextResponse.json({ error: "Ongeldig doelType" }, { status: 400 });
  }

  // Dedup + stuur nooit naar jezelf (voorkomt o.a. "verstuurd naar 2" bij 1 keuze)
  ontvangerIds = Array.from(new Set(ontvangerIds)).filter((id) => id !== verzenderId);
  const echteOntvangers = new Set(ontvangerIds);
  persoonlijkeOntvangerIds = Array.from(new Set(persoonlijkeOntvangerIds)).filter((id) =>
    echteOntvangers.has(id)
  );

  if (ontvangerIds.length === 0) {
    return NextResponse.json(
      { error: "Geen ontvangers gevonden voor dit doel" },
      { status: 400 }
    );
  }

  // Een reply moet aan een bericht hangen dat deze gebruiker zelf aangaat.
  // Anders hangt iemand zijn bericht onder een willekeurig gesprek van twee
  // anderen, en verschijnt het daar in beeld als "antwoord".
  if (replyToId !== undefined && replyToId !== null) {
    if (typeof replyToId !== "string") {
      return NextResponse.json({ error: "replyToId moet een tekst zijn" }, { status: 400 });
    }
    const origineel = await prisma.bericht.findFirst({
      where: { id: replyToId, OR: [{ verzenderId }, { ontvangerId: verzenderId }] },
      select: { id: true },
    });
    if (!origineel) {
      return NextResponse.json(
        { error: "Je kunt alleen antwoorden op een bericht uit je eigen gesprekken" },
        { status: 403 }
      );
    }
  }

  const groepId =
    ontvangerIds.length > 1
      ? `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      : null;

  try {
    const berichten = await prisma.$transaction(
      ontvangerIds.map((ontvangerId) =>
        prisma.bericht.create({
          data: {
            onderwerp,
            inhoud,
            verzenderId,
            ontvangerId,
            groepId,
            doelLabel: groepId ? doelLabel : null,
            replyToId: replyToId ?? null,
            ...bijlage.velden,
          },
        })
      )
    );
    // Alleen persoonlijke post levert een mail op: een klas-brede mededeling
    // aan tientallen mensen niet, een antwoord in een gesprek wel.
    const teMailen = replyToId ? ontvangerIds : persoonlijkeOntvangerIds;
    await mailNieuweBerichten({
      ontvangerIds: teMailen,
      verzenderNaam: session.user.name,
      onderwerp,
    });

    return NextResponse.json({ count: berichten.length }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/berichten]", err);
    return NextResponse.json({ error: "Kon bericht niet versturen" }, { status: 500 });
  }
}
