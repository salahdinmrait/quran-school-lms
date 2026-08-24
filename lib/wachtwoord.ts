import crypto from "crypto";

// Tijdelijk wachtwoord voor een nieuw account. Geen l/I/O/0/1 — die worden bij
// het overtypen uit een mail te vaak verwisseld.
export function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  for (const b of bytes) pw += chars[b % chars.length];
  return pw;
}
