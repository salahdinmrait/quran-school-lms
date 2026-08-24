import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { verifyMobileToken, type MobileTokenPayload } from "@/lib/mobile-jwt";
import { prisma } from "@/lib/prisma";

// GET /api/attachment/[type]/[id] — generieke bijlage-download voor de nieuwe
// entiteiten (bericht, cijfer, inlevering, les, studiemateriaal) + huiswerk.
// Zelfde strategie/auth als /api/bijlage/[id]: Vercel Blob URL → redirect,
// anders base64 decoderen. Auth via sessie/Bearer/?token=.
//
// Belangrijk: ingelogd zijn is niet genoeg. Per type wordt de bijlage opgehaald
// mét een where-clausule die aan de rol van de aanvrager hangt — een leerling
// kan dus niet de bijlage van een andere klas opvragen door een id te raden.
type Bijlage = {
  bijlageNaam: string | null;
  bijlageUrl: string | null;
  bijlageData: string | null;
  bijlageType: string | null;
};

const SELECT = { bijlageNaam: true, bijlageUrl: true, bijlageData: true, bijlageType: true };

type Gebruiker = MobileTokenPayload;

// Klassen van deze gebruiker, afhankelijk van zijn rol. Levert de filter die
// bij "hoort deze klas bij mij?" hoort.
function klasFilter(user: Gebruiker) {
  switch (user.role) {
    case "DOCENT":
      return { docenten: { some: { docentId: user.id } } };
    case "LEERLING":
      return { leerlingen: { some: { leerlingId: user.id } } };
    case "OUDER":
      return { leerlingen: { some: { leerling: { kindVan: { some: { ouderId: user.id } } } } } };
    default:
      return { schoolId: user.schoolId };
  }
}

// De leerling(en) waarvan deze gebruiker gegevens mag inzien: zichzelf, zijn
// kinderen, of — voor docent/admin — iedereen binnen het eigen bereik.
function leerlingFilter(user: Gebruiker) {
  switch (user.role) {
    case "LEERLING":
      return { leerlingId: user.id };
    case "OUDER":
      return { leerling: { kindVan: { some: { ouderId: user.id } } } };
    case "DOCENT":
      return { leerling: { leerlingKlassen: { some: { klas: { docenten: { some: { docentId: user.id } } } } } } };
    default:
      return { leerling: { schoolId: user.schoolId } };
  }
}

async function loadBijlage(type: string, id: string, user: Gebruiker): Promise<Bijlage | null> {
  const isAdmin = user.role === "ADMIN";

  switch (type) {
    case "huiswerk":
      return prisma.huiswerk.findFirst({
        where: {
          id,
          vak: isAdmin
            ? { schoolId: user.schoolId }
            : { klassen: { some: { klas: klasFilter(user) } } },
          // Gericht huiswerk is alleen voor de leerling(en) in de doellijst;
          // een lege lijst betekent "hele klas".
          ...(user.role === "LEERLING"
            ? { OR: [{ doelLeerlingen: { none: {} } }, { doelLeerlingen: { some: { leerlingId: user.id } } }] }
            : {}),
        },
        select: SELECT,
      });

    case "bericht":
      // Alleen de twee mensen die het bericht aangaan — ook een admin leest
      // geen berichten van anderen mee.
      return prisma.bericht.findFirst({
        where: { id, OR: [{ verzenderId: user.id }, { ontvangerId: user.id }] },
        select: SELECT,
      });

    case "cijfer":
      return prisma.cijfer.findFirst({ where: { id, ...leerlingFilter(user) }, select: SELECT });

    case "inlevering":
      return prisma.inlevering.findFirst({ where: { id, ...leerlingFilter(user) }, select: SELECT });

    case "les":
      return prisma.les.findFirst({
        where: { id, klas: isAdmin ? { schoolId: user.schoolId } : klasFilter(user) },
        select: SELECT,
      });

    case "studiemateriaal":
      // Materiaal hangt aan een klas, aan een vak, of aan geen van beide
      // (schoolbreed). De docent die het plaatste mag er altijd bij.
      return prisma.studieMateriaal.findFirst({
        where: isAdmin
          ? { id, schoolId: user.schoolId }
          : {
              id,
              OR: [
                { docentId: user.id },
                { klas: klasFilter(user) },
                { klasId: null, vak: { klassen: { some: { klas: klasFilter(user) } } } },
                { klasId: null, vakId: null, schoolId: user.schoolId },
              ],
            },
        select: SELECT,
      });

    default:
      return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const session = await auth();
  let user: Gebruiker | null = session?.user ?? null;
  if (!user) {
    // Bijlagen worden ook geopend via een gewone browserlink; die kan geen
    // Authorization-header meesturen, vandaar ?token=.
    const token = req.nextUrl.searchParams.get("token");
    if (token) user = await verifyMobileToken(token);
  }
  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { type, id } = await params;
  const item = await loadBijlage(type, id, user);

  if (!item || !item.bijlageNaam) {
    return NextResponse.json({ error: "Geen bijlage gevonden" }, { status: 404 });
  }

  if (item.bijlageUrl) {
    return NextResponse.redirect(item.bijlageUrl);
  }

  if (item.bijlageData) {
    const buffer = Buffer.from(item.bijlageData, "base64");
    const contentType = item.bijlageType ?? "application/octet-stream";
    const filename = encodeURIComponent(item.bijlageNaam);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  }

  return NextResponse.json({ error: "Geen bijlage gevonden" }, { status: 404 });
}
