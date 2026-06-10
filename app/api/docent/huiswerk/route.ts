import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/docent/huiswerk[?lesId=xxx] — huiswerk for docent's klassen
// If lesId is provided, returns only huiswerk linked to that specific les
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const docentId = session.user.id;
  const lesId = req.nextUrl.searchParams.get("lesId");

  const baseWhere = {
    vak: {
      klassen: {
        some: {
          klas: { docenten: { some: { docentId } } },
        },
      },
    },
  };

  const where = lesId
    ? { ...baseWhere, lesId }
    : baseWhere;

  const huiswerk = await prisma.huiswerk.findMany({
    where,
    orderBy: { deadline: "asc" },
    include: {
      vak: true,
      les: { include: { klas: true } },
      // Include inleveringen with leerling info for the overview
      inleveringen: {
        include: {
          leerling: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Strip large bijlage fields from list response; client uses /api/bijlage/[id] to download
  const result = huiswerk.map(({ bijlageData: _d, bijlageUrl: _u, ...hw }) => ({
    ...hw,
    hasBijlage: !!hw.bijlageNaam,
  }));

  return NextResponse.json(result);
}

// POST /api/docent/huiswerk — create huiswerk
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { titel, beschrijving, deadline, vakId, lesId,
          bijlageNaam, bijlageUrl, bijlageData, bijlageType } = await req.json();

  if (!titel || !vakId) {
    return NextResponse.json({ error: "titel en vakId zijn verplicht" }, { status: 400 });
  }

  try {
    const hw = await prisma.huiswerk.create({
      data: {
        titel,
        beschrijving: beschrijving || null,
        deadline: deadline ? new Date(deadline) : null,
        vakId,
        lesId: lesId || null,
        bijlageNaam: bijlageNaam || null,
        bijlageUrl:  bijlageUrl  || null,   // Vercel Blob URL (preferred)
        bijlageData: bijlageData || null,   // legacy base64 fallback
        bijlageType: bijlageType || null,
      },
      include: {
        vak: true,
        les: { include: { klas: true } },
        inleveringen: {
          include: { leerling: { select: { id: true, name: true } } },
        },
      },
    });
    // Strip large blob fields from response; download uses /api/bijlage/[id]
    const { bijlageData: _d, bijlageUrl: _u, ...hwOut } = hw as typeof hw & { bijlageData: string | null; bijlageUrl: string | null };
    return NextResponse.json({ ...hwOut, hasBijlage: !!hw.bijlageNaam }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/docent/huiswerk]", err);
    return NextResponse.json({ error: "Kon huiswerk niet aanmaken" }, { status: 500 });
  }
}
