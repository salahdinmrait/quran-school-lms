import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/leerling/contacten — docenten van de eigen klassen + admins van de school.
// Gebruikt door 18+-leerlingen om zelf een gesprek te starten.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "LEERLING") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const leerlingId = session.user.id;

  const [klasDocenten, admins] = await Promise.all([
    prisma.klasDocent.findMany({
      where: {
        klas: { verwijderdOp: null, leerlingen: { some: { leerlingId } } },
        docent: { verwijderdOp: null },
      },
      include: { docent: { select: { id: true, name: true } } },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN", actief: true, verwijderdOp: null, schoolId: session.user.schoolId ?? null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const docenten = Array.from(
    new Map(klasDocenten.map((kd) => [kd.docent.id, kd.docent])).values()
  );

  return NextResponse.json({ docenten, admins });
}
