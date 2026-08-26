import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { leesJson } from "@/lib/json-body";

const VALID_STATUSES = ["AANWEZIG", "AFWEZIG", "TE_LAAT", "GEOORLOOFD"];

// Aanwezigheid wordt alleen vanuit een les geregistreerd. Een docent mag
// uitsluitend bij lessen van een klas waaraan hij zelf gekoppeld is.
async function eigenLes(lesId: string, docentId: string) {
  return prisma.les.findFirst({
    where: {
      id: lesId,
      klas: { verwijderdOp: null, docenten: { some: { docentId } } },
    },
    select: { id: true, klas: { select: { leerlingen: { select: { leerlingId: true } } } } },
  });
}

// GET /api/docent/absentie?lesId=xxx — de registratie van één les
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const lesId = req.nextUrl.searchParams.get("lesId");
  if (!lesId) {
    return NextResponse.json({ error: "lesId vereist" }, { status: 400 });
  }

  const les = await eigenLes(lesId, session.user.id);
  if (!les) return NextResponse.json({ error: "Les niet gevonden" }, { status: 404 });

  const aanwezigheid = await prisma.aanwezigheid.findMany({
    where: { lesId },
    include: { leerling: { select: { id: true, name: true } } },
  });

  return NextResponse.json(aanwezigheid);
}

// POST /api/docent/absentie — status van één leerling bij één les vastleggen
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;
  const { lesId, leerlingId, status } = gelezen.data;

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

  const les = await eigenLes(lesId, session.user.id);
  if (!les) return NextResponse.json({ error: "Les niet gevonden" }, { status: 404 });
  if (!les.klas.leerlingen.some((kl) => kl.leerlingId === leerlingId)) {
    return NextResponse.json({ error: "Deze leerling zit niet in de klas van deze les" }, { status: 400 });
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
