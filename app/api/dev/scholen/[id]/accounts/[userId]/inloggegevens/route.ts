import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDevAuthenticated } from "@/lib/dev-auth";
import { inloggegevensStatus, verstuurNaarAccount } from "@/lib/inloggegevens";

// POST /api/dev/scholen/[id]/accounts/[userId]/inloggegevens
// Stuurt één account (opnieuw) zijn inloggegevens — ook als het die al eerder
// heeft gehad. Het account krijgt een nieuw tijdelijk wachtwoord en een nieuwe
// link; het oude wachtwoord en eerdere links werken daarna niet meer.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  if (!(await isDevAuthenticated())) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id, userId } = await params;
  const school = await prisma.school.findUnique({ where: { id }, select: { id: true, naam: true } });
  if (!school) return NextResponse.json({ error: "School niet gevonden" }, { status: 404 });

  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, schoolId: true, actief: true, verwijderdOp: true },
  });
  if (!account || account.schoolId !== school.id) {
    return NextResponse.json({ error: "Account niet gevonden bij deze school" }, { status: 404 });
  }
  if (!account.actief || account.verwijderdOp) {
    return NextResponse.json(
      { error: "Dit account is gearchiveerd of inactief — zet het eerst weer actief" },
      { status: 409 }
    );
  }

  try {
    await verstuurNaarAccount(account, school.naam);
  } catch (err) {
    console.error(`[inloggegevens] ${account.email}`, err);
    return NextResponse.json(
      { error: "De mail kon niet worden verstuurd. Het account is niet gewijzigd." },
      { status: 502 }
    );
  }

  return NextResponse.json({ verstuurd: account.email, ...(await inloggegevensStatus(school.id)) });
}
