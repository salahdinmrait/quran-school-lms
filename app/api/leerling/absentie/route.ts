import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "LEERLING") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 401 });
  }

  const aanwezigheid = await prisma.aanwezigheid.findMany({
    where: { leerlingId: session.user.id },
    orderBy: { les: { datum: "desc" } },
    include: {
      les: {
        include: {
          klas: { select: { naam: true } },
          vak: { select: { naam: true } },
        },
      },
    },
    take: 50,
  });

  return NextResponse.json(aanwezigheid);
}
