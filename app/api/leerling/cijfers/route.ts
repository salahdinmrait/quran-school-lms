import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "LEERLING") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 401 });
  }

  const cijfers = await prisma.cijfer.findMany({
    where: { leerlingId: session.user.id },
    orderBy: { datum: "desc" },
    include: { vak: { select: { id: true, naam: true, categorie: true } } },
  });

  // Strip grote base64; expose hasBijlage (download via /api/attachment/cijfer/[id])
  const result = cijfers.map(({ bijlageData: _d, ...c }) => ({ ...c, hasBijlage: !!c.bijlageNaam }));
  return NextResponse.json(result);
}
