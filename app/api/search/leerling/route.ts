import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/search/leerling?q=naam
// ADMIN: search all leerlingen
// DOCENT: search only leerlingen in their klassen
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length < 2) return NextResponse.json([]);

  const docentId = session.user.id;
  const isAdmin = session.user.role === "ADMIN";

  // Scope where clause for leerling lookup
  const leerlingWhere = {
    role: "LEERLING",
    actief: true,
    // Gearchiveerde leerlingen horen niet in een zoekresultaat.
    verwijderdOp: null,
    schoolId: session.user.schoolId ?? null,
    // Zoeken op naam én e-mail — twee leerlingen met dezelfde naam zijn
    // alleen aan hun adres uit elkaar te houden.
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { email: { contains: q, mode: "insensitive" as const } },
    ],
    ...(isAdmin ? {} : {
      leerlingKlassen: {
        some: { klas: { docenten: { some: { docentId } } } },
      },
    }),
  };

  const leerlingen = await prisma.user.findMany({
    where: leerlingWhere,
    select: {
      id: true,
      name: true,
      email: true,
      leerlingKlassen: { select: { klas: { select: { id: true, naam: true } } } },
    },
    take: 10,
    orderBy: { name: "asc" },
  });

  if (leerlingen.length === 0) return NextResponse.json([]);

  const leerlingIds = leerlingen.map((l) => l.id);

  // Batch fetch stats for all matching leerlingen
  const [aanwezigheid, cijferAgg, inleveringen, totaalHuiswerk] = await Promise.all([
    // Attendance counts per leerling
    prisma.aanwezigheid.groupBy({
      by: ["leerlingId", "status"],
      where: { leerlingId: { in: leerlingIds } },
      _count: { id: true },
    }),
    // Cijfers per leerling
    prisma.cijfer.groupBy({
      by: ["leerlingId"],
      where: { leerlingId: { in: leerlingIds } },
      _avg: { waarde: true },
    }),
    // Inleveringen count per leerling
    prisma.inlevering.groupBy({
      by: ["leerlingId"],
      where: { leerlingId: { in: leerlingIds } },
      _count: { id: true },
    }),
    // Al het huiswerk van de klassen waar deze leerlingen in zitten. Eén query
    // voor de hele lijst; het toerekenen per leerling gebeurt hieronder in JS.
    prisma.huiswerk.findMany({
      where: {
        vak: {
          klassen: { some: { klas: { leerlingen: { some: { leerlingId: { in: leerlingIds } } } } } },
        },
      },
      select: {
        id: true,
        vak: { select: { klassen: { select: { klasId: true } } } },
        doelLeerlingen: { select: { leerlingId: true } },
      },
    }),
  ]);

  // Index by leerlingId for O(1) lookup
  const aanwMap = new Map<string, { aanwezig: number; totaal: number }>();
  for (const row of aanwezigheid) {
    if (!aanwMap.has(row.leerlingId)) {
      aanwMap.set(row.leerlingId, { aanwezig: 0, totaal: 0 });
    }
    const entry = aanwMap.get(row.leerlingId)!;
    entry.totaal += row._count.id;
    if (row.status === "AANWEZIG") entry.aanwezig += row._count.id;
  }

  const cijferMap = new Map<string, number | null>();
  for (const row of cijferAgg) {
    cijferMap.set(row.leerlingId, row._avg.waarde ?? null);
  }

  const invMap = new Map<string, number>();
  for (const row of inleveringen) {
    invMap.set(row.leerlingId, row._count.id);
  }

  // Per leerling tellen: huiswerk van een klas waar hij in zit, en dan alleen
  // als het voor de hele klas is (lege doellijst) of hij er zelf bij staat.
  const klassenPerLeerling = new Map<string, Set<string>>(
    leerlingen.map((l) => [l.id, new Set(l.leerlingKlassen.map((kl) => kl.klas.id))])
  );
  const hwMap = new Map<string, number>();
  for (const hw of totaalHuiswerk) {
    const klasIds = hw.vak.klassen.map((k) => k.klasId);
    const doel = hw.doelLeerlingen.map((d) => d.leerlingId);
    for (const leerlingId of leerlingIds) {
      if (doel.length > 0 && !doel.includes(leerlingId)) continue;
      const eigenKlassen = klassenPerLeerling.get(leerlingId);
      if (!eigenKlassen || !klasIds.some((k) => eigenKlassen.has(k))) continue;
      hwMap.set(leerlingId, (hwMap.get(leerlingId) ?? 0) + 1);
    }
  }

  const result = leerlingen.map((l) => {
    const aanw = aanwMap.get(l.id);
    const avg = cijferMap.get(l.id) ?? null;
    const inlevCount = invMap.get(l.id) ?? 0;
    const hwTotal = hwMap.get(l.id) ?? 0;

    return {
      id: l.id,
      name: l.name,
      email: l.email,
      klasNamen: l.leerlingKlassen.map((kl) => kl.klas.naam),
      avgCijfer: avg !== null ? Math.round(avg * 10) / 10 : null,
      aanwezigheidsPercentage: aanw && aanw.totaal > 0
        ? Math.round((aanw.aanwezig / aanw.totaal) * 100)
        : null,
      huiswerkPercentage: hwTotal > 0
        ? Math.round((inlevCount / hwTotal) * 100)
        : null,
    };
  });

  return NextResponse.json(result);
}
