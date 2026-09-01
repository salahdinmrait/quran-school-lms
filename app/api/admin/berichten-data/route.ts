import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { leerlingenMetOudersInclude, oudersVanKlas } from "@/lib/berichten-doelen";

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
      include: { leerlingen: leerlingenMetOudersInclude },
    }),
    prisma.user.findMany({
      where: { schoolId: session.user.schoolId ?? null, role: "DOCENT", actief: true, verwijderdOp: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const result = klassen.map((klas) => ({
    id: klas.id,
    naam: klas.naam,
    leerlingen: klas.leerlingen.map(({ leerling }) => ({ id: leerling.id, name: leerling.name, email: leerling.email })),
    ouders: oudersVanKlas(klas.leerlingen),
  }));

  return NextResponse.json({ klassen: result, docenten });
}
