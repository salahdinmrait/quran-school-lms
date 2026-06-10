import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/ouder/berichten
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "OUDER") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const ouderId = session.user.id;

  const [inbox, verzonden] = await Promise.all([
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
  ]);

  return NextResponse.json({ inbox, verzonden });
}

// POST /api/ouder/berichten — parent sends message to a docent
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "OUDER") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { ontvangerId, onderwerp, inhoud } = await req.json();
  if (!ontvangerId || !onderwerp || !inhoud) {
    return NextResponse.json({ error: "Alle velden zijn verplicht" }, { status: 400 });
  }

  // Verify recipient is a docent who teaches their child
  const kind = await prisma.ouderLeerling.findFirst({
    where: {
      ouderId: session.user.id,
      leerling: {
        leerlingKlassen: {
          some: {
            klas: { docenten: { some: { docentId: ontvangerId } } },
          },
        },
      },
    },
  });

  if (!kind) {
    return NextResponse.json({ error: "U kunt alleen berichten sturen aan docenten van uw kind" }, { status: 403 });
  }

  try {
    const bericht = await prisma.bericht.create({
      data: {
        onderwerp,
        inhoud,
        verzenderId: session.user.id,
        ontvangerId,
      },
    });
    return NextResponse.json(bericht, { status: 201 });
  } catch (err) {
    console.error("[POST /api/ouder/berichten]", err);
    return NextResponse.json({ error: "Versturen mislukt" }, { status: 500 });
  }
}
