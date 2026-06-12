import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
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
      include: {
        verzender: { select: { id: true, name: true, role: true } },
        // Replies sent by the inbox owner (e.g. leerling's own replies to this message)
        replies: {
          include: { verzender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
        // Context: the original message this is a reply to (e.g. docent sees their own original)
        replyTo: {
          include: { verzender: { select: { id: true, name: true, role: true } } },
        },
      },
      take: 50,
    }),
    prisma.bericht.findMany({
      where: { verzenderId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        ontvanger: { select: { id: true, name: true, role: true } },
        // Replies received on sent messages (e.g. leerling replied to docent's sent message)
        replies: {
          include: { verzender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);

  // Deduplicate verzonden: group by groepId, show one entry with count
  const verzondenMap = new Map<
    string,
    { bericht: (typeof verzondenRaw)[0]; count: number }
  >();

  for (const b of verzondenRaw) {
    const key = b.groepId ?? b.id;
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
    ontvanger: count === 1 ? bericht.ontvanger : null,
    replies: bericht.replies ?? [],
  }));

  return NextResponse.json({ inbox: inboxRaw, verzonden });
}

/**
 * POST /api/berichten — send a message
 *
 * doelType options:
 *   "GEBRUIKERS"       — doelIds: string[]   (specific users, any role)
 *   "KLAS_LEERLINGEN"  — doelId: string      (all leerlingen in klas)
 *   "KLAS_OUDERS"      — doelId: string      (all ouders of leerlingen in klas)
 *
 * Role rules:
 *   ADMIN/DOCENT: all doelTypes allowed
 *   LEERLING: only "GEBRUIKERS" allowed, and only to DOCENT/ADMIN targets
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const role = session.user.role;
  const verzenderId = session.user.id;

  // Only allowed roles
  if (role !== "DOCENT" && role !== "ADMIN" && role !== "LEERLING") {
    return NextResponse.json(
      { error: "Alleen docenten, beheerders en leerlingen mogen hier berichten sturen" },
      { status: 403 }
    );
  }

  const { onderwerp, inhoud, doelType, doelId, doelIds, replyToId } = await req.json();

  if (!onderwerp || !inhoud || !doelType) {
    return NextResponse.json(
      { error: "onderwerp, inhoud en doelType zijn verplicht" },
      { status: 400 }
    );
  }

  let ontvangerIds: string[] = [];
  let doelLabel: string = "";

  if (doelType === "GEBRUIKERS") {
    const ids: string[] = Array.isArray(doelIds) ? doelIds : doelId ? [doelId] : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Geen ontvangers opgegeven" }, { status: 400 });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: ids }, schoolId: session.user.schoolId ?? null },
      select: { id: true, name: true, role: true },
    });

    if (users.length === 0) {
      return NextResponse.json({ error: "Geen geldige ontvangers gevonden" }, { status: 404 });
    }

    // LEERLING can only send to DOCENT/ADMIN
    if (role === "LEERLING") {
      const invalidTargets = users.filter(
        (u) => u.role !== "DOCENT" && u.role !== "ADMIN"
      );
      if (invalidTargets.length > 0) {
        return NextResponse.json(
          { error: "Leerlingen kunnen alleen reageren naar docenten of beheerders" },
          { status: 403 }
        );
      }
    }

    ontvangerIds = users.map((u) => u.id);
    doelLabel = users.length === 1 ? users[0].name : `${users.length} ontvangers`;

  } else if (doelType === "KLAS_LEERLINGEN") {
    if (role === "LEERLING") {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }
    const klas = await prisma.klas.findUnique({
      where: { id: doelId },
      include: { leerlingen: { select: { leerlingId: true } } },
    });
    if (!klas || klas.schoolId !== (session.user.schoolId ?? null)) {
      return NextResponse.json({ error: "Klas niet gevonden" }, { status: 404 });
    }
    ontvangerIds = klas.leerlingen.map((kl) => kl.leerlingId);
    doelLabel = `Klas ${klas.naam} (leerlingen)`;

  } else if (doelType === "KLAS_OUDERS") {
    if (role === "LEERLING") {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }
    const klas = await prisma.klas.findUnique({
      where: { id: doelId },
      include: {
        leerlingen: {
          include: {
            leerling: {
              include: {
                kindVan: { select: { ouderId: true } },
              },
            },
          },
        },
      },
    });
    if (!klas || klas.schoolId !== (session.user.schoolId ?? null)) {
      return NextResponse.json({ error: "Klas niet gevonden" }, { status: 404 });
    }
    const ouderIds = new Set<string>();
    for (const { leerling } of klas.leerlingen) {
      for (const { ouderId } of leerling.kindVan) {
        ouderIds.add(ouderId);
      }
    }
    ontvangerIds = Array.from(ouderIds);
    doelLabel = `Ouders van klas ${klas.naam}`;

  } else {
    return NextResponse.json({ error: "Ongeldig doelType" }, { status: 400 });
  }

  if (ontvangerIds.length === 0) {
    return NextResponse.json(
      { error: "Geen ontvangers gevonden voor dit doel" },
      { status: 400 }
    );
  }

  const groepId =
    ontvangerIds.length > 1
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
            replyToId: replyToId ?? null,
          },
        })
      )
    );
    return NextResponse.json({ count: berichten.length }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/berichten]", err);
    return NextResponse.json({ error: "Kon bericht niet versturen" }, { status: 500 });
  }
}
