import { SignJWT, jwtVerify } from "jose";

// Tokens for the mobile app (iOS/Android). Signed with the same secret as
// NextAuth so no extra env var is needed. 30 days validity.

export interface MobileTokenPayload {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "DOCENT" | "LEERLING" | "OUDER";
  schoolId: string | null;
  isVolwassen: boolean;
}

function secretKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signMobileToken(payload: MobileTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("quran-school-lms")
    .setAudience("mobile-app")
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifyMobileToken(token: string): Promise<MobileTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "quran-school-lms",
      audience: "mobile-app",
    });
    if (!payload.id || !payload.role) return null;
    return {
      id: payload.id as string,
      name: (payload.name as string) ?? "",
      email: (payload.email as string) ?? "",
      role: payload.role as MobileTokenPayload["role"],
      schoolId: (payload.schoolId as string | null) ?? null,
      isVolwassen: (payload.isVolwassen as boolean) ?? false,
    };
  } catch {
    return null;
  }
}
