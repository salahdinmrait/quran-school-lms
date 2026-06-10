import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { verifyMobileToken } from "@/lib/mobile-jwt";
import { prisma } from "@/lib/prisma";

// GET /api/bijlage/[id] — download huiswerk bijlage
// Strategy: if bijlageUrl (Vercel Blob) is set → redirect there.
//           Else fall back to decoding legacy base64 bijlageData.
// Auth: web session, Bearer header, of ?token= (de mobiele app opent dit in de
// browser en kan daar geen Authorization-header meesturen).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params;

  const hw = await prisma.huiswerk.findUnique({
    where: { id },
    select: {
      id: true,
      bijlageNaam: true,
      bijlageUrl:  true,
      bijlageData: true,
      bijlageType: true,
    },
  });

  if (!hw || !hw.bijlageNaam) {
    return NextResponse.json({ error: "Geen bijlage gevonden" }, { status: 404 });
  }

  // Preferred path: Vercel Blob URL — just redirect the browser
  if (hw.bijlageUrl) {
    return NextResponse.redirect(hw.bijlageUrl);
  }

  // Legacy path: base64 data stored in DB
  if (hw.bijlageData) {
    const buffer = Buffer.from(hw.bijlageData, "base64");
    const contentType = hw.bijlageType ?? "application/octet-stream";
    const filename = encodeURIComponent(hw.bijlageNaam);
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
