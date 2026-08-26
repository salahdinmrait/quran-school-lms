import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { bijlageAntwoord, bijlageGebruiker, loadBijlage } from "@/lib/bijlage";

// GET /api/bijlage/[id] — oudere link naar een huiswerk-bijlage. Blijft bestaan
// voor mails en app-versies die er nog naar wijzen; draait op dezelfde
// autorisatie als /api/attachment/huiswerk/[id]. Zonder die controle kon elke
// ingelogde gebruiker het huiswerk van elke school downloaden op id.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await bijlageGebruiker(req);
  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  return bijlageAntwoord(await loadBijlage("huiswerk", id, user));
}
