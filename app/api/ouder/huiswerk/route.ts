import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
        },
        orderBy: { deadline: "asc" },
        include: {
          vak: { select: { naam: true, categorie: true } },
          inleveringen: {
            where: { leerlingId: k.leerlingId },
            select: { inhoud: true, createdAt: true, opmerking: true },
          },
        },
      });

      return {
        kind: k.leerling,
        huiswerk: huiswerk.map((hw) => ({
          id: hw.id,
          titel: hw.titel,
          beschrijving: hw.beschrijving,
          deadline: hw.deadline,
          vak: hw.vak,
          ingeLeverd: hw.inleveringen.length > 0,
          inlevering: hw.inleveringen[0] ?? null,
        })),
      };
    })
  );

  return NextResponse.json(result);
}
