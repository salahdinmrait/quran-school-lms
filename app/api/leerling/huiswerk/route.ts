import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "LEERLING") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const leerlingId = session.user.id;

  // Haal alle huiswerk op voor de klassen van de leerling
  const huiswerk = await prisma.huiswerk.findMany({
    where: {
      vak: {
        klassen: {
          some: {
            klas: { leerlingen: { some: { leerlingId } } },
          },
        },
      },
    },
    include: {
      vak: true,
      inleveringen: {
        where: { leerlingId },
        select: { id: true, inhoud: true, opmerking: true, opmerkingOp: true, createdAt: true },
      },
    },
    orderBy: { deadline: "asc" },
  });

  const result = huiswerk.map((h) => ({
    id: h.id,
    titel: h.titel,
    beschrijving: h.beschrijving,
    deadline: h.deadline?.toISOString() ?? null,
    vak: { naam: h.vak.naam, categorie: h.vak.categorie },
    ingeLeverd: h.inleveringen.length > 0,
    inlevering: h.inleveringen[0]
      ? {
          inhoud: h.inleveringen[0].inhoud,
          createdAt: h.inleveringen[0].createdAt.toISOString(),
          opmerking: h.inleveringen[0].opmerking ?? null,
          opmerkingOp: h.inleveringen[0].opmerkingOp?.toISOString() ?? null,
        }
      : undefined,
  }));

  return NextResponse.json(result);
}

// POST removed: only docents can mark homework done via /api/docent/huiswerk/afvinken
