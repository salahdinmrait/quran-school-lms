import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/docent/huiswerk/[id] — huiswerk verwijderen (vanuit het lesdetail)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const docentId = session.user.id;

  // Alleen huiswerk van een vak in een klas waar deze docent aan gekoppeld is
  const eigen = await prisma.huiswerk.findFirst({
    where: {
      id,
      vak: { klassen: { some: { klas: { docenten: { some: { docentId } } } } } },
    },
    select: { id: true },
  });
  if (!eigen) {
    return NextResponse.json({ error: "Huiswerk niet gevonden" }, { status: 404 });
  }

  try {
    // Alles wat naar dit huiswerk verwijst moet mee, anders blijven er wezen
    // achter (en blokkeren de foreign keys de verwijdering).
    await prisma.$transaction([
      prisma.inlevering.deleteMany({ where: { huiswerkId: id } }),
      prisma.huiswerkLeerling.deleteMany({ where: { huiswerkId: id } }),
      // Hifdh-taken verwijzen optioneel naar dit huiswerk; de taak zelf blijft
      // bestaan, alleen de koppeling vervalt.
      prisma.hifdhTaak.updateMany({ where: { huiswerkId: id }, data: { huiswerkId: null } }),
      prisma.huiswerk.delete({ where: { id } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/docent/huiswerk/[id]]", err);
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
