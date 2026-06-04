import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// POST /api/auth/reset-password — set new password with valid token
export async function POST(req: NextRequest) {
  const { token, nieuwWachtwoord } = await req.json();
  if (!token || !nieuwWachtwoord) {
    return NextResponse.json({ error: "Token en nieuw wachtwoord zijn verplicht" }, { status: 400 });
  }
  if (nieuwWachtwoord.length < 8) {
    return NextResponse.json({ error: "Wachtwoord moet minimaal 8 tekens hebben" }, { status: 400 });
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { gebruiker: true },
  });

  if (!record || record.gebruikt || record.verlooptOp < new Date()) {
    return NextResponse.json({ error: "Link is ongeldig of verlopen" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(nieuwWachtwoord, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.gebruikerId }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { gebruikt: true } }),
  ]);

  return NextResponse.json({ success: true });
}
