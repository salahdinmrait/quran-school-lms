import { headers } from "next/headers";
import { auth as nextAuth } from "@/lib/auth";
import { verifyMobileToken } from "@/lib/mobile-jwt";

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
  };
} | null;

export async function auth(): Promise<ApiSession> {
  const h = await headers();
  const authz = h.get("authorization");

  if (authz?.startsWith("Bearer ")) {
    const payload = await verifyMobileToken(authz.slice(7));
    if (!payload) return null;
    return { user: payload };
  }

  return (await nextAuth()) as ApiSession;
}
