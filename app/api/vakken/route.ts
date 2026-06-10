import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { vakSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  try {
    const vakken = await prisma.vak.findMany({
      where: { schoolId: session.user.schoolId ?? null },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { klassen: true },
        },
      },
    });
    return NextResponse.json(vakken);
  } catch {
    return NextResponse.json({ error: "Kon vakken niet ophalen" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = vakSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validatiefout", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const vak = await prisma.vak.create({
      data: {
        naam: parsed.data.naam,
        categorie: parsed.data.categorie,
        beschrijving: parsed.data.beschrijving ?? null,
        schoolId: session.user.schoolId ?? null,
      },
    });

    return NextResponse.json(vak, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kon vak niet aanmaken" }, { status: 500 });
  }
}
