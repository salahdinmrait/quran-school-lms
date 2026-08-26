/**
 * Prisma-foutcodes herkennen zonder de hele Prisma-namespace te importeren.
 *
 * Een dubbele waarde op een unieke kolom (P2002) is geen serverfout maar een
 * conflict: twee mensen die tegelijk hetzelfde e-mailadres of dezelfde
 * koppeling aanmaken horen 409 te krijgen, geen 500.
 */
export function isUniekFout(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  );
}

/** Rij bestaat niet (meer) — bij update/delete op een id dat weg is. */
export function isNietGevondenFout(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2025"
  );
}
