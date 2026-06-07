import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

  return NextResponse.json(cijfers);
}
