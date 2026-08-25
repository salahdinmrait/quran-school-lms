import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import crypto from "crypto";
import { sendMail, welkomstEmail } from "@/lib/email";
import { WEBAPP_URL, wachtwoordInstellenUrl } from "@/lib/urls";
import { generatePassword } from "@/lib/wachtwoord";

// ────────────────────────────────────────────────────────────────────────────
// Inloggegevens versturen is een bewuste, losse handeling in de dev-console —
// de import maakt alleen accounts aan. Of iemand zijn gegevens al heeft gehad
// staat in de database (PasswordResetToken.verstuurdOp), niet in UI-state:
// een refresh, een dubbele import of een tweede klik verstuurt daardoor niets
// opnieuw.
// ────────────────────────────────────────────────────────────────────────────

const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Eén account dat nog op zijn inloggegevens wacht. */
export interface WachtendAccount {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface InloggegevensStatus {
  /** Alle actieve accounts van de school die een mail kunnen ontvangen */
  klaar: number;
  /** Hebben hun inloggegevens al gehad */
  alVerstuurd: number;
  /** Wachten nog op hun inloggegevens */
  nietVerstuurd: number;
  /**
   * Wíe er nog wacht — dezelfde verzameling die de POST zou aanschrijven, zodat
   * de dev-console vóór het versturen precies laat zien wie er mail krijgt.
   */
  wachtenden: WachtendAccount[];
}

/** Accounts die nog nooit inloggegevens gemaild hebben gekregen. */
function nogNietVerstuurdWhere(schoolId: string) {
  return {
    schoolId,
    actief: true,
    verwijderdOp: null,
    resetTokens: { none: { verstuurdOp: { not: null } } },
  };
}

export async function inloggegevensStatus(schoolId: string): Promise<InloggegevensStatus> {
  const [klaar, wachtenden] = await Promise.all([
    prisma.user.count({ where: { schoolId, actief: true, verwijderdOp: null } }),
    prisma.user.findMany({
      where: nogNietVerstuurdWhere(schoolId),
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
  ]);
  const nietVerstuurd = wachtenden.length;
  return { klaar, alVerstuurd: klaar - nietVerstuurd, nietVerstuurd, wachtenden };
}

export interface VerstuurResultaat {
  verstuurd: number;
  mislukt: { email: string; reden: string }[];
}

/**
 * Verstuurt de welkomstmail naar iedereen van deze school die er nog geen heeft
 * gehad. Elk account krijgt daarbij een vers tijdelijk wachtwoord en een nieuwe
 * link van 7 dagen — het oude wachtwoord uit de import is nooit gedeeld, dus er
 * gaat niets verloren. Pas als de mail écht weg is wordt `verstuurdOp` gezet.
 */
export async function verstuurInloggegevens(
  schoolId: string,
  schoolNaam: string
): Promise<VerstuurResultaat> {
  const ontvangers = await prisma.user.findMany({
    where: nogNietVerstuurdWhere(schoolId),
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const mislukt: VerstuurResultaat["mislukt"] = [];
  let verstuurd = 0;

  for (const user of ontvangers) {
    try {
      const wachtwoord = generatePassword();
      const token = crypto.randomBytes(32).toString("hex");

      await prisma.user.update({
        where: { id: user.id },
        data: { password: await hash(wachtwoord, 12) },
      });
      const rij = await prisma.passwordResetToken.create({
        data: {
          token,
          gebruikerId: user.id,
          verlooptOp: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await sendMail({
        to: user.email,
        subject: `Uw Jadwal-account voor ${schoolNaam}`,
        html: welkomstEmail(
          user.name,
          user.email,
          wachtwoord,
          wachtwoordInstellenUrl(token),
          schoolNaam,
          WEBAPP_URL
        ),
      });

      await prisma.passwordResetToken.update({
        where: { id: rij.id },
        data: { verstuurdOp: new Date() },
      });
      verstuurd++;

      // Resend-limiet is ~2 mails per seconde
      await wacht(600);
    } catch (err) {
      console.error(`[inloggegevens] ${user.email}`, err);
      mislukt.push({ email: user.email, reden: "Versturen mislukt" });
    }
  }

  return { verstuurd, mislukt };
}
