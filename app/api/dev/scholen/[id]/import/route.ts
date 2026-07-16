import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDevAuthenticated } from "@/lib/dev-auth";
import { sendMail, welkomstEmail } from "@/lib/email";
import { hash } from "bcryptjs";
import ExcelJS from "exceljs";
import crypto from "crypto";

// Import kan bij honderden rijen lang duren (hashen + mails versturen)
export const maxDuration = 300;

const GELDIGE_ROLLEN = ["LEERLING", "OUDER", "DOCENT", "ADMIN"] as const;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBAPP_URL = process.env.WEBAPP_URL ?? "https://quran-school-app.vercel.app";

type RijResultaat = {
  rij: number;
  naam: string;
  email: string;
  status: "aangemaakt" | "overgeslagen" | "fout";
  reden?: string;
  wachtwoord?: string;
};

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  for (const b of bytes) pw += chars[b % chars.length];
  return pw;
}

// Excel-cellen kunnen strings, nummers, hyperlink-objecten of richText zijn
function celTekst(waarde: ExcelJS.CellValue): string {
  if (waarde == null) return "";
  if (typeof waarde === "string") return waarde.trim();
  if (typeof waarde === "number") return String(waarde);
  if (typeof waarde === "object") {
    if ("text" in waarde && typeof waarde.text === "string") return waarde.text.trim();
    if ("richText" in waarde && Array.isArray(waarde.richText)) {
      return waarde.richText.map((r) => r.text).join("").trim();
    }
    if ("result" in waarde) return celTekst(waarde.result as ExcelJS.CellValue);
  }
  return String(waarde).trim();
}

const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST /api/dev/scholen/[id]/import — verwerk een ingevulde Excel-template:
// maakt accounts aan en stuurt iedere nieuwe gebruiker een welkomstmail met
// inloggegevens + wachtwoord-kies-link (7 dagen geldig).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isDevAuthenticated())) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const school = await prisma.school.findUnique({ where: { id } });
  if (!school) {
    return NextResponse.json({ error: "School niet gevonden" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const bestand = formData.get("bestand");
    if (!(bestand instanceof File)) {
      return NextResponse.json({ error: "Geen bestand ontvangen" }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await bestand.arrayBuffer());
    const sheet = workbook.getWorksheet("Gebruikers") ?? workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: "Geen werkblad gevonden in het bestand" }, { status: 400 });
    }

    // ── Rijen inlezen en valideren ──────────────────────────────────────────
    type Kandidaat = {
      rij: number;
      naam: string;
      email: string;
      telefoon: string | null;
      rol: string;
    };
    const kandidaten: Kandidaat[] = [];
    const resultaten: RijResultaat[] = [];
    const gezieneEmails = new Set<string>();

    sheet.eachRow((row, rijNr) => {
      if (rijNr === 1) return; // kopregel

      const voornaam = celTekst(row.getCell(1).value);
      const achternaam = celTekst(row.getCell(2).value);
      const email = celTekst(row.getCell(3).value).toLowerCase();
      const telefoon = celTekst(row.getCell(4).value);
      const rol = celTekst(row.getCell(5).value).toUpperCase();

      // Volledig lege rij overslaan
      if (!voornaam && !achternaam && !email && !telefoon && !rol) return;

      const naam = [voornaam, achternaam].filter(Boolean).join(" ");

      if (!voornaam) {
        resultaten.push({ rij: rijNr, naam, email, status: "fout", reden: "Voornaam ontbreekt" });
        return;
      }
      if (!email || !EMAIL_REGEX.test(email)) {
        resultaten.push({ rij: rijNr, naam, email, status: "fout", reden: "Ongeldig of ontbrekend e-mailadres" });
        return;
      }
      if (!GELDIGE_ROLLEN.includes(rol as (typeof GELDIGE_ROLLEN)[number])) {
        resultaten.push({ rij: rijNr, naam, email, status: "fout", reden: `Ongeldige rol "${rol || "(leeg)"}" — gebruik LEERLING, OUDER, DOCENT of ADMIN` });
        return;
      }
      if (gezieneEmails.has(email)) {
        resultaten.push({ rij: rijNr, naam, email, status: "fout", reden: "E-mailadres staat dubbel in het bestand" });
        return;
      }
      // Voorbeeldrij uit de template negeren
      if (email === "ahmed@voorbeeld.nl") return;

      gezieneEmails.add(email);
      kandidaten.push({ rij: rijNr, naam, email, telefoon: telefoon || null, rol });
    });

    if (kandidaten.length === 0 && resultaten.length === 0) {
      return NextResponse.json({ error: "Geen ingevulde rijen gevonden in het bestand" }, { status: 400 });
    }

    // ── Bestaande e-mailadressen overslaan ──────────────────────────────────
    const bestaand = await prisma.user.findMany({
      where: { email: { in: kandidaten.map((k) => k.email) } },
      select: { email: true },
    });
    const bestaandeEmails = new Set(bestaand.map((b) => b.email));

    // ── Accounts aanmaken + welkomstmails versturen ─────────────────────────
    for (const k of kandidaten) {
      if (bestaandeEmails.has(k.email)) {
        resultaten.push({ rij: k.rij, naam: k.naam, email: k.email, status: "overgeslagen", reden: "E-mailadres bestaat al" });
        continue;
      }

      try {
        const wachtwoord = generatePassword();
        const user = await prisma.user.create({
          data: {
            name: k.naam,
            email: k.email,
            password: await hash(wachtwoord, 12),
            role: k.rol,
            telefoon: k.telefoon,
            schoolId: school.id,
          },
        });

        // Wachtwoord-kies-link, 7 dagen geldig
        const resetToken = crypto.randomBytes(32).toString("hex");
        await prisma.passwordResetToken.create({
          data: {
            token: resetToken,
            gebruikerId: user.id,
            verlooptOp: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
        const resetUrl = `${appUrl}/login/reset-password?token=${resetToken}`;

        await sendMail({
          to: k.email,
          subject: `Uw Jadwal-account voor ${school.naam}`,
          html: welkomstEmail(k.naam, k.email, wachtwoord, resetUrl, school.naam, WEBAPP_URL),
        });
        // Resend-limiet is ~2 mails/seconde
        await wacht(600);

        resultaten.push({ rij: k.rij, naam: k.naam, email: k.email, status: "aangemaakt", wachtwoord });
      } catch (err) {
        console.error(`[import] rij ${k.rij} (${k.email})`, err);
        resultaten.push({ rij: k.rij, naam: k.naam, email: k.email, status: "fout", reden: "Aanmaken mislukt (serverfout)" });
      }
    }

    resultaten.sort((a, b) => a.rij - b.rij);
    return NextResponse.json({
      totaal: resultaten.length,
      aangemaakt: resultaten.filter((r) => r.status === "aangemaakt").length,
      overgeslagen: resultaten.filter((r) => r.status === "overgeslagen").length,
      fouten: resultaten.filter((r) => r.status === "fout").length,
      resultaten,
    });
  } catch (err) {
    console.error("[POST /api/dev/scholen/[id]/import]", err);
    return NextResponse.json({ error: "Kon het bestand niet verwerken — is het een geldig .xlsx-bestand?" }, { status: 500 });
  }
}
