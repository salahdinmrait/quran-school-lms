import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// PUT /api/berichten/[id] — mark as read
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  try {
    const bericht = await prisma.bericht.findUnique({ where: { id } });
    if (!bericht || bericht.ontvangerId !== userId) {
      return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    }
    await prisma.bericht.update({ where: { id }, data: { gelezen: true } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Bijwerken mislukt" }, { status: 500 });
  }
}

// DELETE /api/berichten/[id] — delete own sent message or inbox item
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  try {
    const bericht = await prisma.bericht.findUnique({ where: { id } });
    if (!bericht) {
      return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    }
    if (bericht.ontvangerId !== userId && bericht.verzenderId !== userId) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }
    await prisma.bericht.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
