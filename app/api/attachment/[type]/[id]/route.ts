import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { verifyMobileToken } from "@/lib/mobile-jwt";
import { prisma } from "@/lib/prisma";

// GET /api/attachment/[type]/[id] — generieke bijlage-download voor de nieuwe
// entiteiten (bericht, cijfer, inlevering, les, studiemateriaal) + huiswerk.
// Zelfde strategie/auth als /api/bijlage/[id]: Vercel Blob URL → redirect,
// anders base64 decoderen. Auth via sessie/Bearer/?token=.
type Bijlage = {
  bijlageNaam: string | null;
  bijlageUrl: string | null;
  bijlageData: string | null;
  bijlageType: string | null;
};

async function loadBijlage(type: string, id: string): Promise<Bijlage | null> {
  const select = { bijlageNaam: true, bijlageUrl: true, bijlageData: true, bijlageType: true };
  switch (type) {
    case "huiswerk":        return prisma.huiswerk.findUnique({ where: { id }, select });
    case "bericht":         return prisma.bericht.findUnique({ where: { id }, select });
    case "cijfer":          return prisma.cijfer.findUnique({ where: { id }, select });
    case "inlevering":      return prisma.inlevering.findUnique({ where: { id }, select });
    case "les":             return prisma.les.findUnique({ where: { id }, select });
    case "studiemateriaal": return prisma.studieMateriaal.findUnique({ where: { id }, select });
    default:                return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  let authenticated = false;
  const session = await auth();
  if (session?.user) authenticated = true;
  if (!authenticated) {
    const token = req.nextUrl.searchParams.get("token");
    if (token && (await verifyMobileToken(token))) authenticated = true;
  }
  if (!authenticated) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { type, id } = await params;
  const item = await loadBijlage(type, id);

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
