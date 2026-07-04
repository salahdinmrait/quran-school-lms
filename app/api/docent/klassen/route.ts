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
    where: { docentId, klas: { verwijderdOp: null } },
    include: {
      klas: {
        include: {
          vakken: { where: { vak: { verwijderdOp: null } }, include: { vak: true } },
          leerlingen: {
            where: { leerling: { verwijderdOp: null } },
            include: {
              leerling: {
                select: {
                  id: true,
                  name: true,
                  // Ouder(s) of this leerling
                  kindVan: {
                    where: { ouder: { verwijderdOp: null } },
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

  const klassen = klasDocenten.map(({ klas }) => {
    // Ouders dedupliceren, maar ALLE kinderen per ouder verzamelen (niet alleen de eerste)
    const ouderMap = new Map<string, { id: string; name: string; kinderen: string[] }>();
    for (const { leerling } of klas.leerlingen) {
      for (const { ouder } of leerling.kindVan) {
        const bestaand = ouderMap.get(ouder.id);
        if (bestaand) {
          if (!bestaand.kinderen.includes(leerling.name)) bestaand.kinderen.push(leerling.name);
        } else {
          ouderMap.set(ouder.id, { id: ouder.id, name: ouder.name, kinderen: [leerling.name] });
        }
      }
    }

    return {
      id: klas.id,
      naam: klas.naam,
      vakken: klas.vakken.map((kv) => ({ id: kv.vak.id, naam: kv.vak.naam, categorie: kv.vak.categorie })),
      leerlingen: klas.leerlingen.map(({ leerling }) => ({ id: leerling.id, name: leerling.name })),
      ouders: Array.from(ouderMap.values()).map((o) => ({
        id: o.id,
        name: o.name,
        kinderen: o.kinderen,
        kindNaam: o.kinderen.join(", "), // backwards-compat: alle kinderen samengevoegd
      })),
    };
  });

  return NextResponse.json(klassen);
}
