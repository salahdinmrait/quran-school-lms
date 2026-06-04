import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/berichten — inbox + deduplicated verzonden
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const userId = session.user.id;

  const [inboxRaw, verzondenRaw] = await Promise.all([
    prisma.bericht.findMany({
      where: { ontvangerId: userId },
      orderBy: { createdAt: "desc" },
      include: { verzender: { select: { id: true, name: true, role: true } } },
      take: 50,
    }),
    prisma.bericht.findMany({
      where: { verzenderId: userId },
      orderBy: { createdAt: "desc" },
      include: { ontvanger: { select: { id: true, name: true, role: true } } },
    }),
  ]);

  // Deduplicate verzonden: group by groepId, show one entry with count
  const verzondenMap = new Map<
    string,
    { bericht: (typeof verzondenRaw)[0]; count: number }
  >();

  for (const b of verzondenRaw) {
    const key = b.groepId ?? b.id; // ungrouped messages use their own id
    if (!verzondenMap.has(key)) {
      verzondenMap.set(key, { bericht: b, count: 1 });
    } else {
      verzondenMap.get(key)!.count++;
    }
  }

  const verzonden = Array.from(verzondenMap.values()).map(({ bericht, count }) => ({
    id: bericht.id,
    groepId: bericht.groepId,
    onderwerp: bericht.onderwerp,
    inhoud: bericht.inhoud,
    createdAt: bericht.createdAt,
    doelLabel: bericht.doelLabel,
    aantalOntvangers: count,
    // For single message show the recipient name; for broadcast show doelLabel
    ontvanger: count === 1 ? bericht.ontvanger : null,
  }));

  return NextResponse.json({ inbox: inboxRaw, verzonden });
}

// POST /api/berichten — send a message
// Body: { onderwerp, inhoud, doelType: "LEERLING"|"KLAS"|"VAK", doelId }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const verzenderId = session.user.id;
  const { onderwerp, inhoud, doelType, doelId } = await req.json();

  if (!onderwerp || !inhoud || !doelType || !doelId) {
    return NextResponse.json(
      { error: "onderwerp, inhoud, doelType en doelId zijn verplicht" },
      { status: 400 }
    );
  }

  // Collect recipient IDs and a label for the verzonden view
  let ontvangerIds: string[] = [];
  let doelLabel: string = "";

  if (doelType === "LEERLING") {
    const user = await prisma.user.findUnique({ where: { id: doelId } });
    if (!user || user.role !== "LEERLING") {
      return NextResponse.json({ error: "Leerling niet gevonden" }, { status: 404 });
    }
    ontvangerIds = [doelId];
    doelLabel = user.name;
  } else if (doelType === "KLAS") {
    const klas = await prisma.klas.findUnique({
      where: { id: doelId },
      include: { leerlingen: { select: { leerlingId: true } } },
    });
    if (!klas) {
      return NextResponse.json({ error: "Klas niet gevonden" }, { status: 404 });
    }
    ontvangerIds = klas.leerlingen.map((kl) => kl.leerlingId);
    doelLabel = `Klas ${klas.naam}`;
  } else if (doelType === "VAK") {
    const vak = await prisma.vak.findUnique({
      where: { id: doelId },
      include: {
        klassen: {
          include: {
            klas: { include: { leerlingen: { select: { leerlingId: true } } } },
          },
        },
      },
    });
    if (!vak) {
      return NextResponse.json({ error: "Vak niet gevonden" }, { status: 404 });
    }
    const ids = new Set<string>();
    for (const kv of vak.klassen) {
      for (const kl of kv.klas.leerlingen) {
        ids.add(kl.leerlingId);
      }
    }
    ontvangerIds = Array.from(ids);
    doelLabel = `Vak ${vak.naam}`;
  } else {
    return NextResponse.json({ error: "Ongeldig doelType" }, { status: 400 });
  }

  if (ontvangerIds.length === 0) {
    return NextResponse.json(
      { error: "Geen ontvangers gevonden voor dit doel" },
      { status: 400 }
    );
  }

  // Generate a shared groepId for broadcasts; single message gets no groepId
  const groepId = ontvangerIds.length > 1
    ? `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    : null;

  try {
    const berichten = await prisma.$transaction(
      ontvangerIds.map((ontvangerId) =>
        prisma.bericht.create({
          data: {
            onderwerp,
            inhoud,
            verzenderId,
            ontvangerId,
            groepId,
            doelLabel: groepId ? doelLabel : null,
          },
        })
      )
    );
    return NextResponse.json({ count: berichten.length }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kon bericht niet versturen" }, { status: 500 });
  }
}
