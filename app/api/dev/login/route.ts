import { NextRequest, NextResponse } from "next/server";
import { expectedDevToken, DEV_COOKIE } from "@/lib/dev-auth";
import { telPogingen, registreerPoging, clientIp } from "@/lib/rate-limit";
import { leesJson } from "@/lib/json-body";

// POST /api/dev/login — developer console login with DEVELOPER_SECRET
export async function POST(req: NextRequest) {
  const gelezen = await leesJson(req);
  if (!gelezen.ok) return gelezen.response;
  const { secret } = gelezen.data;

  if (!process.env.DEVELOPER_SECRET) {
    return NextResponse.json(
      { error: "DEVELOPER_SECRET is niet geconfigureerd op de server" },
      { status: 500 }
    );
  }

  // Brute-force-bescherming: max 10 mislukte pogingen per IP per 15 min
  const ipSleutel = `devlogin-ip:${clientIp(req.headers)}`;
  if ((await telPogingen(ipSleutel, 15)) >= 10) {
    return NextResponse.json(
      { error: "Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw." },
      { status: 429 }
    );
  }

  if (!secret || secret !== process.env.DEVELOPER_SECRET) {
    await registreerPoging(ipSleutel);
    return NextResponse.json({ error: "Ongeldige developer-sleutel" }, { status: 401 });
  }

  const token = await expectedDevToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_COOKIE, token!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dagen
  });
  return res;
}

// DELETE /api/dev/login — logout
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
