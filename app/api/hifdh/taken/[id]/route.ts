import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/hifdh/taken/[id] — toggle voltooid (leerling OR docent)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const { voltooid } = await req.json();

  // Leerling can only complete their own tasks
  if (session.user.role === "LEERLING") {
    const taak = await prisma.hifdhTaak.findUnique({
      where: { id },
      include: { profiel: true },
    });
    if (!taak || taak.profiel.leerlingId !== session.user.id) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }
  }

  try {
    const updated = await prisma.hifdhTaak.update({
      where: { id },
      data: {
        voltooid: Boolean(voltooid),
        voltooidOp: voltooid ? new Date() : null,
      },
    });

    // If leerling marks task voltooid, update their current position
    if (session.user.role === "LEERLING" && voltooid) {
      const taak = await prisma.hifdhTaak.findUnique({ where: { id } });
      if (taak?.type === "NIEUW") {
        await prisma.hifdhProfiel.update({
          where: { leerlingId: session.user.id },
          data: {
            huidigeSurahNr: taak.surahNr,
            huidigeAyahNr: taak.totAyah,
          },
        });
      }
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Bijwerken mislukt" }, { status: 500 });
  }
}

// DELETE /api/hifdh/taken/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.hifdhTaak.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
