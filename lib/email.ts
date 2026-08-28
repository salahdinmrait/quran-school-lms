import nodemailer from "nodemailer";
import { LOGO_URL } from "./urls";

// Email is optional — if SMTP is not configured, emails are logged to console.
// Configure via .env:
//   SMTP_HOST=smtp.example.com
//   SMTP_PORT=587
//   SMTP_USER=your@email.com
//   SMTP_PASS=yourpassword
//   SMTP_FROM=Jadwal <noreply@yourschool.nl>

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: MailOptions): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    // Graceful fallback: log to console if SMTP is not configured
    console.log(`[EMAIL - not sent, SMTP not configured]\nTo: ${to}\nSubject: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "Jadwal <noreply@jadwal.nl>",
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("[EMAIL] Failed to send:", err);
  }
}

// ─── Huisstijl ────────────────────────────────────────────────────────────────
// Kleuren komen uit het Jadwal-design en zijn gelijk aan lib/theme.ts in de app,
// zodat mail en app dezelfde uitstraling hebben.

const KLEUR = {
  bg: "#FAF7F2", // bone — paginakleur
  card: "#FFFFFF",
  rand: "#E5E5E5", // hairline
  accent: "#9D5148", // terracotta
  accentDonker: "#8A473F", // burgundy
  accentLicht: "#F8E9E8", // blush
  ink: "#020817",
  gedempt: "#6B6560",
  vaag: "#8A8480",
} as const;

const KOP_FONT = "'Plus Jakarta Sans',Arial,Helvetica,sans-serif";
const TEKST_FONT = "Arial,Helvetica,sans-serif";

// Namen en schoolnamen komen uit vrije invoer (o.a. de Excel-import), dus
// escapen voor ze in de HTML belanden.
function esc(waarde: string): string {
  return waarde
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Alineatekst in de basisstijl. */
function alinea(html: string, marge = "0 0 16px 0"): string {
  return `<p style="margin:${marge};font-family:${TEKST_FONT};font-size:16px;line-height:24px;mso-line-height-rule:exactly;color:${KLEUR.ink};">${html}</p>`;
}

/** Kleine grijze toelichting onder een knop of alinea. */
function kleineTekst(html: string, marge = "24px 0 16px 0"): string {
  return `<p style="margin:${marge};font-family:${TEKST_FONT};font-size:14px;line-height:22px;mso-line-height-rule:exactly;color:${KLEUR.gedempt};">${html}</p>`;
}

/** Uitgelicht blok met een labelkop, bijv. inloggegevens. */
function paneel(label: string, regelsHtml: string[]): string {
  return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:1px solid ${KLEUR.rand};border-left:3px solid ${KLEUR.accent};" bgcolor="${KLEUR.accentLicht}">
          <tr>
            <td style="padding:24px;font-family:${TEKST_FONT};font-size:16px;line-height:26px;mso-line-height-rule:exactly;color:${KLEUR.ink};">
              <div style="font-family:${KOP_FONT};font-size:11px;line-height:16px;mso-line-height-rule:exactly;color:${KLEUR.accentDonker};letter-spacing:0.10em;text-transform:uppercase;padding-bottom:10px;">${esc(label)}</div>
              ${regelsHtml.map((r) => `<div>${r}</div>`).join("\n              ")}
            </td>
          </tr>
        </table>`;
}

/** Bulletproof CTA-knop (werkt ook in Outlook). */
function knop(url: string, tekst: string): string {
  return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" bgcolor="${KLEUR.accent}" style="border-radius:6px;background-color:${KLEUR.accent};box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <a href="${url}" style="display:block;padding:14px 28px;font-family:${KOP_FONT};font-size:16px;line-height:20px;mso-line-height-rule:exactly;color:${KLEUR.accentLicht};text-decoration:none;font-weight:bold;border-radius:6px;">${esc(tekst)}</a>
            </td>
          </tr>
        </table>`;
}

/**
 * Volledig mail-document in de Jadwal-huisstijl: table-based, inline styles,
 * 600px breed, met mobiele fallback. `preheader` is de voorbeeldtekst die
 * mailclients naast het onderwerp tonen.
 */
function mailLayout(opties: {
  titel: string;
  preheader: string;
  kop: string;
  inhoud: string;
  ontvangerEmail: string;
  voetnoot: string;
}): string {
  const { titel, preheader, kop, inhoud, ontvangerEmail, voetnoot } = opties;

  // Alleen tonen als er een echt postadres is geconfigureerd — geen verzonnen adres.
  const postadres = process.env.MAIL_AFZENDER_ADRES;

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(titel)}</title>
<!--[if mso]>
<style type="text/css">body,table,td,a{font-family:Arial,Helvetica,sans-serif !important;}</style>
<![endif]-->
<style type="text/css">
  a{color:${KLEUR.accent};}
  a:hover{color:${KLEUR.accentDonker};}
  @media only screen and (max-width:620px){
    .wrap{width:100% !important;}
    .gutter{padding-left:24px !important;padding-right:24px !important;}
    .h1{font-size:28px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${KLEUR.bg};">
<span style="display:none;font-size:1px;color:${KLEUR.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${KLEUR.bg};">
<tr>
<td align="center" style="padding:32px 12px;">

  <table role="presentation" class="wrap" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background-color:${KLEUR.card};border:1px solid ${KLEUR.rand};">

    <!-- Header -->
    <tr>
      <td class="gutter" style="padding:24px 40px;border-bottom:1px solid ${KLEUR.rand};" bgcolor="${KLEUR.card}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right:12px;line-height:0;font-size:0;"><img src="${LOGO_URL}" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border:0;"></td>
            <td style="font-family:${KOP_FONT};font-size:18px;line-height:24px;mso-line-height-rule:exactly;color:${KLEUR.ink};font-weight:bold;letter-spacing:-0.01em;">Jadwal<span style="color:${KLEUR.accent};">.</span></td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Sierlijn -->
    <tr>
      <td style="padding:0;line-height:0;font-size:0;" bgcolor="${KLEUR.accent}" height="3"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="1" height="3" alt="" style="display:block;height:3px;"></td>
    </tr>

    <!-- Body -->
    <tr>
      <td class="gutter" style="padding:48px 40px 0 40px;" bgcolor="${KLEUR.card}">
        <h1 class="h1" style="margin:0 0 24px 0;font-family:${KOP_FONT};font-size:32px;line-height:38px;mso-line-height-rule:exactly;color:${KLEUR.accent};font-weight:bold;letter-spacing:-0.02em;">${esc(kop)}</h1>
${inhoud}
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td class="gutter" style="padding:24px 40px 32px 40px;border-top:1px solid ${KLEUR.rand};" bgcolor="${KLEUR.bg}">
        <p style="margin:0 0 8px 0;font-family:${TEKST_FONT};font-size:13px;line-height:20px;mso-line-height-rule:exactly;color:${KLEUR.gedempt};">Jadwal</p>
        <p style="margin:0;font-family:${TEKST_FONT};font-size:12px;line-height:19px;mso-line-height-rule:exactly;color:${KLEUR.vaag};">
          ${ontvangerEmail ? `Dit bericht is verstuurd naar ${esc(ontvangerEmail)} ` : "U ontvangt dit bericht "}${esc(voetnoot)}${postadres ? `<br>${esc(postadres)}` : ""}
        </p>
      </td>
    </tr>

  </table>

</td>
</tr>
</table>
</body>
</html>`;
}

// ─── Email templates ──────────────────────────────────────────────────────────

export function passwordResetEmail(naam: string, resetUrl: string, email = ""): string {
  const inhoud = `
        ${alinea(`Hallo ${esc(naam)},`)}
        ${alinea("U heeft een verzoek ingediend om uw wachtwoord opnieuw in te stellen. Klik op de knop hieronder:", "0 0 32px 0")}
${knop(resetUrl, "Wachtwoord opnieuw instellen")}
        ${kleineTekst("Deze link vervalt over 1 uur. Als u dit verzoek niet heeft ingediend, kunt u deze e-mail negeren — er verandert dan niets aan uw account.", "24px 0 40px 0")}`;

  return mailLayout({
    titel: "Wachtwoord opnieuw instellen",
    preheader: "U kunt binnen 1 uur een nieuw wachtwoord instellen voor uw Jadwal-account.",
    kop: "Wachtwoord opnieuw instellen",
    inhoud,
    ontvangerEmail: email,
    voetnoot: "omdat er een verzoek is gedaan om het wachtwoord opnieuw in te stellen.",
  });
}

export function welkomstEmail(
  naam: string,
  email: string,
  wachtwoord: string,
  resetUrl: string,
  schoolNaam: string,
  webappUrl: string
): string {
  const inhoud = `
        ${alinea(`Beste ${esc(naam)},`)}
        ${alinea(
          `<strong style="font-weight:bold;">${esc(schoolNaam)}</strong> heeft een Jadwal-account voor u aangemaakt. Met Jadwal volgt u het rooster, huiswerk, cijfers en berichten van de school.`,
          "0 0 32px 0"
        )}
${paneel("Inloggegevens", [
  `E-mailadres: <strong style="font-weight:bold;">${esc(email)}</strong>`,
  `Tijdelijk wachtwoord: <strong style="font-weight:bold;font-family:'Courier New',Courier,monospace;letter-spacing:0.02em;">${esc(wachtwoord)}</strong>`,
])}
        ${alinea("We raden aan om direct een eigen wachtwoord te kiezen:", "32px 0 24px 0")}
${knop(resetUrl, "Kies je eigen wachtwoord")}
        ${kleineTekst(
          'Deze link is 7 dagen geldig. Daarna kunt u altijd nog inloggen met het tijdelijke wachtwoord hierboven en via "Wachtwoord vergeten" een nieuw wachtwoord instellen.'
        )}
        ${alinea(
          `Inloggen kan via <a href="${webappUrl}" style="color:${KLEUR.accent};text-decoration:underline;">${esc(webappUrl)}</a> of via de Jadwal-app.`,
          "0 0 40px 0"
        )}`;

  return mailLayout({
    titel: "Welkom bij Jadwal",
    preheader: "Uw Jadwal-account is aangemaakt. Hierin vindt u uw inloggegevens en tijdelijk wachtwoord.",
    kop: "Welkom bij Jadwal",
    inhoud,
    ontvangerEmail: email,
    voetnoot: "omdat er een account voor u is aangemaakt.",
  });
}

export function berichtNotificatieEmail(
  ontvangerNaam: string,
  verzenderNaam: string,
  onderwerp: string,
  appUrl: string,
  ontvangerEmail = ""
): string {
  const inhoud = `
        ${alinea(`Hallo ${esc(ontvangerNaam)},`)}
        ${alinea(
          `U heeft een nieuw bericht ontvangen van <strong style="font-weight:bold;">${esc(verzenderNaam)}</strong>.`,
          "0 0 32px 0"
        )}
${paneel("Onderwerp", [esc(onderwerp)])}
        <div style="height:32px;line-height:32px;font-size:0;">&nbsp;</div>
${knop(`${appUrl}/leerling/berichten`, "Bericht lezen")}
        ${kleineTekst("U ontvangt deze melding omdat er een nieuw bericht voor u klaarstaat in Jadwal.", "24px 0 40px 0")}`;

  return mailLayout({
    titel: "Nieuw bericht ontvangen",
    preheader: `Nieuw bericht van ${verzenderNaam}: ${onderwerp}`,
    kop: "Nieuw bericht",
    inhoud,
    ontvangerEmail,
    voetnoot: "omdat er een nieuw bericht voor u klaarstaat in Jadwal.",
  });
}
