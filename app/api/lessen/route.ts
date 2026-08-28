import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { leesJson } from "@/lib/json-body";
import { leesBijlageVelden } from "@/lib/bijlage";

const klasInclude = {
  include: {
    vakken: { include: { vak: true } },
    leerlingen: { include: { leerling: { select: { id: true, name: true } } } },
  },
};

// GET /api/lessen — admin sees all; docent sees their klassen only
export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const where =
    session.user.role === "DOCENT"
      ? { klas: { docenten: { some: { docentId: session.user.id } } } }
      : { klas: { schoolId: session.user.schoolId ?? null } };

  const lessen = await prisma.les.findMany({
    where,
    orderBy: [{ datum: "asc" }, { begintijd: "asc" }],
    include: {
      klas: klasInclude,
      vak: true,
      _count: { select: { huiswerk: true } },
    },
  });

  const result = lessen.map(({ bijlageData: _d, _count, ...l }) => ({
    ...l,
    hasBijlage: !!l.bijlageNaam,
    huiswerkAantal: _count.huiswerk,
  }));
  return NextResponse.json(result);
}

// POST /api/lessen — create lesson(s); admin + docent (own klassen only)
// Body: { klasId, vakId?, datum, begintijd, eindtijd, lokaal?, herhalen?: { totDatum: string } }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;
  const { klasId, vakId, datum, begintijd, eindtijd, lokaal, herhalen,
          beschrijving } = gelezen.data;

  const bijlage = leesBijlageVelden(gelezen.data);
  if (!bijlage.ok) return bijlage.response;

  if (!klasId || !datum || !begintijd || !eindtijd) {
    return NextResponse.json(
      { error: "klasId, datum, begintijd en eindtijd zijn verplicht" },
      { status: 400 }
    );
  }

  // Docent may only add lessen to their own klassen; admin only within their school
  if (session.user.role === "DOCENT") {
    const link = await prisma.klasDocent.findFirst({
      where: { klasId, docentId: session.user.id },
    });
    if (!link) {
      return NextResponse.json({ error: "Geen toegang tot deze klas" }, { status: 403 });
    }
  } else {
    const klas = await prisma.klas.findUnique({ where: { id: klasId } });
    if (!klas || klas.schoolId !== (session.user.schoolId ?? null)) {
      return NextResponse.json({ error: "Geen toegang tot deze klas" }, { status: 403 });
    }
  }

  // Onleesbare invoer hoort een 400 te geven, geen 500 uit de database.
  const startDate = new Date(datum);
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Datum is niet leesbaar" }, { status: 400 });
  }

  const TIJD = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!TIJD.test(String(begintijd)) || !TIJD.test(String(eindtijd))) {
    return NextResponse.json(
      { error: "Begintijd en eindtijd moeten van de vorm uu:mm zijn" },
      { status: 400 }
    );
  }
  if (String(eindtijd) <= String(begintijd)) {
    return NextResponse.json(
      { error: "De eindtijd moet na de begintijd liggen" },
      { status: 400 }
    );
  }

  const dates: Date[] = [startDate];

  if (herhalen?.totDatum) {
    const endDate = new Date(herhalen.totDatum);
    if (Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Einddatum van de herhaling is niet leesbaar" }, { status: 400 });
    }
    // Een schooljaar is ruim genoeg. Zonder grens maakt één verzoek met een
    // einddatum in 2045 duizenden lessen aan.
    const MAX_LESSEN = 60;
    let current = new Date(startDate);
    while (true) {
      current = new Date(current);
      current.setDate(current.getDate() + 7);
      if (current > endDate) break;
      if (dates.length >= MAX_LESSEN) {
        return NextResponse.json(
          { error: `Een herhaling maakt maximaal ${MAX_LESSEN} lessen. Kies een kortere periode.` },
          { status: 400 }
        );
      }
      dates.push(new Date(current));
    }
  }

  try {

    const created = await prisma.$transaction(
      dates.map((d) =>
        prisma.les.create({
          data: {
            klasId,
            vakId: vakId || null,
            datum: d,
            begintijd,
            eindtijd,
            lokaal: lokaal || null,
            beschrijving: beschrijving || null,
            // Bijlage alleen op de eerste les bij herhaling (anders dupliceert grote data)
            ...bijlage.velden,
          },
          include: {
            klas: klasInclude,
            vak: true,
          },
        })
      )
    );

    return NextResponse.json({ count: created.length, lessen: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kon les niet aanmaken" }, { status: 500 });
  }
}
