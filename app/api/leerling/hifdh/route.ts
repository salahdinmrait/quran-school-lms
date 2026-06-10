import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/leerling/hifdh — leerling's own hifdh profiel + taken
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "LEERLING") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 401 });
  }

  const profiel = await prisma.hifdhProfiel.findUnique({
    where: { leerlingId: session.user.id },
    include: {
      taken: { orderBy: [{ weekStart: "asc" }, { type: "asc" }] },
    },
  });

  return NextResponse.json(profiel ?? null);
}
