import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDevAuthenticated } from "@/lib/dev-auth";

// GET /api/dev/scholen/[id] — school detail with all accounts
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isDevAuthenticated())) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

  const school = await prisma.school.findUnique({
    where: { id },
    include: {
      gebruikers: {
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: { id: true, name: true, email: true, role: true, actief: true, createdAt: true },
      },
      _count: { select: { klassen: true, vakken: true } },
    },
  });

  if (!school) {
    return NextResponse.json({ error: "School niet gevonden" }, { status: 404 });
  }

  return NextResponse.json(school);
}

// PATCH /api/dev/scholen/[id] — update school info / toggle actief
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isDevAuthenticated())) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const key of ["naam", "plaats", "adres", "contactEmail", "contactTelefoon"] as const) {
      if (typeof body[key] === "string") data[key] = body[key] || null;
    }
    if (typeof body.actief === "boolean") data.actief = body.actief;

    const school = await prisma.school.update({ where: { id }, data });
    return NextResponse.json(school);
  } catch (err) {
    console.error("[PATCH /api/dev/scholen/[id]]", err);
    return NextResponse.json({ error: "Kon school niet bijwerken" }, { status: 500 });
  }
}

// Grote scholen kunnen veel rijen hebben; geef de opschoning ruim de tijd.
export const maxDuration = 120;

// DELETE /api/dev/scholen/[id] — school en álle bijbehorende data definitief
// verwijderen. ONOMKEERBAAR: dit is geen soft delete, er blijft niets staan.
// Veiligheidsslot: de aanroeper moet de slug van de school exact meesturen.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isDevAuthenticated())) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

  const school = await prisma.school.findUnique({
    where: { id },
    select: { id: true, slug: true, naam: true },
  });
  if (!school) {
    return NextResponse.json({ error: "School niet gevonden" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  if (body?.bevestiging !== school.slug) {
    return NextResponse.json(
      { error: `Bevestiging klopt niet — typ de slug "${school.slug}" om te bevestigen.` },
      { status: 400 }
    );
  }

  try {
    // Eerst alle id's verzamelen die bij deze school horen.
    const [gebruikers, klassen, vakken] = await Promise.all([
      prisma.user.findMany({ where: { schoolId: id }, select: { id: true } }),
      prisma.klas.findMany({ where: { schoolId: id }, select: { id: true } }),
      prisma.vak.findMany({ where: { schoolId: id }, select: { id: true } }),
    ]);
    const userIds = gebruikers.map((u) => u.id);
    const klasIds = klassen.map((k) => k.id);
    const vakIds = vakken.map((v) => v.id);

    const lessen = await prisma.les.findMany({
      where: { OR: [{ klasId: { in: klasIds } }, { vakId: { in: vakIds } }] },
      select: { id: true },
    });
    const lesIds = lessen.map((l) => l.id);

    const huiswerk = await prisma.huiswerk.findMany({
      where: { OR: [{ vakId: { in: vakIds } }, { lesId: { in: lesIds } }] },
      select: { id: true },
    });
    const huiswerkIds = huiswerk.map((h) => h.id);

    const profielen = await prisma.hifdhProfiel.findMany({
      where: { leerlingId: { in: userIds } },
      select: { id: true },
    });
    const profielIds = profielen.map((p) => p.id);

    // Bewust géén transactie: op serverless Postgres (Neon) is een lange
    // transactie kwetsbaar voor timeouts. De volgorde hieronder respecteert de
    // foreign keys, en opnieuw draaien na een halve mislukking is veilig
    // (al verwijderde rijen zijn simpelweg een no-op).
    await prisma.hifdhTaak.deleteMany({
      where: { OR: [{ profielId: { in: profielIds } }, { huiswerkId: { in: huiswerkIds } }] },
    });
    await prisma.hifdhProfiel.deleteMany({ where: { id: { in: profielIds } } });
    await prisma.huiswerkLeerling.deleteMany({
      where: { OR: [{ huiswerkId: { in: huiswerkIds } }, { leerlingId: { in: userIds } }] },
    });
    await prisma.inlevering.deleteMany({
      where: { OR: [{ huiswerkId: { in: huiswerkIds } }, { leerlingId: { in: userIds } }] },
    });
    await prisma.aanwezigheid.deleteMany({
      where: { OR: [{ lesId: { in: lesIds } }, { leerlingId: { in: userIds } }] },
    });
    await prisma.huiswerk.deleteMany({ where: { id: { in: huiswerkIds } } });
    await prisma.les.deleteMany({ where: { id: { in: lesIds } } });
    await prisma.cijfer.deleteMany({
      where: { OR: [{ vakId: { in: vakIds } }, { leerlingId: { in: userIds } }] },
    });
    await prisma.studieMateriaal.deleteMany({
      where: {
        OR: [
          { schoolId: id },
          { docentId: { in: userIds } },
          { klasId: { in: klasIds } },
          { vakId: { in: vakIds } },
        ],
      },
    });
    await prisma.leerlingDossier.deleteMany({
      where: { OR: [{ leerlingId: { in: userIds } }, { auteurId: { in: userIds } }] },
    });

    // Berichten verwijzen naar zichzelf (replyToId): eerst losknippen.
    const berichtFilter = {
      OR: [{ verzenderId: { in: userIds } }, { ontvangerId: { in: userIds } }],
    };
    await prisma.bericht.updateMany({ where: berichtFilter, data: { replyToId: null } });
    await prisma.bericht.deleteMany({ where: berichtFilter });

    await prisma.ouderLeerling.deleteMany({
      where: { OR: [{ ouderId: { in: userIds } }, { leerlingId: { in: userIds } }] },
    });
    await prisma.klasVak.deleteMany({
      where: { OR: [{ klasId: { in: klasIds } }, { vakId: { in: vakIds } }] },
    });
    await prisma.klasDocent.deleteMany({
      where: { OR: [{ klasId: { in: klasIds } }, { docentId: { in: userIds } }] },
    });
    await prisma.klasLeerling.deleteMany({
      where: { OR: [{ klasId: { in: klasIds } }, { leerlingId: { in: userIds } }] },
    });
    await prisma.passwordResetToken.deleteMany({ where: { gebruikerId: { in: userIds } } });

    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.klas.deleteMany({ where: { id: { in: klasIds } } });
    await prisma.vak.deleteMany({ where: { id: { in: vakIds } } });
    await prisma.school.delete({ where: { id } });

    console.log(
      `[DELETE /api/dev/scholen] "${school.naam}" (${school.slug}) definitief verwijderd:`,
      `${userIds.length} accounts, ${klasIds.length} klassen, ${vakIds.length} vakken`
    );

    return NextResponse.json({
      success: true,
      verwijderd: {
        school: school.naam,
        accounts: userIds.length,
        klassen: klasIds.length,
        vakken: vakIds.length,
      },
    });
  } catch (err) {
    console.error("[DELETE /api/dev/scholen/[id]]", err);
    return NextResponse.json(
      { error: "Kon school niet verwijderen — mogelijk is een deel al opgeruimd. Probeer opnieuw." },
      { status: 500 }
    );
  }
}
