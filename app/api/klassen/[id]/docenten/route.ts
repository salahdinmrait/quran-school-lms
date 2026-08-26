import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { klasBehoortTotSchool } from "@/lib/school-scope";
import { leesJson } from "@/lib/json-body";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id: klasId } = await params;
  if (!(await klasBehoortTotSchool(klasId, session.user.schoolId ?? null))) {
    return NextResponse.json({ error: "Klas niet gevonden" }, { status: 404 });
  }
  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;
  const { docentId } = gelezen.data;

  if (!docentId) {
    return NextResponse.json({ error: "docentId vereist" }, { status: 400 });
  }

  try {
    const docent = await prisma.user.findUnique({ where: { id: docentId } });
    if (
      !docent ||
      docent.role !== "DOCENT" ||
      docent.schoolId !== (session.user.schoolId ?? null)
    ) {
      return NextResponse.json({ error: "Docent niet gevonden" }, { status: 404 });
    }

    const koppeling = await prisma.klasDocent.create({ data: { klasId, docentId } });
    return NextResponse.json(koppeling, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Docent is al gekoppeld aan deze klas" }, { status: 409 });
    }
    return NextResponse.json({ error: "Kon docent niet toevoegen" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id: klasId } = await params;
  if (!(await klasBehoortTotSchool(klasId, session.user.schoolId ?? null))) {
    return NextResponse.json({ error: "Klas niet gevonden" }, { status: 404 });
  }
  const gelezen2 = await leesJson(req);
  if (!gelezen2.ok) return gelezen2.response;
  const { docentId } = gelezen2.data;

  try {
    await prisma.klasDocent.deleteMany({ where: { klasId, docentId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
