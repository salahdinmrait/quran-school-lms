import { NextRequest, NextResponse } from "next/server";
import { expectedDevToken, DEV_COOKIE } from "@/lib/dev-auth";

// POST /api/dev/login — developer console login with DEVELOPER_SECRET
export async function POST(req: NextRequest) {
  const { secret } = await req.json();

  if (!process.env.DEVELOPER_SECRET) {
    return NextResponse.json(
      { error: "DEVELOPER_SECRET is niet geconfigureerd op de server" },
      { status: 500 }
    );
  }

  if (!secret || secret !== process.env.DEVELOPER_SECRET) {
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
