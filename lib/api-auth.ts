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
  };
} | null;

// Hoe vaak we `laatsteActiefOp` hoogstens bijwerken. Elk verzoek zou een
// schrijfactie per aanroep betekenen; eens per vijf minuten is nauwkeurig
// genoeg voor de mailregel (een uur) en kost vrijwel niets.
const ACTIEF_SCHRIJF_INTERVAL_MS = 5 * 60 * 1000;

// Tokens zijn 30 dagen geldig; deze check zorgt dat een gearchiveerd of
// gedeactiveerd account direct buitengesloten is, ondanks een geldig token.
//
// Meteen ook het moment om bij te houden wanneer iemand voor het laatst iets
// in de app deed: daarop besluit lib/bericht-notificatie.ts of er een mail
// uitgaat. Inlogtijd alleen zou niet werken — een mobiel token blijft dertig
// dagen geldig, dus wie ingelogd blijft logt bijna nooit opnieuw in.
async function isAccountActief(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { actief: true, verwijderdOp: true, laatsteActiefOp: true },
  });
  if (!user || !user.actief || user.verwijderdOp) return false;

  const nu = Date.now();
  if (!user.laatsteActiefOp || nu - user.laatsteActiefOp.getTime() > ACTIEF_SCHRIJF_INTERVAL_MS) {
    // Faalt dit, dan gaat het verzoek gewoon door: dit is een bijzaak.
    await prisma.user
      .update({ where: { id: userId }, data: { laatsteActiefOp: new Date(nu) } })
      .catch(() => {});
  }
  return true;
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
