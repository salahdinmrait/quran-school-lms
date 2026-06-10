import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/berichten-data — all klassen with leerlingen + ouders (ADMIN only)
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const klassen = await prisma.klas.findMany({
    where: { schoolId: session.user.schoolId ?? null },
    orderBy: { naam: "asc" },
    include: {
      leerlingen: {
        include: {
          leerling: {
            select: {
              id: true,
              name: true,
              kindVan: {
                select: {
                  ouder: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const result = klassen.map((klas) => ({
    id: klas.id,
    naam: klas.naam,
    leerlingen: klas.leerlingen.map(({ leerling }) => ({
      id: leerling.id,
      name: leerling.name,
    })),
    ouders: Array.from(
      new Map(
        klas.leerlingen
          .flatMap(({ leerling }) =>
            leerling.kindVan.map(({ ouder }) => ({
              id: ouder.id,
              name: ouder.name,
              kindNaam: leerling.name,
            }))
          )
          .map((o) => [o.id, o])
      ).values()
    ),
  }));

  return NextResponse.json(result);
}
