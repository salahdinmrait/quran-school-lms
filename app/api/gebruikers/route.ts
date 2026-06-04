import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "DOCENT", "LEERLING", "OUDER"]),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const roleFilter = searchParams.get("role");

  const gebruikers = await prisma.user.findMany({
    where: roleFilter ? { role: roleFilter } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, actief: true, createdAt: true },
  });

  return NextResponse.json(gebruikers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Validatiefout" }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (exists) {
      return NextResponse.json({ error: "E-mailadres is al in gebruik" }, { status: 409 });
    }

    const hashedPassword = await hash(parsed.data.password, 12);
    const gebruiker = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: hashedPassword,
        role: parsed.data.role,
      },
    });

    return NextResponse.json(
      { id: gebruiker.id, name: gebruiker.name, email: gebruiker.email, role: gebruiker.role },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Kon gebruiker niet aanmaken" }, { status: 500 });
  }
}
