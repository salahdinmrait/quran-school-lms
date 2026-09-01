import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/docent/statistieken — eigen statistieken van de docent
// (aanwezigheid %, gemiddelde, huiswerk-voltooiing) per eigen klas en per eigen vak.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const docentId = session.user.id;

  const klasDocenten = await prisma.klasDocent.findMany({
    where: { docentId },
    include: {
      klas: {
        include: {
          leerlingen: { select: { leerlingId: true } },
          vakken: { include: { vak: true } },
        },
      },
    },
  });

  const klassen = klasDocenten.map((kd) => kd.klas);
  const alleLeerlingIds = [...new Set(klassen.flatMap((k) => k.leerlingen.map((l) => l.leerlingId)))];
  const alleVakken = Array.from(
    new Map(klassen.flatMap((k) => k.vakken.map((kv) => [kv.vak.id, kv.vak])) as [string, { id: string; naam: string; categorie: string }][]).values()
  );

  const perKlas = await Promise.all(
    klassen.map(async (klas) => {
      const leerlingIds = klas.leerlingen.map((l) => l.leerlingId);
      const vakIds = klas.vakken.map((kv) => kv.vak.id);
      if (leerlingIds.length === 0) {
        return { id: klas.id, naam: klas.naam, leerlingenCount: 0, aanwezigheid: null, avgCijfer: null, hwPercent: null };
      }
      const [aanwAanwezig, aanwTotaal, cijferAgg, totalHw, totalInleveringen] = await Promise.all([
        prisma.aanwezigheid.count({ where: { status: "AANWEZIG", les: { klasId: klas.id } } }),
        prisma.aanwezigheid.count({ where: { les: { klasId: klas.id } } }),
        prisma.cijfer.aggregate({ where: { leerlingId: { in: leerlingIds }, vakId: { in: vakIds } }, _avg: { waarde: true } }),
        vakIds.length > 0 ? prisma.huiswerk.count({ where: { vakId: { in: vakIds } } }) : Promise.resolve(0),
        vakIds.length > 0
          ? prisma.inlevering.count({ where: { leerlingId: { in: leerlingIds }, huiswerk: { vakId: { in: vakIds } }, afgevinktOp: { not: null } } })
          : Promise.resolve(0),
      ]);
      const maxInleveringen = totalHw * leerlingIds.length;
      return {
        id: klas.id,
        naam: klas.naam,
        leerlingenCount: leerlingIds.length,
        aanwezigheid: aanwTotaal > 0 ? Math.round((aanwAanwezig / aanwTotaal) * 100) : null,
        avgCijfer: cijferAgg._avg.waarde !== null ? Math.round(cijferAgg._avg.waarde * 10) / 10 : null,
        hwPercent: maxInleveringen > 0 ? Math.round((totalInleveringen / maxInleveringen) * 100) : null,
      };
    })
  );

  const perVak = await Promise.all(
    alleVakken.map(async (vak) => {
      const [cijferAgg, totalHw, totalInleveringen] = await Promise.all([
        prisma.cijfer.aggregate({ where: { vakId: vak.id, leerlingId: { in: alleLeerlingIds } }, _avg: { waarde: true } }),
        prisma.huiswerk.count({ where: { vakId: vak.id } }),
        prisma.inlevering.count({ where: { huiswerk: { vakId: vak.id }, leerlingId: { in: alleLeerlingIds }, afgevinktOp: { not: null } } }),
      ]);
      const maxInleveringen = totalHw * alleLeerlingIds.length;
      return {
        id: vak.id,
        naam: vak.naam,
        categorie: vak.categorie,
        avgCijfer: cijferAgg._avg.waarde !== null ? Math.round(cijferAgg._avg.waarde * 10) / 10 : null,
        hwPercent: maxInleveringen > 0 ? Math.round((totalInleveringen / maxInleveringen) * 100) : null,
      };
    })
  );

  return NextResponse.json({
    totalen: { klassen: klassen.length, leerlingen: alleLeerlingIds.length, vakken: alleVakken.length },
    perKlas,
    perVak,
  });
}
