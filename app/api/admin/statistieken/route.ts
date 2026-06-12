import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/statistieken — school-brede statistieken (ADMIN only)
// Zelfde cijfers als de statistieken-pagina op de site, maar als JSON
// zodat ook de mobiele app ze kan tonen.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const schoolId = session.user.schoolId ?? null;

  const [totalLeerlingen, totalDocenten, totalKlassen, totalVakken, vakkenPerCategorie, klassen] =
    await Promise.all([
      prisma.user.count({ where: { role: "LEERLING", actief: true, schoolId } }),
      prisma.user.count({ where: { role: "DOCENT", actief: true, schoolId } }),
      prisma.klas.count({ where: { schoolId } }),
      prisma.vak.count({ where: { schoolId } }),
      prisma.vak.groupBy({ by: ["categorie"], where: { schoolId }, _count: { id: true } }),
      prisma.klas.findMany({
        where: { schoolId },
        orderBy: { naam: "asc" },
        include: {
          leerlingen: { select: { leerlingId: true } },
          vakken: { select: { vakId: true } },
        },
      }),
    ]);

  const perKlas = await Promise.all(
    klassen.map(async (klas) => {
      const leerlingIds = klas.leerlingen.map((kl) => kl.leerlingId);
      const vakIds = klas.vakken.map((kv) => kv.vakId);

      if (leerlingIds.length === 0) {
        return {
          id: klas.id,
          naam: klas.naam,
          leerlingenCount: 0,
          aanwezigheid: null,
          avgCijfer: null,
          hwPercent: null,
        };
      }

      const [aanwAanwezig, aanwTotaal, cijferAgg, totalHw, totalInleveringen] = await Promise.all([
        prisma.aanwezigheid.count({
          where: { leerlingId: { in: leerlingIds }, status: "AANWEZIG", les: { klasId: klas.id } },
        }),
        prisma.aanwezigheid.count({
          where: { leerlingId: { in: leerlingIds }, les: { klasId: klas.id } },
        }),
        prisma.cijfer.aggregate({
          where: { leerlingId: { in: leerlingIds } },
          _avg: { waarde: true },
        }),
        vakIds.length > 0
          ? prisma.huiswerk.count({ where: { vakId: { in: vakIds } } })
          : Promise.resolve(0),
        vakIds.length > 0
          ? prisma.inlevering.count({
              where: {
                leerlingId: { in: leerlingIds },
                huiswerk: { vakId: { in: vakIds } },
              },
            })
          : Promise.resolve(0),
      ]);

      const maxInleveringen = totalHw * leerlingIds.length;

      return {
        id: klas.id,
        naam: klas.naam,
        leerlingenCount: leerlingIds.length,
        aanwezigheid: aanwTotaal > 0 ? Math.round((aanwAanwezig / aanwTotaal) * 100) : null,
        avgCijfer:
          cijferAgg._avg.waarde !== null ? Math.round(cijferAgg._avg.waarde * 10) / 10 : null,
        hwPercent:
          maxInleveringen > 0 ? Math.round((totalInleveringen / maxInleveringen) * 100) : null,
      };
    })
  );

  return NextResponse.json({
    totalen: {
      leerlingen: totalLeerlingen,
      docenten: totalDocenten,
      klassen: totalKlassen,
      vakken: totalVakken,
    },
    perKlas,
    vakkenPerCategorie: vakkenPerCategorie.map((c) => ({
      categorie: c.categorie,
      aantal: c._count.id,
    })),
  });
}
