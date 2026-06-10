import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// POST /api/docent/huiswerk/afvinken
// Body: { huiswerkId, leerlingId }
// Creates an Inlevering (marks homework done for a student)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "DOCENT" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { huiswerkId, leerlingId } = await req.json();
  if (!huiswerkId || !leerlingId) {
    return NextResponse.json({ error: "huiswerkId en leerlingId zijn verplicht" }, { status: 400 });
  }

  const inlevering = await prisma.inlevering.upsert({
    where: { huiswerkId_leerlingId: { huiswerkId, leerlingId } },
    create: { huiswerkId, leerlingId, inhoud: "✓" },
    update: { inhoud: "✓" },
  });

  return NextResponse.json(inlevering, { status: 201 });
}

// DELETE /api/docent/huiswerk/afvinken
// Body: { huiswerkId, leerlingId }
// Removes the Inlevering (un-marks homework)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "DOCENT" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { huiswerkId, leerlingId } = await req.json();
  if (!huiswerkId || !leerlingId) {
    return NextResponse.json({ error: "huiswerkId en leerlingId zijn verplicht" }, { status: 400 });
  }

  await prisma.inlevering.deleteMany({
    where: { huiswerkId, leerlingId },
  });

  return NextResponse.json({ success: true });
}
