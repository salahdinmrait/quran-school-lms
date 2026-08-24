import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/klassen/[id]/ranking
// Returns top-3 students ranked by homework submission percentage.
// Accessible by DOCENT (must teach the klas) and LEERLING (must be in the klas).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["DOCENT", "LEERLING"].includes(session.user.role)) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id: klasId } = await params;

  // Verify access
  if (session.user.role === "DOCENT") {
    const link = await prisma.klasDocent.findFirst({
      where: { klasId, docentId: session.user.id },
    });
    if (!link) return NextResponse.json({ error: "Geen toegang tot deze klas" }, { status: 403 });
  } else {
    // LEERLING
    const link = await prisma.klasLeerling.findFirst({
      where: { klasId, leerlingId: session.user.id },
    });
    if (!link) return NextResponse.json({ error: "Geen toegang tot deze klas" }, { status: 403 });
  }

  // Load klas: vakken + leerlingen
  const klas = await prisma.klas.findUnique({
    where: { id: klasId },
    include: {
      vakken: { select: { vakId: true } },
      leerlingen: {
        where: { leerling: { verwijderdOp: null } },
        include: { leerling: { select: { id: true, name: true } } },
      },
    },
  });

  if (!klas) return NextResponse.json({ error: "Klas niet gevonden" }, { status: 404 });

  const vakIds = klas.vakken.map((kv) => kv.vakId);

  // Total homework count for this klas
  const totaalHw = await prisma.huiswerk.count({
    where: { vakId: { in: vakIds } },
  });

  if (totaalHw === 0) {
    return NextResponse.json({ top3: [], totaalHw: 0 });
  }

  const hwIds = (
    await prisma.huiswerk.findMany({
      where: { vakId: { in: vakIds } },
      select: { id: true },
    })
  ).map((h) => h.id);

  // Count submissions per leerling using groupBy
  const counts = await prisma.inlevering.groupBy({
    by: ["leerlingId"],
    where: { huiswerkId: { in: hwIds } },
    _count: { id: true },
  });

  const countMap = new Map(counts.map((c) => [c.leerlingId, c._count.id]));

  // Build ranking for all leerlingen in the klas
  const ranking = klas.leerlingen
    .map((kl) => {
      const aantalAfgevinkt = countMap.get(kl.leerling.id) ?? 0;
      const percentage = Math.round((aantalAfgevinkt / totaalHw) * 100);
      return { leerling: kl.leerling, aantalAfgevinkt, totaal: totaalHw, percentage };
    })
    .sort((a, b) => b.percentage - a.percentage || a.leerling.name.localeCompare(b.leerling.name));

  const top3 = ranking.slice(0, 3).map((item, idx) => ({ positie: idx + 1, ...item }));

  return NextResponse.json({ klasId, klasNaam: klas.naam, top3, totaalHw });
}
