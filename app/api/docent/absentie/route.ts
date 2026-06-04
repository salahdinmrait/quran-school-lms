import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["AANWEZIG", "AFWEZIG", "TE_LAAT", "GEOORLOOFD"];

// GET /api/docent/absentie?lesId=xxx — absentie for a specific les
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const lesId = req.nextUrl.searchParams.get("lesId");
  if (!lesId) {
    return NextResponse.json({ error: "lesId vereist" }, { status: 400 });
  }

  const aanwezigheid = await prisma.aanwezigheid.findMany({
    where: { lesId },
    include: { leerling: { select: { id: true, name: true } } },
  });

  return NextResponse.json(aanwezigheid);
}

// POST /api/docent/absentie — upsert attendance record
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { lesId, leerlingId, status } = await req.json();

  if (!lesId || !leerlingId || !status) {
    return NextResponse.json(
      { error: "lesId, leerlingId en status zijn verplicht" },
      { status: 400 }
    );
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Status moet een van ${VALID_STATUSES.join(", ")} zijn` },
      { status: 400 }
    );
  }

  try {
    const record = await prisma.aanwezigheid.upsert({
      where: { lesId_leerlingId: { lesId, leerlingId } },
      update: { status },
      create: { lesId, leerlingId, status },
    });
    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: "Opslaan mislukt" }, { status: 500 });
  }
}
