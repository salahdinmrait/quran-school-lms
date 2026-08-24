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
    orderBy: [{ les: { datum: "desc" } }, { id: "desc" }],
    include: {
      vak: true,
      les: { include: { klas: true } },
      // Include inleveringen with leerling info for the overview
      inleveringen: {
        include: {
          leerling: { select: { id: true, name: true } },
        },
      },
      // Optionele specifieke doel-leerlingen (leeg = hele vak/klas)
      doelLeerlingen: { include: { leerling: { select: { id: true, name: true } } } },
    },
  });

  // Strip large bijlage fields; expose hasBijlage. Idem voor inlevering-bijlagen.
  const result = huiswerk.map(({ bijlageData: _d, inleveringen, ...hw }) => ({
    ...hw,
    hasBijlage: !!hw.bijlageNaam,
    inleveringen: inleveringen.map(({ bijlageData: _id, ...inv }) => ({
      ...inv,
      hasBijlage: !!inv.bijlageNaam,
    })),
  }));

  return NextResponse.json(result);
}

// POST /api/docent/huiswerk — huiswerk aanmaken bij een les
//
// Huiswerk hoort altijd bij een les: de lesdatum bepaalt wanneer het aan de
// beurt is, er is geen aparte deadline meer. De docent moet aan de klas van die
// les gekoppeld zijn; het vak moet in die klas gegeven worden; en gerichte
// leerlingen moeten in die klas zitten.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const docentId = session.user.id;
  const { titel, beschrijving, vakId, lesId, leerlingIds,
          bijlageNaam, bijlageUrl, bijlageData, bijlageType } = await req.json();

  if (!titel || !vakId) {
    return NextResponse.json({ error: "titel en vakId zijn verplicht" }, { status: 400 });
  }
  if (!lesId) {
    return NextResponse.json(
      { error: "Huiswerk hoort bij een les — open de les in het rooster" },
      { status: 400 }
    );
  }

  // De les moet bij een klas van déze docent horen
  const les = await prisma.les.findFirst({
    where: { id: lesId, klas: { verwijderdOp: null, docenten: { some: { docentId } } } },
    select: {
      klasId: true,
      klas: {
        select: {
          vakken: { select: { vakId: true } },
          leerlingen: { select: { leerlingId: true } },
        },
      },
    },
  });
  if (!les) {
    return NextResponse.json({ error: "Les niet gevonden" }, { status: 404 });
  }
  if (!les.klas.vakken.some((kv) => kv.vakId === vakId)) {
    return NextResponse.json({ error: "Dit vak hoort niet bij deze klas" }, { status: 400 });
  }

  // Doelgroep: leeg = hele klas. Anders alleen leerlingen uit déze klas.
  const gevraagd: string[] = Array.isArray(leerlingIds)
    ? Array.from(new Set(leerlingIds.filter((x): x is string => typeof x === "string")))
    : [];
  const inKlas = new Set(les.klas.leerlingen.map((kl) => kl.leerlingId));
  if (gevraagd.some((id) => !inKlas.has(id))) {
    return NextResponse.json(
      { error: "Een gekozen leerling zit niet in deze klas" },
      { status: 400 }
    );
  }

  try {
    const hw = await prisma.huiswerk.create({
      data: {
        titel,
        beschrijving: beschrijving || null,
        vakId,
        lesId,
        bijlageNaam: bijlageNaam || null,
        bijlageUrl:  bijlageUrl  || null,   // Vercel Blob URL (preferred)
        bijlageData: bijlageData || null,   // legacy base64 fallback
        bijlageType: bijlageType || null,
        ...(gevraagd.length > 0
          ? { doelLeerlingen: { create: gevraagd.map((leerlingId) => ({ leerlingId })) } }
          : {}),
      },
      include: {
        vak: true,
        les: { include: { klas: true } },
        inleveringen: {
          include: { leerling: { select: { id: true, name: true } } },
        },
        doelLeerlingen: { include: { leerling: { select: { id: true, name: true } } } },
      },
    });
    // Strip large blob fields from response; download uses /api/attachment/huiswerk/[id]
    const { bijlageData: _d, ...hwOut } = hw as typeof hw & { bijlageData: string | null };
    return NextResponse.json({ ...hwOut, hasBijlage: !!hw.bijlageNaam }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/docent/huiswerk]", err);
    return NextResponse.json({ error: "Kon huiswerk niet aanmaken" }, { status: 500 });
  }
}
