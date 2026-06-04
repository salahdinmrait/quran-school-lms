import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      : {};

  const lessen = await prisma.les.findMany({
    where,
    orderBy: [{ datum: "asc" }, { begintijd: "asc" }],
    include: {
      klas: klasInclude,
      vak: true,
    },
  });

  return NextResponse.json(lessen);
}

// POST /api/lessen — create lesson(s); admin + docent (own klassen only)
// Body: { klasId, vakId?, datum, begintijd, eindtijd, lokaal?, herhalen?: { totDatum: string } }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { klasId, vakId, datum, begintijd, eindtijd, lokaal, herhalen } = await req.json();

  if (!klasId || !datum || !begintijd || !eindtijd) {
    return NextResponse.json(
      { error: "klasId, datum, begintijd en eindtijd zijn verplicht" },
      { status: 400 }
    );
  }

  // Docent may only add lessen to their own klassen
  if (session.user.role === "DOCENT") {
    const link = await prisma.klasDocent.findFirst({
      where: { klasId, docentId: session.user.id },
    });
    if (!link) {
      return NextResponse.json({ error: "Geen toegang tot deze klas" }, { status: 403 });
    }
  }

  try {
    const startDate = new Date(datum);
    const dates: Date[] = [startDate];

    if (herhalen?.totDatum) {
      const endDate = new Date(herhalen.totDatum);
      let current = new Date(startDate);
      while (true) {
        current = new Date(current);
        current.setDate(current.getDate() + 7);
        if (current > endDate) break;
        dates.push(new Date(current));
      }
    }

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
