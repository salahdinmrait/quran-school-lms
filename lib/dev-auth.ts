import { cookies, headers } from "next/headers";
import { expectedDevToken, DEV_COOKIE } from "@/lib/dev-token";

// Auth for the developer onboarding console (/dev).
// Login with DEVELOPER_SECRET → HTTP-only cookie containing an HMAC-derived
// session token.

export { expectedDevToken, DEV_COOKIE };

// For /api/dev/* route handlers: accepts the session cookie (browser)
// or an x-dev-secret header (scripts/CI).
export async function isDevAuthenticated(): Promise<boolean> {
  const secret = process.env.DEVELOPER_SECRET;
  if (!secret) return false;

  const expected = await expectedDevToken();
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(DEV_COOKIE)?.value;
  if (expected && cookieVal === expected) return true;

  const h = await headers();
  if (h.get("x-dev-secret") === secret) return true;

  return false;
}
