import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

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
