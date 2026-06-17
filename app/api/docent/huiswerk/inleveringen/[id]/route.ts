import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// PUT /api/docent/huiswerk/inleveringen/[id]
// Body: { opmerking: string }
// Saves feedback on a submission and sends an internal notification to the leerling + their ouders.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const { opmerking } = await req.json();

  if (typeof opmerking !== "string" || !opmerking.trim()) {
    return NextResponse.json({ error: "opmerking is verplicht" }, { status: 400 });
  }

  // Load the inlevering with huiswerk title + leerling info
  const inlevering = await prisma.inlevering.findUnique({
    where: { id },
    include: {
      leerling: { select: { id: true, name: true } },
      huiswerk: { select: { titel: true } },
    },
  });

  if (!inlevering) {
    return NextResponse.json({ error: "Inlevering niet gevonden" }, { status: 404 });
  }

  // Save the remark
  const updated = await prisma.inlevering.update({
    where: { id },
    data: { opmerking: opmerking.trim(), opmerkingOp: new Date() },
  });

  // ── Send notifications ────────────────────────────────────────────────────
  const docentId = session.user.id;
  const leerlingId = inlevering.leerling.id;
  const hwTitel = inlevering.huiswerk.titel;
  const leerlingNaam = inlevering.leerling.name;

  // Find all ouders linked to this leerling
  const koppelingen = await prisma.ouderLeerling.findMany({
    where: { leerlingId },
    select: { ouderId: true },
  });
  const ouderIds = koppelingen.map((k) => k.ouderId);

  // Build bericht records
  const berichtData = [
    // To the leerling
    {
      onderwerp: `Opmerking op je huiswerk: ${hwTitel}`,
      inhoud: opmerking.trim(),
      verzenderId: docentId,
      ontvangerId: leerlingId,
    },
    // To each ouder
    ...ouderIds.map((ouderId) => ({
      onderwerp: `Opmerking op huiswerk van ${leerlingNaam}: ${hwTitel}`,
      inhoud: opmerking.trim(),
      verzenderId: docentId,
      ontvangerId: ouderId,
    })),
  ];

  // Fire-and-forget — don't let notification failure block the response
  prisma.bericht
    .createMany({ data: berichtData })
    .catch((err) => console.error("Notificatie versturen mislukt:", err));

  return NextResponse.json({
    id: updated.id,
    opmerking: updated.opmerking,
    opmerkingOp: updated.opmerkingOp,
  });
}
