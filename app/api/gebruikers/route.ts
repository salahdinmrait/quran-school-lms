import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import { leesJson } from "@/lib/json-body";
import { isUniekFout } from "@/lib/prisma-fouten";

const schema = z.object({
  name: z.string().min(2),
  // Inloggen normaliseert het adres al (lib/auth.ts). Doet aanmaken dat niet,
  // dan bestaan "Jan@x.nl" en "jan@x.nl" naast elkaar en kan er maar één in.
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "DOCENT", "LEERLING", "OUDER"]),
  telefoon: z.string().max(30).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const roleFilter = searchParams.get("role");

  const gebruikers = await prisma.user.findMany({
    where: {
      schoolId: session.user.schoolId ?? null,
      verwijderdOp: null,
      ...(roleFilter ? { role: roleFilter } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, telefoon: true, actief: true, createdAt: true },
  });

  return NextResponse.json(gebruikers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  try {
    const gelezen = await leesJson(req);
    if (!gelezen.ok) return gelezen.response;
    const body = gelezen.data;
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
        telefoon: parsed.data.telefoon?.trim() || null,
        schoolId: session.user.schoolId ?? null,
      },
    });

    return NextResponse.json(
      { id: gebruiker.id, name: gebruiker.name, email: gebruiker.email, role: gebruiker.role },
      { status: 201 }
    );
  } catch (err) {
    if (isUniekFout(err)) {
      return NextResponse.json({ error: "E-mailadres is al in gebruik" }, { status: 409 });
    }
    return NextResponse.json({ error: "Kon gebruiker niet aanmaken" }, { status: 500 });
  }
}
