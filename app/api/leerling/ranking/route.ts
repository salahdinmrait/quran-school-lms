import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/leerling/ranking
// Returns the top-3 + own position for every klas the leerling is enrolled in.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "LEERLING") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const leerlingId = session.user.id;

  // All klassen the leerling is in
  const inschrijvingen = await prisma.klasLeerling.findMany({
    where: { leerlingId },
    include: {
      klas: {
        include: {
          vakken: { select: { vakId: true } },
          leerlingen: {
            include: { leerling: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  const results = await Promise.all(
    inschrijvingen.map(async ({ klas }) => {
      const vakIds = klas.vakken.map((kv) => kv.vakId);

      const totaalHw = await prisma.huiswerk.count({
        where: { vakId: { in: vakIds } },
      });

      if (totaalHw === 0) {
        return {
          klasId: klas.id,
          klasNaam: klas.naam,
          top3: [],
          totaalHw: 0,
          eigenPositie: null,
          eigenPercentage: 0,
        };
      }

      const hwIds = (
        await prisma.huiswerk.findMany({
          where: { vakId: { in: vakIds } },
          select: { id: true },
        })
      ).map((h) => h.id);

      const counts = await prisma.inlevering.groupBy({
        by: ["leerlingId"],
        where: { huiswerkId: { in: hwIds } },
        _count: { id: true },
      });

      const countMap = new Map(counts.map((c) => [c.leerlingId, c._count.id]));

      const ranking = klas.leerlingen
        .map((kl) => {
          const aantalIngeleverd = countMap.get(kl.leerling.id) ?? 0;
          const percentage = Math.round((aantalIngeleverd / totaalHw) * 100);
          return { leerling: kl.leerling, aantalIngeleverd, totaal: totaalHw, percentage };
        })
        .sort(
          (a, b) =>
            b.percentage - a.percentage ||
            a.leerling.name.localeCompare(b.leerling.name)
        );

      const eigenIndex = ranking.findIndex((r) => r.leerling.id === leerlingId);
      const eigenEntry = ranking[eigenIndex];

      const top3 = ranking.slice(0, 3).map((item, idx) => ({
        positie: idx + 1,
        ...item,
        // Hide names of others for privacy — show "Leerling X" unless it's themselves
        leerling: {
          id: item.leerling.id,
          name:
            item.leerling.id === leerlingId
              ? item.leerling.name
              : item.leerling.name, // docent sees all names; leerling also sees all (competitive ranking)
        },
      }));

      return {
        klasId: klas.id,
        klasNaam: klas.naam,
        top3,
        totaalHw,
        eigenPositie: eigenIndex + 1, // 1-based
        eigenPercentage: eigenEntry?.percentage ?? 0,
        aantalLeerlingen: ranking.length,
      };
    })
  );

  return NextResponse.json(results);
}
