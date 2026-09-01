import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "LEERLING") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 401 });
  }

  const leerlingId = session.user.id;

  const [klassen, recenteCijfers, openHuiswerk, ongelezen, aanwezigheidStats] = await Promise.all([
    prisma.klasLeerling.findMany({
      where: { leerlingId },
      include: {
        klas: {
          include: { vakken: { include: { vak: true }, take: 4 } },
        },
      },
    }),
    prisma.cijfer.findMany({
      where: { leerlingId },
      orderBy: { datum: "desc" },
      take: 5,
      include: { vak: true },
    }),
    prisma.huiswerk.findMany({
      where: {
        vak: {
          klassen: { some: { klas: { leerlingen: { some: { leerlingId } } } } },
        },
        // Gericht huiswerk hoort alleen bij de leerling voor wie het bedoeld is;
        // een lege doellijst betekent "hele klas".
        OR: [
          { doelLeerlingen: { none: {} } },
          { doelLeerlingen: { some: { leerlingId } } },
        ],
        // Open = nog niet afgevinkt door de docent. Zelf ingeleverd werk dat
        // nog wacht op de docent blijft dus in de lijst staan.
        inleveringen: { none: { leerlingId, afgevinktOp: { not: null } } },
      },
      take: 5,
      orderBy: [{ les: { datum: "desc" } }, { id: "desc" }],
      // Expliciet selecteren: bijlageData (base64, tot 4 MB) hoort nooit in een lijst.
      select: {
        id: true,
        titel: true,
        vak: { select: { id: true, naam: true, categorie: true } },
      },
    }),
    prisma.bericht.count({ where: { ontvangerId: leerlingId, gelezen: false } }),
    prisma.aanwezigheid.groupBy({
      by: ["status"],
      where: { leerlingId },
      _count: { id: true },
    }),
  ]);

  const totaalLessen = aanwezigheidStats.reduce((s, a) => s + a._count.id, 0);
  const aanwezig = aanwezigheidStats.find((s) => s.status === "AANWEZIG")?._count.id ?? 0;
  const aanwezigPct = totaalLessen > 0 ? Math.round((aanwezig / totaalLessen) * 100) : null;

  return NextResponse.json({
    name: session.user.name,
    recenteCijfers,
    openHuiswerk,
    klassen,
    aanwezigPct,
    totaalLessen,
    ongelezen,
  });
}
