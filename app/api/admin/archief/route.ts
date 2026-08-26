import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { leesJson } from "@/lib/json-body";

// Archief van soft-deleted items (personen, klassen, vakken) — alleen ADMIN.
// GET    → lijst gearchiveerde items van de eigen school
// DELETE → definitief verwijderen (incl. afhankelijke records); geen terugzetten

// GET /api/admin/archief
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }
  const schoolId = session.user.schoolId ?? null;

  const [gebruikers, klassen, vakken] = await Promise.all([
    prisma.user.findMany({
      where: { schoolId, verwijderdOp: { not: null } },
      orderBy: { verwijderdOp: "desc" },
      select: { id: true, name: true, email: true, role: true, verwijderdOp: true },
    }),
    prisma.klas.findMany({
      where: { schoolId, verwijderdOp: { not: null } },
      orderBy: { verwijderdOp: "desc" },
      select: { id: true, naam: true, verwijderdOp: true },
    }),
    prisma.vak.findMany({
      where: { schoolId, verwijderdOp: { not: null } },
      orderBy: { verwijderdOp: "desc" },
      select: { id: true, naam: true, categorie: true, verwijderdOp: true },
    }),
  ]);

  return NextResponse.json({ gebruikers, klassen, vakken });
}

// DELETE /api/admin/archief — body: { type: "gebruiker" | "klas" | "vak", id }
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }
  const schoolId = session.user.schoolId ?? null;

  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;
  const { type, id } = gelezen.data;
  if (!type || !id) {
    return NextResponse.json({ error: "type en id zijn verplicht" }, { status: 400 });
  }

  try {
    if (type === "gebruiker") {
      const target = await prisma.user.findUnique({ where: { id }, select: { schoolId: true, verwijderdOp: true } });
      if (!target || target.schoolId !== schoolId || !target.verwijderdOp) {
        return NextResponse.json({ error: "Niet gevonden in het archief" }, { status: 404 });
      }
      await prisma.$transaction(async (tx) => {
        // Replies op berichten van deze gebruiker losmaken vóór het verwijderen
        await tx.bericht.updateMany({
          where: { replyTo: { OR: [{ verzenderId: id }, { ontvangerId: id }] } },
          data: { replyToId: null },
        });
        await tx.bericht.deleteMany({ where: { OR: [{ verzenderId: id }, { ontvangerId: id }] } });
        await tx.aanwezigheid.deleteMany({ where: { leerlingId: id } });
        await tx.cijfer.deleteMany({ where: { leerlingId: id } });
        await tx.inlevering.deleteMany({ where: { leerlingId: id } });
        await tx.huiswerkLeerling.deleteMany({ where: { leerlingId: id } });
        await tx.leerlingDossier.deleteMany({ where: { OR: [{ leerlingId: id }, { auteurId: id }] } });
        await tx.studieMateriaal.deleteMany({ where: { docentId: id } });
        await tx.hifdhProfiel.deleteMany({ where: { leerlingId: id } });
        await tx.ouderLeerling.deleteMany({ where: { OR: [{ ouderId: id }, { leerlingId: id }] } });
        await tx.passwordResetToken.deleteMany({ where: { gebruikerId: id } });
        await tx.klasDocent.deleteMany({ where: { docentId: id } });
        await tx.klasLeerling.deleteMany({ where: { leerlingId: id } });
        await tx.user.delete({ where: { id } });
      });
    } else if (type === "klas") {
      const target = await prisma.klas.findUnique({ where: { id }, select: { schoolId: true, verwijderdOp: true } });
      if (!target || target.schoolId !== schoolId || !target.verwijderdOp) {
        return NextResponse.json({ error: "Niet gevonden in het archief" }, { status: 404 });
      }
      await prisma.$transaction(async (tx) => {
        const lesIds = (await tx.les.findMany({ where: { klasId: id }, select: { id: true } })).map((l) => l.id);
        if (lesIds.length > 0) {
          await tx.aanwezigheid.deleteMany({ where: { lesId: { in: lesIds } } });
          const hwIds = (await tx.huiswerk.findMany({ where: { lesId: { in: lesIds } }, select: { id: true } })).map((h) => h.id);
          if (hwIds.length > 0) {
            await tx.inlevering.deleteMany({ where: { huiswerkId: { in: hwIds } } });
            await tx.huiswerkLeerling.deleteMany({ where: { huiswerkId: { in: hwIds } } });
            await tx.hifdhTaak.updateMany({ where: { huiswerkId: { in: hwIds } }, data: { huiswerkId: null } });
            await tx.huiswerk.deleteMany({ where: { id: { in: hwIds } } });
          }
          await tx.les.deleteMany({ where: { klasId: id } });
        }
        await tx.studieMateriaal.updateMany({ where: { klasId: id }, data: { klasId: null } });
        await tx.klasDocent.deleteMany({ where: { klasId: id } });
        await tx.klasLeerling.deleteMany({ where: { klasId: id } });
        await tx.klasVak.deleteMany({ where: { klasId: id } });
        await tx.klas.delete({ where: { id } });
      });
    } else if (type === "vak") {
      const target = await prisma.vak.findUnique({ where: { id }, select: { schoolId: true, verwijderdOp: true } });
      if (!target || target.schoolId !== schoolId || !target.verwijderdOp) {
        return NextResponse.json({ error: "Niet gevonden in het archief" }, { status: 404 });
      }
      await prisma.$transaction(async (tx) => {
        const hwIds = (await tx.huiswerk.findMany({ where: { vakId: id }, select: { id: true } })).map((h) => h.id);
        if (hwIds.length > 0) {
          await tx.inlevering.deleteMany({ where: { huiswerkId: { in: hwIds } } });
          await tx.huiswerkLeerling.deleteMany({ where: { huiswerkId: { in: hwIds } } });
          await tx.hifdhTaak.updateMany({ where: { huiswerkId: { in: hwIds } }, data: { huiswerkId: null } });
          await tx.huiswerk.deleteMany({ where: { id: { in: hwIds } } });
        }
        await tx.cijfer.deleteMany({ where: { vakId: id } });
        await tx.les.updateMany({ where: { vakId: id }, data: { vakId: null } });
        await tx.studieMateriaal.updateMany({ where: { vakId: id }, data: { vakId: null } });
        await tx.klasVak.deleteMany({ where: { vakId: id } });
        await tx.vak.delete({ where: { id } });
      });
    } else {
      return NextResponse.json({ error: "Onbekend type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/archief]", err);
    return NextResponse.json({ error: "Definitief verwijderen mislukt" }, { status: 500 });
  }
}
