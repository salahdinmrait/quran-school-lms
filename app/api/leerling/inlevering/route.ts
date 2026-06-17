import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// POST /api/leerling/inlevering — leerling levert huiswerk in (tekst en/of bestand).
// Additief: de docent kan nog steeds afvinken/becommentariëren. Upsert per (huiswerk, leerling).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LEERLING") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const leerlingId = session.user.id;
  const { huiswerkId, inhoud, bijlageNaam, bijlageUrl, bijlageData, bijlageType } = await req.json();

  if (!huiswerkId || (!inhoud && !bijlageNaam)) {
    return NextResponse.json(
      { error: "huiswerkId en tekst of een bijlage zijn verplicht" },
      { status: 400 }
    );
  }

  // Controleer dat dit huiswerk bij de leerling hoort: vak in een eigen klas,
  // en (indien gericht) de leerling staat in de doellijst.
  const huiswerk = await prisma.huiswerk.findUnique({
    where: { id: huiswerkId },
    select: {
      vakId: true,
      doelLeerlingen: { select: { leerlingId: true } },
    },
  });
  if (!huiswerk) {
    return NextResponse.json({ error: "Huiswerk niet gevonden" }, { status: 404 });
  }

  const heeftVak = await prisma.klasLeerling.findFirst({
    where: { leerlingId, klas: { vakken: { some: { vakId: huiswerk.vakId } } } },
  });
  const gericht = huiswerk.doelLeerlingen.length > 0;
  const isDoel = huiswerk.doelLeerlingen.some((d) => d.leerlingId === leerlingId);
  if (!heeftVak || (gericht && !isDoel)) {
    return NextResponse.json({ error: "Geen toegang tot dit huiswerk" }, { status: 403 });
  }

  const inhoudTekst = inhoud?.trim() || (bijlageNaam ? "📎 Bestand ingeleverd" : "");

  try {
    const inlevering = await prisma.inlevering.upsert({
      where: { huiswerkId_leerlingId: { huiswerkId, leerlingId } },
      create: {
        huiswerkId,
        leerlingId,
        inhoud: inhoudTekst,
        bijlageNaam: bijlageNaam || null,
        bijlageUrl: bijlageUrl || null,
        bijlageData: bijlageData || null,
        bijlageType: bijlageType || null,
      },
      update: {
        inhoud: inhoudTekst,
        ...(bijlageNaam !== undefined
          ? {
              bijlageNaam: bijlageNaam || null,
              bijlageUrl: bijlageUrl || null,
              bijlageData: bijlageData || null,
              bijlageType: bijlageType || null,
            }
          : {}),
      },
    });
    const { bijlageData: _d, ...out } = inlevering;
    return NextResponse.json({ ...out, hasBijlage: !!inlevering.bijlageNaam }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Inleveren mislukt" }, { status: 500 });
  }
}
