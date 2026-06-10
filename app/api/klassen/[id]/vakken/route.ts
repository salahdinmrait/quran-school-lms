import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id: klasId } = await params;
  const { vakId } = await req.json();

  if (!vakId) {
    return NextResponse.json({ error: "vakId vereist" }, { status: 400 });
  }

  try {
    const koppeling = await prisma.klasVak.create({ data: { klasId, vakId } });
    return NextResponse.json(koppeling, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Vak is al gekoppeld aan deze klas" }, { status: 409 });
    }
    return NextResponse.json({ error: "Kon vak niet toevoegen" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id: klasId } = await params;
  const { vakId } = await req.json();

  try {
    await prisma.klasVak.deleteMany({ where: { klasId, vakId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
