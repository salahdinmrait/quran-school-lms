import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/leerling/huiswerk        — al het huiswerk van deze leerling
// GET /api/leerling/huiswerk?lesId= — alleen het huiswerk bij één les
//     (gebruikt door het lesdetail in het rooster van de leerling)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LEERLING") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const leerlingId = session.user.id;
  const lesId = new URL(req.url).searchParams.get("lesId");

  // Huiswerk voor de klassen van de leerling; gericht huiswerk alleen als de
  // leerling in de doellijst staat (leeg = voor iedereen met dat vak).
  const huiswerk = await prisma.huiswerk.findMany({
    where: {
      ...(lesId ? { lesId } : {}),
      vak: {
        klassen: {
          some: {
            klas: { leerlingen: { some: { leerlingId } } },
          },
        },
      },
      OR: [
        { doelLeerlingen: { none: {} } },
        { doelLeerlingen: { some: { leerlingId } } },
      ],
    },
    include: {
      vak: true,
      les: { select: { id: true, datum: true } },
      inleveringen: {
        where: { leerlingId },
        select: {
          id: true, inhoud: true, opmerking: true, opmerkingOp: true, createdAt: true,
          bijlageNaam: true, bijlageType: true,
        },
      },
    },
    // Huiswerk hangt aan een les; de lesdatum bepaalt de volgorde. Los huiswerk
    // van vóór die regel heeft geen les en komt achteraan.
    orderBy: [{ les: { datum: "desc" } }, { id: "desc" }],
  });

  const result = huiswerk.map((h) => ({
    id: h.id,
    titel: h.titel,
    beschrijving: h.beschrijving,
    vak: { naam: h.vak.naam, categorie: h.vak.categorie },
    lesId: h.lesId,
    lesDatum: h.les?.datum.toISOString() ?? null,
    bijlageNaam: h.bijlageNaam ?? null,
    hasBijlage: !!h.bijlageNaam,
    afgevinkt: h.inleveringen.length > 0,
    inlevering: h.inleveringen[0]
      ? {
          id: h.inleveringen[0].id,
          inhoud: h.inleveringen[0].inhoud,
          createdAt: h.inleveringen[0].createdAt.toISOString(),
          opmerking: h.inleveringen[0].opmerking ?? null,
          opmerkingOp: h.inleveringen[0].opmerkingOp?.toISOString() ?? null,
          bijlageNaam: h.inleveringen[0].bijlageNaam ?? null,
          hasBijlage: !!h.inleveringen[0].bijlageNaam,
        }
      : undefined,
  }));

  return NextResponse.json(result);
}

// Geen POST: de docent bepaalt of huiswerk af is, via
// /api/docent/huiswerk/afvinken. Leerlingen leveren niets meer in.
