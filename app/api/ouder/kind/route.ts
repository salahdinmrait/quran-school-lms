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
                          // include all inleveringen so the UI can filter by child's ID
                          inleveringen: { select: { leerlingId: true } },
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
          hifdhProfiel: {
            include: { taken: { orderBy: { weekStart: "asc" } } },
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

  return NextResponse.json(koppelingen.map((k) => k.leerling));
}
