import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { klasSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const klassen = await prisma.klas.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leerlingen: true, docenten: true, vakken: true } } },
  });
  return NextResponse.json(klassen);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = klasSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validatiefout" }, { status: 400 });

    const klas = await prisma.klas.create({
      data: { naam: parsed.data.naam, beschrijving: parsed.data.beschrijving ?? null },
    });
    return NextResponse.json(klas, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kon klas niet aanmaken" }, { status: 500 });
  }
}
