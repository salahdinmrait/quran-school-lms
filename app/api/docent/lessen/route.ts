import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/docent/lessen — lessen for the logged-in docent's klassen
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const docentId = session.user.id;

  const lessen = await prisma.les.findMany({
    where: {
      klas: { docenten: { some: { docentId } } },
    },
    orderBy: [{ datum: "desc" }, { begintijd: "asc" }],
    include: {
      klas: {
        include: {
          leerlingen: { include: { leerling: { select: { id: true, name: true } } } },
          vakken: { include: { vak: true } },
        },
      },
    },
  });

  return NextResponse.json(lessen);
}
