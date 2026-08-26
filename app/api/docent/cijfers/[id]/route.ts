import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { leesJson } from "@/lib/json-body";
import { docentMagBijCijfer } from "@/lib/docent-scope";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

  // Alleen cijfers uit de eigen klassen/vakken; anders wist een docent met een
  // geraden id het cijfer van een leerling van een andere school.
  if (!(await docentMagBijCijfer(session.user.id, id))) {
    return NextResponse.json({ error: "Cijfer niet gevonden" }, { status: 404 });
  }

  try {
    await prisma.cijfer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}

// PUT /api/docent/cijfers/[id] — opmerking en/of bijlage bij een bestaand cijfer
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

  if (!(await docentMagBijCijfer(session.user.id, id))) {
    return NextResponse.json({ error: "Cijfer niet gevonden" }, { status: 404 });
  }

  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;
  const { waarde, omschrijving, opmerking, bijlageNaam, bijlageUrl, bijlageData, bijlageType } =
    gelezen.data;

  const data: Record<string, unknown> = {};
  if (waarde !== undefined) {
    const num =
      typeof waarde === "number"
        ? waarde
        : typeof waarde === "string" && /^-?\d+([.,]\d+)?$/.test(waarde.trim())
        ? parseFloat(waarde.trim().replace(",", "."))
        : NaN;
    if (!Number.isFinite(num) || num < 1 || num > 10) {
      return NextResponse.json({ error: "Waarde moet tussen 1 en 10 zijn" }, { status: 400 });
    }
    data.waarde = num;
  }
  if (omschrijving !== undefined) data.omschrijving = omschrijving || null;
  if (opmerking !== undefined) {
    data.opmerking = opmerking || null;
    data.opmerkingOp = opmerking ? new Date() : null;
  }
  if (bijlageNaam !== undefined) {
    data.bijlageNaam = bijlageNaam || null;
    data.bijlageUrl = bijlageUrl || null;
    data.bijlageData = bijlageData || null;
    data.bijlageType = bijlageType || null;
  }

  try {
    const cijfer = await prisma.cijfer.update({
      where: { id },
      data,
      include: { leerling: { select: { id: true, name: true } }, vak: true },
    });
    const { bijlageData: _d, ...out } = cijfer;
    return NextResponse.json({ ...out, hasBijlage: !!cijfer.bijlageNaam });
  } catch {
    return NextResponse.json({ error: "Bijwerken mislukt" }, { status: 500 });
  }
}
