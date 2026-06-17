import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/docent/cijfers — cijfers for docent's klassen (grouped by klas/vak)
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const docentId = session.user.id;

  const cijfers = await prisma.cijfer.findMany({
    where: {
      vak: {
        klassen: {
          some: {
            klas: { docenten: { some: { docentId } } },
          },
        },
      },
    },
    orderBy: { datum: "desc" },
    include: {
      leerling: { select: { id: true, name: true } },
      vak: true,
    },
  });

  // Strip grote base64; expose hasBijlage (download via /api/attachment/cijfer/[id])
  const result = cijfers.map(({ bijlageData: _d, ...c }) => ({ ...c, hasBijlage: !!c.bijlageNaam }));
  return NextResponse.json(result);
}

// POST /api/docent/cijfers — create a cijfer
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { leerlingId, vakId, waarde, omschrijving, opmerking,
          bijlageNaam, bijlageUrl, bijlageData, bijlageType } = await req.json();

  if (!leerlingId || !vakId || waarde === undefined) {
    return NextResponse.json(
      { error: "leerlingId, vakId en waarde zijn verplicht" },
      { status: 400 }
    );
  }

  const num = parseFloat(waarde);
  if (isNaN(num) || num < 1 || num > 10) {
    return NextResponse.json(
      { error: "Waarde moet een getal tussen 1 en 10 zijn" },
      { status: 400 }
    );
  }

  try {
    const cijfer = await prisma.cijfer.create({
      data: {
        leerlingId,
        vakId,
        waarde: num,
        omschrijving: omschrijving || null,
        opmerking: opmerking || null,
        opmerkingOp: opmerking ? new Date() : null,
        bijlageNaam: bijlageNaam || null,
        bijlageUrl: bijlageUrl || null,
        bijlageData: bijlageData || null,
        bijlageType: bijlageType || null,
      },
      include: {
        leerling: { select: { id: true, name: true } },
        vak: true,
      },
    });
    const { bijlageData: _d, ...out } = cijfer;
    return NextResponse.json({ ...out, hasBijlage: !!cijfer.bijlageNaam }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kon cijfer niet opslaan" }, { status: 500 });
  }
}
