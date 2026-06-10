// Shared between the Edge middleware and Node route handlers — must not
// import next/headers (not allowed in middleware).

export const DEV_COOKIE = "dev_session";

export async function expectedDevToken(): Promise<string | null> {
  const secret = process.env.DEVELOPER_SECRET;
  if (!secret) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("qsl-dev-session-v1"));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
