import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { createTakenForProfiel } from "@/lib/hifdh-utils";

// GET /api/hifdh — docent/admin: get all hifdh profielen for their leerlingen
export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

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
      : { leerling: { schoolId: session.user.schoolId ?? null } };

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
// On CREATE: automatically generates 6 weeks of tasks + linked huiswerk
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { leerlingId, startSurahNr, startAyahNr, ayaatPerWeek, opmerkingen } = await req.json();
  if (!leerlingId || !startSurahNr) {
    return NextResponse.json({ error: "leerlingId en startSurahNr zijn verplicht" }, { status: 400 });
  }

  // Toegangscontrole: admin alleen eigen school, docent alleen eigen leerlingen
  if (session.user.role === "ADMIN") {
    const leerling = await prisma.user.findUnique({
      where: { id: leerlingId },
      select: { schoolId: true },
    });
    if (!leerling || leerling.schoolId !== (session.user.schoolId ?? null)) {
      return NextResponse.json({ error: "Leerling niet gevonden" }, { status: 404 });
    }
  } else {
    const link = await prisma.klasLeerling.findFirst({
      where: {
        leerlingId,
        klas: { docenten: { some: { docentId: session.user.id } } },
      },
    });
    if (!link) {
      return NextResponse.json({ error: "Geen toegang tot deze leerling" }, { status: 403 });
    }
  }

  try {
    // Check if this is a new profile or an update
    const existing = await prisma.hifdhProfiel.findUnique({ where: { leerlingId } });
    const isNew = !existing;

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

    // Auto-generate 6 weeks of tasks for new profiles
    if (isNew) {
      await createTakenForProfiel(profiel.id);
      // Re-fetch with taken included
      const full = await prisma.hifdhProfiel.findUnique({
        where: { id: profiel.id },
        include: {
          leerling: { select: { id: true, name: true, email: true } },
          taken: { orderBy: { weekStart: "asc" } },
        },
      });
      return NextResponse.json(full, { status: 201 });
    }

    return NextResponse.json(profiel, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Aanmaken mislukt" }, { status: 500 });
  }
}
