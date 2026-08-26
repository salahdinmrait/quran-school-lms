import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { bijlageAntwoord, bijlageGebruiker, loadBijlage } from "@/lib/bijlage";

// GET /api/attachment/[type]/[id] — bijlage-download voor bericht, cijfer,
// inlevering, les, studiemateriaal en huiswerk. De autorisatie per type staat
// in lib/bijlage.ts, zodat deze route en /api/bijlage/[id] dezelfde regels
// gebruiken.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const user = await bijlageGebruiker(req);
  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { type, id } = await params;
  return bijlageAntwoord(await loadBijlage(type, id, user));
}
