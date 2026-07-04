import { headers } from "next/headers";
import { auth as nextAuth } from "@/lib/auth";
import { verifyMobileToken } from "@/lib/mobile-jwt";
import { prisma } from "@/lib/prisma";

// auth() for API routes: accepts both the NextAuth session cookie (web) and
// an Authorization: Bearer <jwt> header (mobile app). Returns the same
// session shape in both cases so route handlers don't care which client calls.

export type ApiSession = {
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "DOCENT" | "LEERLING" | "OUDER";
    schoolId: string | null;
    isVolwassen: boolean;
  };
} | null;

// Tokens zijn 30 dagen geldig; deze check zorgt dat een gearchiveerd of
// gedeactiveerd account direct buitengesloten is, ondanks een geldig token.
async function isAccountActief(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { actief: true, verwijderdOp: true },
  });
  return !!user && user.actief && !user.verwijderdOp;
}

export async function auth(): Promise<ApiSession> {
  const h = await headers();
  const authz = h.get("authorization");

  if (authz?.startsWith("Bearer ")) {
    const payload = await verifyMobileToken(authz.slice(7));
    if (!payload) return null;
    if (!(await isAccountActief(payload.id))) return null;
    return { user: payload };
  }

  const session = (await nextAuth()) as ApiSession;
  if (session?.user && !(await isAccountActief(session.user.id))) return null;
  return session;
}
