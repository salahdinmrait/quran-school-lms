import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { leesJson } from "@/lib/json-body";
import { docentMagBijHuiswerkVoorLeerling } from "@/lib/docent-scope";
import { userBehoortTotSchool } from "@/lib/school-scope";

// POST /api/docent/huiswerk/afvinken
// Body: { huiswerkId, leerlingId }
// Creates an Inlevering (marks homework done for a student)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "DOCENT" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;
  const { huiswerkId, leerlingId } = gelezen.data;
  if (!huiswerkId || !leerlingId) {
    return NextResponse.json({ error: "huiswerkId en leerlingId zijn verplicht" }, { status: 400 });
  }

  if (!(await magAfvinken(session.user.role, session.user.id, session.user.schoolId ?? null, huiswerkId, leerlingId))) {
    return NextResponse.json(
      { error: "Dit huiswerk hoort niet bij een klas van jou, of deze leerling zit daar niet in" },
      { status: 403 }
    );
  }

  const inlevering = await prisma.inlevering.upsert({
    where: { huiswerkId_leerlingId: { huiswerkId, leerlingId } },
    create: { huiswerkId, leerlingId, inhoud: "✓" },
    update: { inhoud: "✓" },
  });

  return NextResponse.json(inlevering, { status: 201 });
}

// DELETE /api/docent/huiswerk/afvinken
// Body: { huiswerkId, leerlingId }
// Removes the Inlevering (un-marks homework)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "DOCENT" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const gelezen2 = await leesJson(req);
  if (!gelezen2.ok) return gelezen2.response;
  const { huiswerkId, leerlingId } = gelezen2.data;
  if (!huiswerkId || !leerlingId) {
    return NextResponse.json({ error: "huiswerkId en leerlingId zijn verplicht" }, { status: 400 });
  }

  if (!(await magAfvinken(session.user.role, session.user.id, session.user.schoolId ?? null, huiswerkId, leerlingId))) {
    return NextResponse.json(
      { error: "Dit huiswerk hoort niet bij een klas van jou, of deze leerling zit daar niet in" },
      { status: 403 }
    );
  }

  await prisma.inlevering.deleteMany({
    where: { huiswerkId, leerlingId },
  });

  return NextResponse.json({ success: true });
}

/**
 * Mag deze persoon dit huiswerk voor deze leerling aan- of afvinken?
 * Docent: alleen binnen de eigen klassen. Admin: alleen binnen de eigen school.
 */
async function magAfvinken(
  rol: string,
  gebruikerId: string,
  schoolId: string | null,
  huiswerkId: string,
  leerlingId: string
): Promise<boolean> {
  if (rol === "ADMIN") return userBehoortTotSchool(leerlingId, schoolId);
  return docentMagBijHuiswerkVoorLeerling(gebruikerId, huiswerkId, leerlingId);
}
