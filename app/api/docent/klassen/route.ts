import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { leerlingenMetOudersInclude, oudersVanKlas } from "@/lib/berichten-doelen";

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
          leerlingen: leerlingenMetOudersInclude,
        },
      },
    },
  });

  const klassen = klasDocenten.map(({ klas }) => ({
    id: klas.id,
    naam: klas.naam,
    vakken: klas.vakken.map((kv) => ({ id: kv.vak.id, naam: kv.vak.naam, categorie: kv.vak.categorie })),
    leerlingen: klas.leerlingen.map(({ leerling }) => ({ id: leerling.id, name: leerling.name, email: leerling.email })),
    // Gededupliceerd, maar mét alle kinderen per ouder.
    ouders: oudersVanKlas(klas.leerlingen),
  }));

  return NextResponse.json(klassen);
}
