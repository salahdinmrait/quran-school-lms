import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signMobileToken } from "@/lib/mobile-jwt";

// POST /api/mobile/login — login for the iOS/Android app.
// Body: { email, password } → { token, user }
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "E-mail en wachtwoord zijn verplicht" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: { school: { select: { id: true, naam: true, actief: true } } },
    });

    // Gearchiveerde (soft-deleted) accounts kunnen niet meer inloggen
    if (!user || !user.actief || user.verwijderdOp) {
      return NextResponse.json({ error: "Ongeldige inloggegevens" }, { status: 401 });
    }

    if (user.school && !user.school.actief) {
      return NextResponse.json({ error: "Deze schoolomgeving is gedeactiveerd" }, { status: 403 });
    }

    const passwordValid = await compare(String(password), user.password);
    if (!passwordValid) {
      return NextResponse.json({ error: "Ongeldige inloggegevens" }, { status: 401 });
    }

    const token = await signMobileToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as "ADMIN" | "DOCENT" | "LEERLING" | "OUDER",
      schoolId: user.schoolId ?? null,
      isVolwassen: user.isVolwassen ?? false,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId ?? null,
        schoolNaam: user.school?.naam ?? null,
        isVolwassen: user.isVolwassen ?? false,
      },
    });
  } catch (err) {
    console.error("[POST /api/mobile/login]", err);
    return NextResponse.json({ error: "Inloggen mislukt" }, { status: 500 });
  }
}
