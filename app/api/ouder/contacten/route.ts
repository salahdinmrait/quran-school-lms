import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { contactenVoor } from "@/lib/contacten";

// GET /api/ouder/contacten — docenten van de klassen van de eigen kinderen +
// admins van de school. De tegenhanger van /api/leerling/contacten; beide
// gebruiken dezelfde regels uit lib/contacten.ts, die bij het versturen
// opnieuw worden gecontroleerd.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "OUDER") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const contacten = await contactenVoor(
    session.user.id,
    session.user.role,
    session.user.schoolId ?? null
  );

  return NextResponse.json(contacten);
}
