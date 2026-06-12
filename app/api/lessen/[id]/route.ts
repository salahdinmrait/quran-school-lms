import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

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
    await prisma.les.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
