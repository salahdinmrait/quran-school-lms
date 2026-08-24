import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/berichten-data — klassen met leerlingen + ouders, plus alle
// docenten van de school (ADMIN only)
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const [klassen, docenten] = await Promise.all([
    prisma.klas.findMany({
      where: { schoolId: session.user.schoolId ?? null, verwijderdOp: null },
      orderBy: { naam: "asc" },
      include: {
        leerlingen: {
          where: { leerling: { verwijderdOp: null } },
          include: {
            leerling: {
              select: {
                id: true,
                name: true,
                // E-mail hoort erbij: de zoekbalk zoekt op naam én adres.
                email: true,
                kindVan: {
                  where: { ouder: { verwijderdOp: null } },
                  select: {
                    ouder: { select: { id: true, name: true, email: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { schoolId: session.user.schoolId ?? null, role: "DOCENT", actief: true, verwijderdOp: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const result = klassen.map((klas) => {
    const ouderMap = new Map<string, { id: string; name: string; email: string; kinderen: string[] }>();
    for (const { leerling } of klas.leerlingen) {
      for (const { ouder } of leerling.kindVan) {
        const bestaand = ouderMap.get(ouder.id);
        if (bestaand) {
          if (!bestaand.kinderen.includes(leerling.name)) bestaand.kinderen.push(leerling.name);
        } else {
          ouderMap.set(ouder.id, { id: ouder.id, name: ouder.name, email: ouder.email, kinderen: [leerling.name] });
        }
      }
    }
    return {
      id: klas.id,
      naam: klas.naam,
      leerlingen: klas.leerlingen.map(({ leerling }) => ({ id: leerling.id, name: leerling.name, email: leerling.email })),
      ouders: Array.from(ouderMap.values()).map((o) => ({
        id: o.id,
        name: o.name,
        email: o.email,
        kinderen: o.kinderen,
        kindNaam: o.kinderen.join(", "),
      })),
    };
  });

  return NextResponse.json({ klassen: result, docenten });
}
