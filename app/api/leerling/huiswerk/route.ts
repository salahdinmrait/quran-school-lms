import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { leesBijlageVelden } from "@/lib/bijlage";
import { leesJson } from "@/lib/json-body";
import { prisma } from "@/lib/prisma";

// Zichtbaarheidsregel voor huiswerk van deze leerling: het vak moet aan een
// klas van de leerling hangen, en gericht huiswerk alleen als hij in de
// doellijst staat (lege doellijst = voor iedereen met dat vak).
function zichtbaarVoor(leerlingId: string) {
  return {
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
  };
}

const MAX_INHOUD = 5000;

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

  const huiswerk = await prisma.huiswerk.findMany({
    where: {
      ...(lesId ? { lesId } : {}),
      ...zichtbaarVoor(leerlingId),
    },
    include: {
      vak: true,
      les: { select: { id: true, datum: true } },
      inleveringen: {
        where: { leerlingId },
        select: {
          id: true, inhoud: true, opmerking: true, opmerkingOp: true, createdAt: true,
          bijlageNaam: true, bijlageType: true,
          ingeleverdOp: true, afgevinktOp: true,
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
    // Afgevinkt is voortaan iets anders dan ingeleverd: de leerling levert in,
    // de docent tekent af. Alleen afgevinkt telt mee voor het klassement.
    afgevinkt: !!h.inleveringen[0]?.afgevinktOp,
    ingeleverd: !!h.inleveringen[0]?.ingeleverdOp,
    inlevering: h.inleveringen[0]
      ? {
          id: h.inleveringen[0].id,
          inhoud: h.inleveringen[0].inhoud,
          createdAt: h.inleveringen[0].createdAt.toISOString(),
          ingeleverdOp: h.inleveringen[0].ingeleverdOp?.toISOString() ?? null,
          afgevinktOp: h.inleveringen[0].afgevinktOp?.toISOString() ?? null,
          opmerking: h.inleveringen[0].opmerking ?? null,
          opmerkingOp: h.inleveringen[0].opmerkingOp?.toISOString() ?? null,
          bijlageNaam: h.inleveringen[0].bijlageNaam ?? null,
          hasBijlage: !!h.inleveringen[0].bijlageNaam,
        }
      : undefined,
  }));

  return NextResponse.json(result);
}

// POST /api/leerling/huiswerk — de leerling levert in met een opmerking en
// eventueel een bijlage (geüpload via /api/bijlage-upload).
//
// Inleveren is niet hetzelfde als afgevinkt: `afgevinktOp` en de feedback van
// de docent (`opmerking`) blijven hier onaangeroerd. Zolang de docent nog niet
// heeft afgetekend mag de leerling zijn inlevering bijwerken.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LEERLING") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }
  const leerlingId = session.user.id;

  const body = await leesJson(req);
  if (!body.ok) return body.response;

  const huiswerkId = body.data.huiswerkId;
  if (typeof huiswerkId !== "string" || !huiswerkId) {
    return NextResponse.json({ error: "huiswerkId ontbreekt" }, { status: 400 });
  }

  const ruweInhoud = body.data.inhoud;
  if (ruweInhoud !== undefined && ruweInhoud !== null && typeof ruweInhoud !== "string") {
    return NextResponse.json({ error: "Ongeldige inhoud" }, { status: 400 });
  }
  const inhoud = (ruweInhoud ?? "").trim().slice(0, MAX_INHOUD);

  const bijlage = leesBijlageVelden(body.data);
  if (!bijlage.ok) return bijlage.response;

  // Een lege inlevering zegt niets; er moet tekst of een bestand zijn.
  if (!inhoud && !bijlage.velden.bijlageUrl) {
    return NextResponse.json(
      { error: "Vul een antwoord in of voeg een bestand toe" },
      { status: 400 }
    );
  }

  // Mag deze leerling bij dit huiswerk? Zelfde regel als de GET hierboven.
  const huiswerk = await prisma.huiswerk.findFirst({
    where: { id: huiswerkId, ...zichtbaarVoor(leerlingId) },
    select: { id: true },
  });
  if (!huiswerk) {
    return NextResponse.json({ error: "Huiswerk niet gevonden" }, { status: 404 });
  }

  const nu = new Date();
  const inlevering = await prisma.inlevering.upsert({
    where: { huiswerkId_leerlingId: { huiswerkId, leerlingId } },
    create: { huiswerkId, leerlingId, inhoud, ingeleverdOp: nu, ...bijlage.velden },
    update: { inhoud, ingeleverdOp: nu, ...bijlage.velden },
    select: { id: true, ingeleverdOp: true, afgevinktOp: true },
  });

  return NextResponse.json({
    id: inlevering.id,
    ingeleverdOp: inlevering.ingeleverdOp?.toISOString() ?? null,
    afgevinkt: !!inlevering.afgevinktOp,
  });
}
