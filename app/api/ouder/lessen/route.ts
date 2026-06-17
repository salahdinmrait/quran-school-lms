import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/ouder/lessen — upcoming lessons for all linked children
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "OUDER") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const koppelingen = await prisma.ouderLeerling.findMany({
    where: { ouderId: session.user.id },
    select: { leerlingId: true, leerling: { select: { id: true, name: true } } },
  });

  const result = await Promise.all(
    koppelingen.map(async (k) => {
      const lessenRaw = await prisma.les.findMany({
        where: {
          klas: { leerlingen: { some: { leerlingId: k.leerlingId } } },
        },
        orderBy: [{ datum: "asc" }, { begintijd: "asc" }],
        include: {
          klas: { select: { naam: true, docenten: { include: { docent: { select: { id: true, name: true } } } } } },
          vak: { select: { naam: true } },
          aanwezigheid: {
            where: { leerlingId: k.leerlingId },
            select: { status: true },
          },
        },
      });

      const lessen = lessenRaw.map(({ bijlageData: _d, ...les }) => ({
        ...les,
        hasBijlage: !!les.bijlageNaam,
        docenten: les.klas.docenten.map((kd) => kd.docent),
      }));

      return { kind: k.leerling, lessen };
    })
  );

  return NextResponse.json(result);
}
