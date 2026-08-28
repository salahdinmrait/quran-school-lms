import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { leesJson } from "@/lib/json-body";
import { docentGeeftLeerlingDitVak } from "@/lib/docent-scope";
import { leesBijlageVelden } from "@/lib/bijlage";

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

  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;
  const { leerlingId, vakId, waarde, omschrijving, opmerking } = gelezen.data;

  const bijlage = leesBijlageVelden(gelezen.data);
  if (!bijlage.ok) return bijlage.response;

  if (!leerlingId || !vakId || waarde === undefined) {
    return NextResponse.json(
      { error: "leerlingId, vakId en waarde zijn verplicht" },
      { status: 400 }
    );
  }

  // parseFloat slikt arrays en losse tekst met een getal erin ("8 punten").
  // Alleen een echt getal of een nette getalnotatie in tekst mag erdoor.
  const num =
    typeof waarde === "number"
      ? waarde
      : typeof waarde === "string" && /^-?\d+([.,]\d+)?$/.test(waarde.trim())
      ? parseFloat(waarde.trim().replace(",", "."))
      : NaN;
  if (!Number.isFinite(num) || num < 1 || num > 10) {
    return NextResponse.json(
      { error: "Waarde moet een getal tussen 1 en 10 zijn" },
      { status: 400 }
    );
  }

  // Een rolcheck is niet genoeg: zonder deze controle kan elke docent een
  // cijfer zetten bij elke leerling van elke school, zolang hij het id kent.
  if (typeof leerlingId !== "string" || typeof vakId !== "string") {
    return NextResponse.json({ error: "leerlingId en vakId moeten teksten zijn" }, { status: 400 });
  }
  if (!(await docentGeeftLeerlingDitVak(session.user.id, leerlingId, vakId))) {
    return NextResponse.json(
      { error: "Je geeft deze leerling geen les in dit vak" },
      { status: 403 }
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
        ...bijlage.velden,
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
