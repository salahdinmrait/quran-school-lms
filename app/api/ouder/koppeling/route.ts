import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/ouder/koppeling?ouderId=xxx — get linked children for an ouder (admin only)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const ouderId = searchParams.get("ouderId");
  if (!ouderId) {
    return NextResponse.json({ error: "ouderId is verplicht" }, { status: 400 });
  }

  const koppelingen = await prisma.ouderLeerling.findMany({
    where: { ouderId },
    include: {
      leerling: { select: { id: true, name: true, email: true } },
    },
    orderBy: { leerling: { name: "asc" } },
  });

  return NextResponse.json(koppelingen.map((k) => k.leerling));
}

// POST /api/ouder/koppeling — link parent to child (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { ouderId, leerlingId } = await req.json();
  if (!ouderId || !leerlingId) {
    return NextResponse.json({ error: "ouderId en leerlingId zijn verplicht" }, { status: 400 });
  }

  try {
    const koppeling = await prisma.ouderLeerling.upsert({
      where: { ouderId_leerlingId: { ouderId, leerlingId } },
      create: { ouderId, leerlingId },
      update: {},
    });
    return NextResponse.json(koppeling, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Koppelen mislukt" }, { status: 500 });
  }
}

// DELETE /api/ouder/koppeling
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { ouderId, leerlingId } = await req.json();
  try {
    await prisma.ouderLeerling.delete({
      where: { ouderId_leerlingId: { ouderId, leerlingId } },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
