import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isDevAuthenticated } from "@/lib/dev-auth";
import { generatePassword } from "@/lib/wachtwoord";
import { leesJson } from "@/lib/json-body";
import { verwijderGebruikerDefinitief } from "@/lib/gebruiker-verwijderen";

// Eén account binnen een school beheren vanuit de dev-console.
//   PATCH  → wachtwoord opnieuw instellen (opgegeven of gegenereerd)
//   DELETE → definitief verwijderen, inclusief alles wat aan de persoon hangt
//
// Waarom hier hard verwijderd wordt en in de admin-omgeving zacht: e-mail is
// uniek over de hele database, dus een gearchiveerd account blijft zijn adres
// bezet houden. Een tweede import met datzelfde adres loopt daar op vast. De
// dev-console is de plek waar dat opgeruimd kan worden.

// Zoekt het account op én controleert dat het bij déze school hoort — anders
// zou een id uit een andere school hier bewerkt kunnen worden.
async function accountVanSchool(schoolId: string, userId: string) {
  if (!(await isDevAuthenticated())) return { error: "Geen toegang", status: 403 } as const;

  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
  if (!school) return { error: "School niet gevonden", status: 404 } as const;

  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, schoolId: true },
  });
  if (!account || account.schoolId !== school.id) {
    return { error: "Account niet gevonden bij deze school", status: 404 } as const;
  }

  return { account } as const;
}

// PATCH /api/dev/scholen/[id]/accounts/[userId] — body: { password?: string }
// Zonder wachtwoord wordt er een tijdelijke gegenereerd. Het nieuwe wachtwoord
// komt éénmalig terug in het antwoord; daarna staat alleen de hash nog in de
// database en is het niet meer op te vragen.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId } = await params;
  const ctx = await accountVanSchool(id, userId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;

  const opgegeven = gelezen.data.password;
  if (opgegeven !== undefined && typeof opgegeven !== "string") {
    return NextResponse.json({ error: "password moet een tekst zijn" }, { status: 400 });
  }
  if (typeof opgegeven === "string" && opgegeven.length > 0 && opgegeven.length < 8) {
    return NextResponse.json(
      { error: "Wachtwoord moet minimaal 8 tekens hebben" },
      { status: 400 }
    );
  }

  const wachtwoord = opgegeven || generatePassword();

  try {
    await prisma.user.update({
      where: { id: ctx.account.id },
      data: { password: await hash(wachtwoord, 12) },
    });

    // Openstaande herstel-links wijzen nu naar een wachtwoord dat niet meer
    // klopt; laat ze staan zodat de persoon zelf alsnog iets eigens kan kiezen.
    return NextResponse.json({
      id: ctx.account.id,
      name: ctx.account.name,
      email: ctx.account.email,
      role: ctx.account.role,
      password: wachtwoord,
    });
  } catch (err) {
    console.error("[PATCH /api/dev/scholen/[id]/accounts/[userId]]", err);
    return NextResponse.json({ error: "Kon wachtwoord niet wijzigen" }, { status: 500 });
  }
}

// Een account met veel geschiedenis raakt veel tabellen; geef het de ruimte.
export const maxDuration = 60;

// DELETE /api/dev/scholen/[id]/accounts/[userId] — body: { bevestiging: <e-mail> }
// ONOMKEERBAAR. Het veiligheidsslot is bewust het e-mailadres: in een lijst van
// honderden regels is één rij te ver klikken makkelijk, en hier is niets meer
// terug te draaien.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId } = await params;
  const ctx = await accountVanSchool(id, userId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await req.json().catch(() => ({}));
  const bevestiging = typeof body?.bevestiging === "string" ? body.bevestiging.trim().toLowerCase() : "";
  if (bevestiging !== ctx.account.email.toLowerCase()) {
    return NextResponse.json(
      { error: `Bevestiging klopt niet — typ "${ctx.account.email}" om te bevestigen.` },
      { status: 400 }
    );
  }

  try {
    await verwijderGebruikerDefinitief(ctx.account.id);
    console.log(
      `[DELETE /api/dev/scholen/${id}/accounts] "${ctx.account.name}" <${ctx.account.email}>`,
      `(${ctx.account.role}) definitief verwijderd`
    );
    return NextResponse.json({ success: true, verwijderd: ctx.account.email });
  } catch (err) {
    console.error("[DELETE /api/dev/scholen/[id]/accounts/[userId]]", err);
    return NextResponse.json({ error: "Kon account niet verwijderen" }, { status: 500 });
  }
}
