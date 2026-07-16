import { prisma } from "@/lib/prisma";

// DB-gebaseerde rate limiting (fixed window). Serverless-veilig: de database
// is de enige gedeelde waarheid, dus limieten gelden over alle Vercel-instanties.
// Rijen worden opgeruimd door de dagelijkse backup-cron (/api/cron/backup).

// Fail-open: als de tabel (nog) niet bestaat of de query faalt, mag de rate
// limiter nooit het inloggen zelf breken — dan geldt er tijdelijk geen limiet.

/** Telt pogingen voor een sleutel binnen het venster (in minuten). */
export async function telPogingen(sleutel: string, vensterMinuten: number): Promise<number> {
  try {
    const vanaf = new Date(Date.now() - vensterMinuten * 60_000);
    return await prisma.loginPoging.count({
      where: { sleutel, tijdstip: { gte: vanaf } },
    });
  } catch (err) {
    console.error("[rate-limit] telPogingen faalde:", err);
    return 0;
  }
}

/** Registreert een (mislukte) poging voor een sleutel. */
export async function registreerPoging(sleutel: string): Promise<void> {
  try {
    await prisma.loginPoging.create({ data: { sleutel } });
  } catch (err) {
    console.error("[rate-limit] registreerPoging faalde:", err);
  }
}

/** Wist alle pogingen voor een sleutel (bv. na een geslaagde login). */
export async function wisPogingen(sleutel: string): Promise<void> {
  try {
    await prisma.loginPoging.deleteMany({ where: { sleutel } });
  } catch (err) {
    console.error("[rate-limit] wisPogingen faalde:", err);
  }
}

/** Haalt het client-IP uit de headers (Vercel zet x-forwarded-for). */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "onbekend";
}
