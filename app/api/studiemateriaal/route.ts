import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { leesJson } from "@/lib/json-body";
import { leesBijlageVelden, veiligeLink } from "@/lib/bijlage";

// Studiemateriaal: docent deelt bestand/link met een klas en/of vak.
// GET — rol-afhankelijk: admin (hele school), docent (eigen school),
//        leerling/ouder (eigen klassen/vakken).
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const role = session.user.role;
  const schoolId = session.user.schoolId ?? null;

  // Klas- en vak-ids die voor leerling/ouder relevant zijn
  async function klasVakIdsVoorLeerlingen(leerlingIds: string[]) {
    const koppelingen = await prisma.klasLeerling.findMany({
      where: { leerlingId: { in: leerlingIds } },
      include: { klas: { include: { vakken: { select: { vakId: true } } } } },
    });
    const klasIds = new Set<string>();
    const vakIds = new Set<string>();
    for (const k of koppelingen) {
      klasIds.add(k.klasId);
      for (const v of k.klas.vakken) vakIds.add(v.vakId);
    }
    return { klasIds: [...klasIds], vakIds: [...vakIds] };
  }

  let where: Record<string, unknown> = { schoolId };

  if (role === "LEERLING") {
    const { klasIds, vakIds } = await klasVakIdsVoorLeerlingen([session.user.id]);
    where = { schoolId, OR: [{ klasId: { in: klasIds } }, { vakId: { in: vakIds } }] };
  } else if (role === "OUDER") {
    const kinderen = await prisma.ouderLeerling.findMany({
      where: { ouderId: session.user.id },
      select: { leerlingId: true },
    });
    const { klasIds, vakIds } = await klasVakIdsVoorLeerlingen(kinderen.map((k) => k.leerlingId));
    where = { schoolId, OR: [{ klasId: { in: klasIds } }, { vakId: { in: vakIds } }] };
  }
  // ADMIN en DOCENT: alle materialen van de school

  const materialen = await prisma.studieMateriaal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      docent: { select: { id: true, name: true } },
      klas: { select: { id: true, naam: true } },
      vak: { select: { id: true, naam: true } },
    },
  });

  const result = materialen.map(({ bijlageData: _d, ...m }) => ({ ...m, hasBijlage: !!m.bijlageNaam }));
  return NextResponse.json(result);
}

// POST — docent voegt studiemateriaal toe
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;
  const { titel, beschrijving, linkUrl, klasId, vakId } = gelezen.data;

  const bijlage = leesBijlageVelden(gelezen.data);
  if (!bijlage.ok) return bijlage.response;

  // Een link wordt in de app aanklikbaar; javascript:/data: horen daar niet.
  const veiligeLinkUrl = linkUrl ? veiligeLink(linkUrl) : null;
  if (linkUrl && !veiligeLinkUrl) {
    return NextResponse.json({ error: "Ongeldige link" }, { status: 400 });
  }

  if (!titel) {
    return NextResponse.json({ error: "Titel is verplicht" }, { status: 400 });
  }

  // Verifieer dat een opgegeven klas/vak bij de docent hoort
  if (klasId) {
    const link = await prisma.klasDocent.findFirst({ where: { klasId, docentId: session.user.id } });
    if (!link) return NextResponse.json({ error: "Geen toegang tot deze klas" }, { status: 403 });
  }

  try {
    const m = await prisma.studieMateriaal.create({
      data: {
        titel,
        beschrijving: beschrijving || null,
        linkUrl: veiligeLinkUrl,
        klasId: klasId || null,
        vakId: vakId || null,
        docentId: session.user.id,
        schoolId: session.user.schoolId ?? null,
        ...bijlage.velden,
      },
      include: {
        docent: { select: { id: true, name: true } },
        klas: { select: { id: true, naam: true } },
        vak: { select: { id: true, naam: true } },
      },
    });
    const { bijlageData: _d, ...out } = m;
    return NextResponse.json({ ...out, hasBijlage: !!m.bijlageNaam }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/studiemateriaal]", err);
    return NextResponse.json({ error: "Kon studiemateriaal niet opslaan" }, { status: 500 });
  }
}

// DELETE /api/studiemateriaal?id=xxx — de eigen docent of een admin van de school
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "DOCENT" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is verplicht" }, { status: 400 });

  const m = await prisma.studieMateriaal.findUnique({ where: { id } });
  if (!m) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  const mag =
    session.user.role === "ADMIN"
      ? m.schoolId === (session.user.schoolId ?? null)
      : m.docentId === session.user.id;
  if (!mag) return NextResponse.json({ error: "Geen toegang" }, { status: 403 });

  try {
    await prisma.studieMateriaal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
