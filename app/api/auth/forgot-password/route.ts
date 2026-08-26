import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail, passwordResetEmail } from "@/lib/email";
import { telPogingen, registreerPoging, clientIp } from "@/lib/rate-limit";
import { wachtwoordInstellenUrl } from "@/lib/urls";
import crypto from "crypto";
import { leesJson } from "@/lib/json-body";

// POST /api/auth/forgot-password — request a password reset link
export async function POST(req: NextRequest) {
  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;
  const { email } = gelezen.data;
  if (!email) return NextResponse.json({ error: "E-mail is verplicht" }, { status: 400 });

  const emailNorm = String(email).toLowerCase().trim();
  const ip = clientIp(req.headers);
  const emailSleutel = `reset-email:${emailNorm}`;
  const ipSleutel = `reset-ip:${ip}`;

  // Max 3 verzoeken per e-mailadres en 10 per IP per uur (voorkomt mail-spam)
  const [perEmail, perIp] = await Promise.all([
    telPogingen(emailSleutel, 60),
    telPogingen(ipSleutel, 60),
  ]);
  if (perEmail >= 3 || perIp >= 10) {
    return NextResponse.json(
      { error: "Te veel verzoeken. Probeer het over een uur opnieuw." },
      { status: 429 }
    );
  }
  await Promise.all([registreerPoging(emailSleutel), registreerPoging(ipSleutel)]);

  const gebruiker = await prisma.user.findUnique({ where: { email: emailNorm } });

  // Always return success to prevent email enumeration.
  // Gearchiveerde/gedeactiveerde accounts krijgen geen reset-mail.
  if (!gebruiker || !gebruiker.actief || gebruiker.verwijderdOp) {
    return NextResponse.json({ success: true });
  }

  // Invalidate old tokens
  await prisma.passwordResetToken.updateMany({
    where: { gebruikerId: gebruiker.id, gebruikt: false },
    data: { gebruikt: true },
  });

  // Create new token (1 hour expiry)
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      token,
      gebruikerId: gebruiker.id,
      verlooptOp: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const resetUrl = wachtwoordInstellenUrl(token);

  await sendMail({
    to: gebruiker.email,
    subject: "Wachtwoord opnieuw instellen — Jadwal",
    html: passwordResetEmail(gebruiker.name, resetUrl, gebruiker.email),
  });

  return NextResponse.json({ success: true });
}
