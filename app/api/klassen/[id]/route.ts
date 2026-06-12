import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

async function getOwnedKlas(id: string, schoolId: string | null) {
  const klas = await prisma.klas.findUnique({ where: { id } });
  if (!klas || klas.schoolId !== schoolId) return null;
  return klas;
}

// GET /api/klassen/[id] — klasdetail met koppelingen (admin, eigen school)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const klas = await prisma.klas.findUnique({
    where: { id },
    include: {
      docenten: { include: { docent: { select: { id: true, name: true, email: true } } } },
      leerlingen: { include: { leerling: { select: { id: true, name: true, email: true } } } },
      vakken: { include: { vak: true } },
    },
  });

  if (!klas || klas.schoolId !== (session.user.schoolId ?? null)) {
    return NextResponse.json({ error: "Klas niet gevonden" }, { status: 404 });
  }

  return NextResponse.json(klas);
}

// PATCH /api/klassen/[id] — naam/beschrijving wijzigen (admin, eigen school)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  if (!(await getOwnedKlas(id, session.user.schoolId ?? null))) {
    return NextResponse.json({ error: "Klas niet gevonden" }, { status: 404 });
  }

  const { naam, beschrijving } = await req.json();
  if (naam !== undefined && (typeof naam !== "string" || naam.trim().length < 2)) {
    return NextResponse.json({ error: "Naam moet minimaal 2 tekens bevatten" }, { status: 400 });
  }

  try {
    const klas = await prisma.klas.update({
      where: { id },
      data: {
        ...(naam !== undefined ? { naam: naam.trim() } : {}),
        ...(beschrijving !== undefined ? { beschrijving: beschrijving || null } : {}),
      },
    });
    return NextResponse.json(klas);
  } catch {
    return NextResponse.json({ error: "Bijwerken mislukt" }, { status: 500 });
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
  if (!(await getOwnedKlas(id, session.user.schoolId ?? null))) {
    return NextResponse.json({ error: "Klas niet gevonden" }, { status: 404 });
  }

  try {
    // Delete in order to respect FK constraints
    // First delete aanwezigheid for lessen in this klas
    const lesIds = (await prisma.les.findMany({ where: { klasId: id }, select: { id: true } }))
      .map((l) => l.id);

    if (lesIds.length > 0) {
      await prisma.aanwezigheid.deleteMany({ where: { lesId: { in: lesIds } } });
      // Delete inleveringen for huiswerk linked to these lessen
      const hwIds = (await prisma.huiswerk.findMany({ where: { lesId: { in: lesIds } }, select: { id: true } }))
        .map((h) => h.id);
      if (hwIds.length > 0) {
        await prisma.inlevering.deleteMany({ where: { huiswerkId: { in: hwIds } } });
        await prisma.huiswerk.deleteMany({ where: { id: { in: hwIds } } });
      }
      await prisma.les.deleteMany({ where: { klasId: id } });
    }

    await prisma.klasDocent.deleteMany({ where: { klasId: id } });
    await prisma.klasLeerling.deleteMany({ where: { klasId: id } });
    await prisma.klasVak.deleteMany({ where: { klasId: id } });
    await prisma.klas.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
