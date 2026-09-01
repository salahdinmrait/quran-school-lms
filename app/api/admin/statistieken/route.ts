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
                // Alleen wat de docent heeft afgetekend telt als 'gedaan'.
                afgevinktOp: { not: null },
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

  // ── Per vak ────────────────────────────────────────────────────────────────
  const vakken = await prisma.vak.findMany({
    where: { schoolId },
    orderBy: { naam: "asc" },
    include: { klassen: { include: { klas: { include: { leerlingen: { select: { leerlingId: true } } } } } } },
  });

  const perVak = await Promise.all(
    vakken.map(async (vak) => {
      const leerlingIds = [
        ...new Set(vak.klassen.flatMap((kv) => kv.klas.leerlingen.map((l) => l.leerlingId))),
      ];
      const [cijferAgg, totalHw, totalInleveringen, aanwAanwezig, aanwTotaal] = await Promise.all([
        prisma.cijfer.aggregate({ where: { vakId: vak.id }, _avg: { waarde: true } }),
        prisma.huiswerk.count({ where: { vakId: vak.id } }),
        prisma.inlevering.count({ where: { huiswerk: { vakId: vak.id }, afgevinktOp: { not: null } } }),
        prisma.aanwezigheid.count({ where: { status: "AANWEZIG", les: { vakId: vak.id } } }),
        prisma.aanwezigheid.count({ where: { les: { vakId: vak.id } } }),
      ]);
      const maxInleveringen = totalHw * leerlingIds.length;
      return {
        id: vak.id,
        naam: vak.naam,
        categorie: vak.categorie,
        avgCijfer: cijferAgg._avg.waarde !== null ? Math.round(cijferAgg._avg.waarde * 10) / 10 : null,
        hwPercent: maxInleveringen > 0 ? Math.round((totalInleveringen / maxInleveringen) * 100) : null,
        aanwezigheid: aanwTotaal > 0 ? Math.round((aanwAanwezig / aanwTotaal) * 100) : null,
      };
    })
  );

  // ── Per docent ─────────────────────────────────────────────────────────────
  const docenten = await prisma.user.findMany({
    where: { role: "DOCENT", actief: true, schoolId },
    orderBy: { name: "asc" },
    include: {
      docentKlassen: {
        include: {
          klas: {
            include: {
              leerlingen: { select: { leerlingId: true } },
              vakken: { select: { vakId: true } },
            },
          },
        },
      },
    },
  });

  const perDocent = await Promise.all(
    docenten.map(async (docent) => {
      const klasIds = docent.docentKlassen.map((kd) => kd.klasId);
      const leerlingIds = [
        ...new Set(docent.docentKlassen.flatMap((kd) => kd.klas.leerlingen.map((l) => l.leerlingId))),
      ];
      const vakIds = [
        ...new Set(docent.docentKlassen.flatMap((kd) => kd.klas.vakken.map((v) => v.vakId))),
      ];
      if (klasIds.length === 0) {
        return { id: docent.id, naam: docent.name, klassen: 0, aanwezigheid: null, avgCijfer: null, hwPercent: null };
      }
      const [aanwAanwezig, aanwTotaal, cijferAgg, totalHw, totalInleveringen] = await Promise.all([
        prisma.aanwezigheid.count({ where: { status: "AANWEZIG", les: { klasId: { in: klasIds } } } }),
        prisma.aanwezigheid.count({ where: { les: { klasId: { in: klasIds } } } }),
        prisma.cijfer.aggregate({ where: { leerlingId: { in: leerlingIds }, vakId: { in: vakIds } }, _avg: { waarde: true } }),
        vakIds.length > 0 ? prisma.huiswerk.count({ where: { vakId: { in: vakIds } } }) : Promise.resolve(0),
        vakIds.length > 0
          ? prisma.inlevering.count({ where: { leerlingId: { in: leerlingIds }, huiswerk: { vakId: { in: vakIds } }, afgevinktOp: { not: null } } })
          : Promise.resolve(0),
      ]);
      const maxInleveringen = totalHw * leerlingIds.length;
      return {
        id: docent.id,
        naam: docent.name,
        klassen: klasIds.length,
        aanwezigheid: aanwTotaal > 0 ? Math.round((aanwAanwezig / aanwTotaal) * 100) : null,
        avgCijfer: cijferAgg._avg.waarde !== null ? Math.round(cijferAgg._avg.waarde * 10) / 10 : null,
        hwPercent: maxInleveringen > 0 ? Math.round((totalInleveringen / maxInleveringen) * 100) : null,
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
    perVak,
    perDocent,
    vakkenPerCategorie: vakkenPerCategorie.map((c) => ({
      categorie: c.categorie,
      aantal: c._count.id,
    })),
  });
}
