import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/bijlage/[id] — download huiswerk bijlage
// Accessible to DOCENT (their klassen), LEERLING (their klassen), ADMIN, OUDER (their kind's klassen)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;

  const hw = await prisma.huiswerk.findUnique({
    where: { id },
    select: { id: true, bijlageNaam: true, bijlageData: true, bijlageType: true },
  });

  if (!hw || !hw.bijlageData || !hw.bijlageNaam) {
    return NextResponse.json({ error: "Geen bijlage gevonden" }, { status: 404 });
  }

  // Decode base64
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
