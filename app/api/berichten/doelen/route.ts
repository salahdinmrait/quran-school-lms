import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { doelenVoor } from "@/lib/berichten-doelen";

// GET /api/berichten/doelen — alles waar een admin of docent naartoe kan
// sturen: klassen (met leerlingen en ouders), docenten en beheer. Het scherm
// zet daar zelf groepen en losse personen uit samen.
export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const doelen = await doelenVoor(
    session.user.id,
    session.user.role,
    session.user.schoolId ?? null
  );
  return NextResponse.json(doelen);
}
