import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/leerling/lessen — upcoming lessons for leerling with linked huiswerk + inlevering status
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "LEERLING") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 401 });
  }

  const leerlingId = session.user.id;

  const lessen = await prisma.les.findMany({
    where: {
      klas: { leerlingen: { some: { leerlingId } } },
    },
    orderBy: [{ datum: "asc" }, { begintijd: "asc" }],
    include: {
      klas: { include: { docenten: { include: { docent: { select: { id: true, name: true } } } } } },
      vak: { select: { id: true, naam: true } },
      huiswerk: {
        include: {
          vak: true,
          inleveringen: {
            where: { leerlingId },
            select: { id: true, inhoud: true, createdAt: true },
          },
        },
      },
    },
  });

  // Strip grote base64; expose hasBijlage op les én huiswerk
  const result = lessen.map(({ bijlageData: _d, huiswerk, ...les }) => ({
    ...les,
    hasBijlage: !!les.bijlageNaam,
    docenten: les.klas.docenten.map((kd) => kd.docent),
    huiswerk: huiswerk.map(({ bijlageData: _hd, ...hw }) => ({ ...hw, hasBijlage: !!hw.bijlageNaam })),
  }));

  return NextResponse.json(result);
}
