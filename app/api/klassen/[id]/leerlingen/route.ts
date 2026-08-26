import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { klasBehoortTotSchool } from "@/lib/school-scope";
import { leesJson } from "@/lib/json-body";

// POST: één of meerdere leerlingen toevoegen aan klas
// Body: { leerlingId: string } OR { leerlingIds: string[] }
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
  const body = gelezen.data;

  // Support both single and bulk
  const ids: string[] = body.leerlingIds
    ? body.leerlingIds
    : body.leerlingId
    ? [body.leerlingId]
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "leerlingId of leerlingIds vereist" }, { status: 400 });
  }

  const results = { toegevoegd: 0, overgeslagen: 0, fouten: 0 };

  for (const leerlingId of ids) {
    try {
      const leerling = await prisma.user.findUnique({ where: { id: leerlingId } });
      if (
        !leerling ||
        leerling.role !== "LEERLING" ||
        leerling.schoolId !== (session.user.schoolId ?? null)
      ) {
        results.fouten++;
        continue;
      }
      await prisma.klasLeerling.create({ data: { klasId, leerlingId } });
      results.toegevoegd++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Unique constraint")) {
        results.overgeslagen++;
      } else {
        results.fouten++;
      }
    }
  }

  return NextResponse.json(results, { status: 201 });
}

// DELETE: leerling verwijderen uit klas
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
  const { leerlingId } = gelezen2.data;

  try {
    await prisma.klasLeerling.deleteMany({ where: { klasId, leerlingId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
