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
      // Zelfde vorm als /api/leerling/lessen, zodat de ouder hetzelfde
      // lesdetail te zien krijgt als het kind zelf.
      const lessenRaw = await prisma.les.findMany({
        where: {
          klas: { leerlingen: { some: { leerlingId: k.leerlingId } } },
        },
        orderBy: [{ datum: "asc" }, { begintijd: "asc" }],
        include: {
          klas: {
            select: {
              id: true,
              naam: true,
              docenten: { include: { docent: { select: { id: true, name: true } } } },
            },
          },
          vak: { select: { id: true, naam: true } },
          // Alleen huiswerk dat voor dít kind bedoeld is: leeg doellijstje =
          // hele klas, anders moet het kind erin staan.
          huiswerk: {
            where: {
              OR: [
                { doelLeerlingen: { none: {} } },
                { doelLeerlingen: { some: { leerlingId: k.leerlingId } } },
              ],
            },
            include: {
              vak: { select: { id: true, naam: true } },
              inleveringen: {
                where: { leerlingId: k.leerlingId },
                select: { id: true, ingeleverdOp: true, afgevinktOp: true },
              },
            },
          },
          aanwezigheid: {
            where: { leerlingId: k.leerlingId },
            select: { status: true },
          },
        },
      });

      const lessen = lessenRaw.map(({ bijlageData: _d, huiswerk, ...les }) => ({
        ...les,
        hasBijlage: !!les.bijlageNaam,
        docenten: les.klas.docenten.map((kd) => kd.docent),
        huiswerk: huiswerk.map(({ bijlageData: _hd, deadline: _dl, ...hw }) => ({
          ...hw,
          hasBijlage: !!hw.bijlageNaam,
        })),
      }));

      return { kind: k.leerling, lessen };
    })
  );

  return NextResponse.json(result);
}
