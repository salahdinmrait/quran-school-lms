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

  const [leerling, notities, klasLinks, aanwezigheid] = await Promise.all([
    prisma.user.findUnique({ where: { id: leerlingId }, select: { id: true, name: true, email: true } }),
    prisma.leerlingDossier.findMany({
      where: { leerlingId },
      orderBy: { createdAt: "desc" },
      include: { auteur: { select: { id: true, name: true, role: true } } },
    }),
    prisma.klasLeerling.findMany({
      where: { leerlingId },
      select: {
        klas: {
          select: {
            id: true,
            naam: true,
            vakken: { select: { vak: { select: { id: true, naam: true } } } },
            docenten: { select: { docent: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
    // Volledige geschiedenis: het aantal lessen per leerling is klein genoeg
    // (een schooljaar telt hooguit een paar honderd registraties) en het
    // percentage moet over álles gaan, niet over een afgekapte lijst.
    prisma.aanwezigheid.findMany({
      where: { leerlingId },
      select: {
        id: true,
        status: true,
        les: {
          select: {
            id: true,
            datum: true,
            begintijd: true,
            eindtijd: true,
            lokaal: true,
            klas: { select: { id: true, naam: true } },
            vak: { select: { id: true, naam: true } },
          },
        },
      },
    }),
  ]);

  const klassen = klasLinks.map((k) => ({
    id: k.klas.id,
    naam: k.klas.naam,
    vakken: k.klas.vakken.map((v) => v.vak),
    docenten: k.klas.docenten.map((d) => d.docent),
  }));

  // Vakken kunnen aan meerdere klassen hangen; één lijst zonder dubbelen.
  const vakken = [...new Map(klassen.flatMap((k) => k.vakken).map((v) => [v.id, v])).values()];

  const telling = { AANWEZIG: 0, AFWEZIG: 0, TE_LAAT: 0, GEOORLOOFD: 0 } as Record<string, number>;
  for (const a of aanwezigheid) {
    telling[a.status] = (telling[a.status] ?? 0) + 1;
  }
  const totaal = aanwezigheid.length;

  // Per vak, zodat te zien is of het aan één vak ligt of overal speelt.
  const perVakMap = new Map<string, { vakId: string | null; vakNaam: string; totaal: number; aanwezig: number }>();
  for (const a of aanwezigheid) {
    const sleutel = a.les.vak?.id ?? "(geen)";
    if (!perVakMap.has(sleutel)) {
      perVakMap.set(sleutel, {
        vakId: a.les.vak?.id ?? null,
        vakNaam: a.les.vak?.naam ?? "Zonder vak",
        totaal: 0,
        aanwezig: 0,
      });
    }
    const r = perVakMap.get(sleutel)!;
    r.totaal++;
    if (a.status === "AANWEZIG") r.aanwezig++;
  }

  const geschiedenis = aanwezigheid
    .map((a) => ({
      id: a.id,
      status: a.status,
      lesId: a.les.id,
      datum: a.les.datum,
      begintijd: a.les.begintijd,
      eindtijd: a.les.eindtijd,
      lokaal: a.les.lokaal,
      klasNaam: a.les.klas?.naam ?? null,
      vakNaam: a.les.vak?.naam ?? null,
    }))
    .sort((x, y) => {
      const d = new Date(y.datum).getTime() - new Date(x.datum).getTime();
      return d !== 0 ? d : (y.begintijd ?? "").localeCompare(x.begintijd ?? "");
    });

  return NextResponse.json({
    leerling,
    notities,
    klassen,
    vakken,
    aanwezigheid: {
      totaal,
      aanwezig: telling.AANWEZIG,
      afwezig: telling.AFWEZIG,
      teLaat: telling.TE_LAAT,
      geoorloofd: telling.GEOORLOOFD,
      // Zelfde maat als het leerlingdashboard: aanwezig gedeeld door alles.
      percentage: totaal > 0 ? Math.round((telling.AANWEZIG / totaal) * 100) : null,
      perVak: [...perVakMap.values()]
        .map((r) => ({ ...r, percentage: r.totaal > 0 ? Math.round((r.aanwezig / r.totaal) * 100) : null }))
        .sort((a, b) => a.vakNaam.localeCompare(b.vakNaam)),
      geschiedenis,
    },
  });
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
