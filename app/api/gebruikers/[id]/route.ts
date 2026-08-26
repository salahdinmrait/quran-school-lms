import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { leesJson } from "@/lib/json-body";
import { isUniekFout } from "@/lib/prisma-fouten";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  role: z.enum(["ADMIN", "DOCENT", "LEERLING", "OUDER"]),
  actief: z.boolean(),
  telefoon: z.string().max(30).optional().nullable(),
  nieuwWachtwoord: z.string().min(8, "Wachtwoord moet minimaal 8 tekens hebben").optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const gebruiker = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, telefoon: true, actief: true, schoolId: true },
  });

  if (!gebruiker || gebruiker.schoolId !== (session.user.schoolId ?? null)) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }
  const { schoolId: _s, ...out } = gebruiker;
  return NextResponse.json(out);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent deleting yourself
  if (id === session.user.id) {
    return NextResponse.json({ error: "U kunt uw eigen account niet verwijderen" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { schoolId: true } });
  if (!target || target.schoolId !== (session.user.schoolId ?? null)) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  try {
    // Soft delete: naar het archief. Definitief verwijderen kan alleen
    // via /api/admin/archief (admin).
    await prisma.user.update({
      where: { id },
      data: { verwijderdOp: new Date(), actief: false },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id }, select: { schoolId: true } });
  if (!target || target.schoolId !== (session.user.schoolId ?? null)) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  try {
    const gelezen = await leesJson(req);
    if (!gelezen.ok) return gelezen.response;
    const body = gelezen.data;
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validatiefout" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      actief: parsed.data.actief,
    };

    if (parsed.data.telefoon !== undefined) {
      updateData.telefoon = parsed.data.telefoon?.trim() || null;
    }

    if (parsed.data.nieuwWachtwoord) {
      updateData.password = await bcrypt.hash(parsed.data.nieuwWachtwoord, 12);
    }

    const gebruiker = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ id: gebruiker.id, name: gebruiker.name });
  } catch (err) {
    if (isUniekFout(err)) {
      return NextResponse.json({ error: "E-mailadres is al in gebruik" }, { status: 409 });
    }
    return NextResponse.json({ error: "Kon gebruiker niet bijwerken" }, { status: 500 });
  }
}
