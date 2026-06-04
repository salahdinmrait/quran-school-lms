import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

  return NextResponse.json(huiswerk);
}

// POST /api/docent/huiswerk — create huiswerk
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { titel, beschrijving, deadline, vakId, lesId } = await req.json();

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
      },
      include: {
        vak: true,
        les: { include: { klas: true } },
        inleveringen: {
          include: { leerling: { select: { id: true, name: true } } },
        },
      },
    });
    return NextResponse.json(hw, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kon huiswerk niet aanmaken" }, { status: 500 });
  }
}
