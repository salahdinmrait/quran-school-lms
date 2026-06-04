import nodemailer from "nodemailer";

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

// ─── Email templates ──────────────────────────────────────────────────────────

export function passwordResetEmail(naam: string, resetUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
      <h2 style="color:#15803d">Wachtwoord opnieuw instellen</h2>
      <p>Hallo ${naam},</p>
      <p>U heeft een verzoek ingediend om uw wachtwoord opnieuw in te stellen. Klik op de knop hieronder:</p>
      <a href="${resetUrl}" style="display:inline-block;background:#15803d;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
        Wachtwoord opnieuw instellen
      </a>
      <p style="color:#6b7280;font-size:13px">Deze link vervalt over 1 uur. Als u dit verzoek niet heeft ingediend, kunt u deze e-mail negeren.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">Jadwal — Quran School LMS</p>
    </div>
  `;
}

export function berichtNotificatieEmail(
  ontvangerNaam: string,
  verzenderNaam: string,
  onderwerp: string,
  appUrl: string
): string {
  return `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
      <h2 style="color:#15803d">Nieuw bericht ontvangen</h2>
      <p>Hallo ${ontvangerNaam},</p>
      <p>U heeft een nieuw bericht ontvangen van <strong>${verzenderNaam}</strong>.</p>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px;border-radius:4px">
        <strong>Onderwerp:</strong> ${onderwerp}
      </p>
      <a href="${appUrl}/leerling/berichten" style="display:inline-block;background:#15803d;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
        Bericht lezen
      </a>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">Jadwal — Quran School LMS</p>
    </div>
  `;
}
