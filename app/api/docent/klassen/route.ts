import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/docent/klassen — klassen for the logged-in docent (with leerlingen + ouders)
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
          vakken: { include: { vak: true } },
          leerlingen: {
            include: {
              leerling: {
                select: {
                  id: true,
                  name: true,
                  // Ouder(s) of this leerling
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
      },
    },
  });

  const klassen = klasDocenten.map(({ klas }) => ({
    id: klas.id,
    naam: klas.naam,
    vakken: klas.vakken.map((kv) => ({ id: kv.vak.id, naam: kv.vak.naam, categorie: kv.vak.categorie })),
    leerlingen: klas.leerlingen.map(({ leerling }) => ({
      id: leerling.id,
      name: leerling.name,
    })),
    // Deduplicated ouders across all leerlingen in this klas
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

  return NextResponse.json(klassen);
}
