import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/ouder/kind — get the ouder's linked children with full info
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "OUDER") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const koppelingen = await prisma.ouderLeerling.findMany({
    where: { ouderId: session.user.id },
    include: {
      leerling: {
        include: {
          leerlingKlassen: {
            include: {
              klas: {
                include: {
                  lessen: {
                    orderBy: [{ datum: "asc" }, { begintijd: "asc" }],
                    include: {
                      vak: true,
                      huiswerk: {
                        include: {
                          vak: true,
                          // Alle inleveringen, zodat de UI op het kind kan
                          // filteren. `afgevinktOp` erbij: een rij betekent
                          // sinds het splitsen van inleveren en afvinken niet
                          // meer vanzelf dat het huiswerk gedaan is.
                          inleveringen: {
                            select: { leerlingId: true, ingeleverdOp: true, afgevinktOp: true },
                          },
                        },
                      },
                    },
                  },
                  vakken: { include: { vak: true } },
                  docenten: {
                    include: {
                      docent: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
          cijfers: {
            orderBy: { datum: "desc" },
            include: { vak: true },
            take: 20,
          },
          aanwezigheid: {
            orderBy: { les: { datum: "desc" } },
            take: 20,
            include: { les: { include: { klas: true, vak: true } } },
          },
        },
      },
    },
  });

  // Strip grote base64 uit cijfer-bijlagen
  return NextResponse.json(
    koppelingen.map((k) => ({
      ...k.leerling,
      cijfers: k.leerling.cijfers.map(({ bijlageData: _d, ...c }) => ({
        ...c,
        hasBijlage: !!c.bijlageNaam,
      })),
    }))
  );
}
