import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { vakSchema } from "@/lib/validations";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const vak = await prisma.vak.findUnique({
      where: { id },
      include: { _count: { select: { klassen: true } } },
    });

    if (!vak) {
      return NextResponse.json({ error: "Vak niet gevonden" }, { status: 404 });
    }

    return NextResponse.json(vak);
  } catch {
    return NextResponse.json({ error: "Kon vak niet ophalen" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

  const bestaand = await prisma.vak.findUnique({ where: { id }, select: { schoolId: true } });
  if (!bestaand || bestaand.schoolId !== (session.user.schoolId ?? null)) {
    return NextResponse.json({ error: "Vak niet gevonden" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = vakSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validatiefout", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const vak = await prisma.vak.update({
      where: { id },
      data: {
        naam: parsed.data.naam,
        categorie: parsed.data.categorie,
        beschrijving: parsed.data.beschrijving ?? null,
      },
    });

    return NextResponse.json(vak);
  } catch {
    return NextResponse.json({ error: "Kon vak niet bijwerken" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

  const bestaand = await prisma.vak.findUnique({ where: { id }, select: { schoolId: true } });
  if (!bestaand || bestaand.schoolId !== (session.user.schoolId ?? null)) {
    return NextResponse.json({ error: "Vak niet gevonden" }, { status: 404 });
  }

  try {
    // Controleer of het vak gekoppeld is aan klassen
    const koppelingen = await prisma.klasVak.count({ where: { vakId: id } });

    if (koppelingen > 0) {
      return NextResponse.json(
        {
          error: `Dit vak is gekoppeld aan ${koppelingen} klas${koppelingen !== 1 ? "sen" : ""}. Verwijder eerst de klassenkoppelingen.`,
        },
        { status: 409 }
      );
    }

    await prisma.vak.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Kon vak niet verwijderen" }, { status: 500 });
  }
}
