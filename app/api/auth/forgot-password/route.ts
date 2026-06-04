import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail, passwordResetEmail } from "@/lib/email";
import crypto from "crypto";

// POST /api/auth/forgot-password — request a password reset link
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "E-mail is verplicht" }, { status: 400 });

  const gebruiker = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration
  if (!gebruiker) {
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

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/login/reset-password?token=${token}`;

  await sendMail({
    to: gebruiker.email,
    subject: "Wachtwoord opnieuw instellen — Jadwal",
    html: passwordResetEmail(gebruiker.name, resetUrl),
  });

  return NextResponse.json({ success: true });
}
