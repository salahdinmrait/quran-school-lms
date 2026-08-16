import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/docent/lessen — lessen for the logged-in docent's klassen
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const docentId = session.user.id;

  const lessen = await prisma.les.findMany({
    where: {
      klas: { docenten: { some: { docentId } } },
    },
    orderBy: [{ datum: "desc" }, { begintijd: "asc" }],
    include: {
      klas: {
        include: {
          leerlingen: { include: { leerling: { select: { id: true, name: true } } } },
          vakken: { include: { vak: true } },
        },
      },
      vak: true,
      _count: { select: { huiswerk: true } },
    },
  });

  // bijlageData is base64 en kan megabytes per les zijn — nooit in een lijst
  // meesturen. De app haalt de bijlage zelf op via /api/attachment/les/[id].
  const result = lessen.map(({ bijlageData: _d, _count, ...l }) => ({
    ...l,
    hasBijlage: !!l.bijlageNaam,
    huiswerkAantal: _count.huiswerk,
  }));

  return NextResponse.json(result);
}
