import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { toegestaneOntvangerIds } from "@/lib/contacten";

// GET /api/ouder/berichten
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "OUDER") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const ouderId = session.user.id;

  const [inbox, verzonden, admins] = await Promise.all([
    prisma.bericht.findMany({
      where: { ontvangerId: ouderId },
      orderBy: { createdAt: "desc" },
      include: { verzender: { select: { id: true, name: true, role: true } } },
    }),
    prisma.bericht.findMany({
      where: { verzenderId: ouderId },
      orderBy: { createdAt: "desc" },
      include: { ontvanger: { select: { id: true, name: true, role: true } } },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN", actief: true, schoolId: session.user.schoolId ?? null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return NextResponse.json({ inbox, verzonden, admins });
}

// POST /api/ouder/berichten — een ouder schrijft docenten en/of het beheer aan.
// `ontvangerIds` mag meerdere mensen bevatten (dezelfde zoekbalk als de
// leerling gebruikt); het oude `ontvangerId` blijft werken.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "OUDER") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { ontvangerId, ontvangerIds, onderwerp, inhoud } = await req.json();
  const doelIds: string[] = Array.from(
    new Set(
      (Array.isArray(ontvangerIds) ? ontvangerIds : ontvangerId ? [ontvangerId] : []).filter(
        (id: unknown): id is string => typeof id === "string" && id.length > 0
      )
    )
  );

  if (doelIds.length === 0 || !onderwerp || !inhoud) {
    return NextResponse.json({ error: "Alle velden zijn verplicht" }, { status: 400 });
  }

  // Dezelfde regels als de contactenlijst waaruit de ouder kiest — anders kan
  // iemand met een zelfgemaakt verzoek langs de UI heen naar een willekeurig
  // id sturen.
  const toegestaan = await toegestaneOntvangerIds(
    session.user.id,
    session.user.role,
    session.user.schoolId ?? null
  );
  if (toegestaan && doelIds.some((id) => !toegestaan.has(id))) {
    return NextResponse.json(
      { error: "Je kunt alleen berichten sturen aan docenten van je kind of het beheer" },
      { status: 403 }
    );
  }

  try {
    // Eén rij per ontvanger, net als bij de gewone berichtenroute.
    const berichten = await prisma.$transaction(
      doelIds.map((ontvangerId) =>
        prisma.bericht.create({
          data: { onderwerp, inhoud, verzenderId: session.user.id, ontvangerId },
        })
      )
    );
    return NextResponse.json(berichten, { status: 201 });
  } catch (err) {
    console.error("[POST /api/ouder/berichten]", err);
    return NextResponse.json({ error: "Versturen mislukt" }, { status: 500 });
  }
}
