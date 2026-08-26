import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signMobileToken } from "@/lib/mobile-jwt";
import { telPogingen, registreerPoging, wisPogingen, clientIp } from "@/lib/rate-limit";
import { leesJson } from "@/lib/json-body";

// Brute-force-bescherming: max mislukte pogingen binnen het venster
const MAX_PER_EMAIL = 5; // per e-mailadres per 15 min
const MAX_PER_IP = 20; // per IP per 15 min
const VENSTER_MIN = 15;

// POST /api/mobile/login — login for the iOS/Android app.
// Body: { email, password } → { token, user }
export async function POST(req: NextRequest) {
  try {
    const gelezen = await leesJson(req);
    if (!gelezen.ok) return gelezen.response;
    const { email, password } = gelezen.data;

    if (!email || !password) {
      return NextResponse.json({ error: "E-mail en wachtwoord zijn verplicht" }, { status: 400 });
    }

    const emailNorm = String(email).toLowerCase().trim();
    const ip = clientIp(req.headers);
    const emailSleutel = `login-email:${emailNorm}`;
    const ipSleutel = `login-ip:${ip}`;

    const [emailPogingen, ipPogingen] = await Promise.all([
      telPogingen(emailSleutel, VENSTER_MIN),
      telPogingen(ipSleutel, VENSTER_MIN),
    ]);
    if (emailPogingen >= MAX_PER_EMAIL || ipPogingen >= MAX_PER_IP) {
      return NextResponse.json(
        { error: "Te veel mislukte inlogpogingen. Probeer het over 15 minuten opnieuw." },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: emailNorm },
      include: { school: { select: { id: true, naam: true, actief: true } } },
    });

    // Gearchiveerde (soft-deleted) accounts kunnen niet meer inloggen
    if (!user || !user.actief || user.verwijderdOp) {
      await Promise.all([registreerPoging(emailSleutel), registreerPoging(ipSleutel)]);
      return NextResponse.json({ error: "Ongeldige inloggegevens" }, { status: 401 });
    }

    if (user.school && !user.school.actief) {
      return NextResponse.json({ error: "Deze schoolomgeving is gedeactiveerd" }, { status: 403 });
    }

    const passwordValid = await compare(String(password), user.password);
    if (!passwordValid) {
      await Promise.all([registreerPoging(emailSleutel), registreerPoging(ipSleutel)]);
      return NextResponse.json({ error: "Ongeldige inloggegevens" }, { status: 401 });
    }

    // Geslaagde login: teller voor dit e-mailadres resetten
    await wisPogingen(emailSleutel);

    const token = await signMobileToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as "ADMIN" | "DOCENT" | "LEERLING" | "OUDER",
      schoolId: user.schoolId ?? null,
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
      },
    });
  } catch (err) {
    console.error("[POST /api/mobile/login]", err);
    return NextResponse.json({ error: "Inloggen mislukt" }, { status: 500 });
  }
}
