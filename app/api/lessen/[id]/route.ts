import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { leesJson } from "@/lib/json-body";
import { leesBijlageVelden } from "@/lib/bijlage";

// DELETE /api/lessen/[id] — admin (eigen school) of docent (eigen klas)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

  const les = await prisma.les.findUnique({
    where: { id },
    include: { klas: { select: { schoolId: true, docenten: { select: { docentId: true } } } } },
  });
  if (!les) {
    return NextResponse.json({ error: "Les niet gevonden" }, { status: 404 });
  }

  if (session.user.role === "ADMIN") {
    if (les.klas.schoolId !== (session.user.schoolId ?? null)) {
      return NextResponse.json({ error: "Geen toegang tot deze les" }, { status: 403 });
    }
  } else if (!les.klas.docenten.some((d) => d.docentId === session.user.id)) {
    return NextResponse.json({ error: "Geen toegang tot deze les" }, { status: 403 });
  }

  try {
    // Aanwezigheid hangt aan de les; eerst opruimen i.v.m. FK constraints
    await prisma.aanwezigheid.deleteMany({ where: { lesId: id } });
    // Huiswerk blijft bestaan (het hangt óók aan een vak) maar verliest de
    // koppeling met deze les — anders blokkeert de foreign key het verwijderen.
    await prisma.huiswerk.updateMany({ where: { lesId: id }, data: { lesId: null } });
    await prisma.les.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}

// PATCH /api/lessen/[id] — omschrijving/bijlage (en evt. tijden/lokaal) wijzigen
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const les = await prisma.les.findUnique({
    where: { id },
    include: { klas: { select: { schoolId: true, docenten: { select: { docentId: true } } } } },
  });
  if (!les) {
    return NextResponse.json({ error: "Les niet gevonden" }, { status: 404 });
  }
  if (session.user.role === "ADMIN") {
    if (les.klas.schoolId !== (session.user.schoolId ?? null)) {
      return NextResponse.json({ error: "Geen toegang tot deze les" }, { status: 403 });
    }
  } else if (!les.klas.docenten.some((d) => d.docentId === session.user.id)) {
    return NextResponse.json({ error: "Geen toegang tot deze les" }, { status: 403 });
  }

  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;
  const body = gelezen.data;
  const data: Record<string, unknown> = {};
  for (const f of ["begintijd", "eindtijd", "lokaal", "beschrijving"] as const) {
    if (body[f] !== undefined) data[f] = body[f] || null;
  }
  if (body.datum !== undefined) {
    const d = new Date(body.datum);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Ongeldige datum" }, { status: 400 });
    }
    data.datum = d;
  }
  if (body.bijlageNaam !== undefined) {
    const bijlage = leesBijlageVelden(body);
    if (!bijlage.ok) return bijlage.response;
    data.bijlageNaam = bijlage.velden.bijlageNaam;
    data.bijlageUrl = bijlage.velden.bijlageUrl;
    data.bijlageType = bijlage.velden.bijlageType;
    // Een vervangen of verwijderde bijlage laat geen oude base64 achter.
    data.bijlageData = null;
  }

  try {
    const updated = await prisma.les.update({ where: { id }, data });
    const { bijlageData: _d, ...out } = updated;
    return NextResponse.json({ ...out, hasBijlage: !!updated.bijlageNaam });
  } catch {
    return NextResponse.json({ error: "Bijwerken mislukt" }, { status: 500 });
  }
}
