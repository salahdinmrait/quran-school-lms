import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/hifdh — docent/admin: get all hifdh profielen for their leerlingen
export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  // Docents see only leerlingen in their klassen
  const where =
    session.user.role === "DOCENT"
      ? {
          leerling: {
            leerlingKlassen: {
              some: {
                klas: { docenten: { some: { docentId: session.user.id } } },
              },
            },
          },
        }
      : {};

  const profielen = await prisma.hifdhProfiel.findMany({
    where,
    include: {
      leerling: { select: { id: true, name: true, email: true } },
      taken: { orderBy: { weekStart: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(profielen);
}

// POST /api/hifdh — create or update hifdh profiel for a leerling
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { leerlingId, startSurahNr, startAyahNr, ayaatPerWeek, opmerkingen } = await req.json();
  if (!leerlingId || !startSurahNr) {
    return NextResponse.json({ error: "leerlingId en startSurahNr zijn verplicht" }, { status: 400 });
  }

  try {
    const profiel = await prisma.hifdhProfiel.upsert({
      where: { leerlingId },
      create: {
        leerlingId,
        startSurahNr: Number(startSurahNr),
        startAyahNr: Number(startAyahNr ?? 1),
        huidigeSurahNr: Number(startSurahNr),
        huidigeAyahNr: Number(startAyahNr ?? 1),
        ayaatPerWeek: Number(ayaatPerWeek ?? 5),
        opmerkingen: opmerkingen || null,
      },
      update: {
        startSurahNr: Number(startSurahNr),
        startAyahNr: Number(startAyahNr ?? 1),
        ayaatPerWeek: Number(ayaatPerWeek ?? 5),
        opmerkingen: opmerkingen || null,
      },
      include: {
        leerling: { select: { id: true, name: true, email: true } },
        taken: { orderBy: { weekStart: "asc" } },
      },
    });
    return NextResponse.json(profiel, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Aanmaken mislukt" }, { status: 500 });
  }
}
