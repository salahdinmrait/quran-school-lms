import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { leesJson } from "@/lib/json-body";

// Mag deze docent/admin het dossier van deze leerling zien/bewerken?
// - ADMIN: leerling moet in dezelfde school zitten.
// - DOCENT: moet (nu of eerder) een klas met de leerling delen.
async function magBijLeerling(
  user: { id: string; role: string; schoolId: string | null },
  leerlingId: string
): Promise<boolean> {
  const leerling = await prisma.user.findUnique({
    where: { id: leerlingId },
    select: { role: true, schoolId: true },
  });
  if (!leerling || leerling.role !== "LEERLING") return false;
  if (leerling.schoolId !== (user.schoolId ?? null)) return false;

  if (user.role === "ADMIN") return true;
  if (user.role === "DOCENT") {
    const gedeeld = await prisma.klasLeerling.findFirst({
      where: { leerlingId, klas: { docenten: { some: { docentId: user.id } } } },
    });
    return !!gedeeld;
  }
  return false;
}

// GET /api/leerling-dossier?leerlingId=xxx — notities over de leerling
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "DOCENT" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }
  const leerlingId = req.nextUrl.searchParams.get("leerlingId");
  if (!leerlingId) return NextResponse.json({ error: "leerlingId verplicht" }, { status: 400 });

  if (!(await magBijLeerling(session.user, leerlingId))) {
    return NextResponse.json({ error: "Geen toegang tot deze leerling" }, { status: 403 });
  }

  const [leerling, notities] = await Promise.all([
    prisma.user.findUnique({ where: { id: leerlingId }, select: { id: true, name: true } }),
    prisma.leerlingDossier.findMany({
      where: { leerlingId },
      orderBy: { createdAt: "desc" },
      include: { auteur: { select: { id: true, name: true, role: true } } },
    }),
  ]);

  return NextResponse.json({ leerling, notities });
}

// POST /api/leerling-dossier — notitie toevoegen
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "DOCENT" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }
  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;
  const { leerlingId, titel, inhoud } = gelezen.data;
  if (!leerlingId || !inhoud?.trim()) {
    return NextResponse.json({ error: "leerlingId en inhoud zijn verplicht" }, { status: 400 });
  }
  if (!(await magBijLeerling(session.user, leerlingId))) {
    return NextResponse.json({ error: "Geen toegang tot deze leerling" }, { status: 403 });
  }

  const notitie = await prisma.leerlingDossier.create({
    data: { leerlingId, auteurId: session.user.id, titel: titel?.trim() || null, inhoud: inhoud.trim() },
    include: { auteur: { select: { id: true, name: true, role: true } } },
  });
  return NextResponse.json(notitie, { status: 201 });
}

// DELETE /api/leerling-dossier?id=xxx — eigen notitie of admin van de school
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "DOCENT" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id verplicht" }, { status: 400 });

  const notitie = await prisma.leerlingDossier.findUnique({ where: { id } });
  if (!notitie) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  const magWeg =
    notitie.auteurId === session.user.id ||
    (session.user.role === "ADMIN" && (await magBijLeerling(session.user, notitie.leerlingId)));
  if (!magWeg) return NextResponse.json({ error: "Geen toegang" }, { status: 403 });

  await prisma.leerlingDossier.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
