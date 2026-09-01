import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/ouder/huiswerk — homework for all linked children
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
      const huiswerk = await prisma.huiswerk.findMany({
        where: {
          vak: {
            klassen: {
              some: {
                klas: { leerlingen: { some: { leerlingId: k.leerlingId } } },
              },
            },
          },
          // Gericht huiswerk hoort alleen bij het kind waarvoor het bedoeld is;
          // leeg = voor iedereen met dat vak. Dezelfde regel als bij de leerling.
          OR: [
            { doelLeerlingen: { none: {} } },
            { doelLeerlingen: { some: { leerlingId: k.leerlingId } } },
          ],
        },
        orderBy: [{ les: { datum: "desc" } }, { id: "desc" }],
        include: {
          vak: { select: { naam: true, categorie: true } },
          les: { select: { id: true, datum: true } },
          inleveringen: {
            where: { leerlingId: k.leerlingId },
            select: {
              id: true, inhoud: true, createdAt: true, opmerking: true, opmerkingOp: true,
              bijlageNaam: true, ingeleverdOp: true, afgevinktOp: true,
            },
          },
        },
      });

      return {
        kind: k.leerling,
        huiswerk: huiswerk.map((hw) => ({
          id: hw.id,
          titel: hw.titel,
          beschrijving: hw.beschrijving,
          vak: hw.vak,
          lesId: hw.lesId,
          lesDatum: hw.les?.datum.toISOString() ?? null,
          bijlageNaam: hw.bijlageNaam ?? null,
          hasBijlage: !!hw.bijlageNaam,
          // Afgevinkt = door de docent afgetekend; ingeleverd = het kind heeft
          // zelf iets ingestuurd dat nog op de docent wacht.
          afgevinkt: !!hw.inleveringen[0]?.afgevinktOp,
          ingeleverd: !!hw.inleveringen[0]?.ingeleverdOp,
          inlevering: hw.inleveringen[0]
            ? { ...hw.inleveringen[0], hasBijlage: !!hw.inleveringen[0].bijlageNaam }
            : null,
        })),
      };
    })
  );

  return NextResponse.json(result);
}
