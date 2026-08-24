import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Wie mag wie aanschrijven?
//
// Eén bron van waarheid voor de zichtbaarheids-/contactregels bij berichten.
// Zowel /api/leerling/contacten (de zoeklijst in de app) als POST /api/berichten
// (de controle bij het versturen) gebruiken deze functies — anders kan de lijst
// in de UI en de controle op de server uit elkaar lopen, en kan iemand met een
// zelfgemaakt verzoek langs de UI heen naar willekeurige id's sturen.
//
// De regels volgen de gewone relatiestructuur, niet de leeftijd:
//   LEERLING → docenten van de eigen klassen + admins van de school
//   OUDER    → docenten van de klassen van de eigen kinderen + admins
//   DOCENT / ADMIN → alle actieve accounts binnen de eigen school
// ─────────────────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  name: string;
  // Het e-mailadres staat erbij zodat de zoekbalk in de app op naam én adres
  // kan zoeken — twee docenten met dezelfde achternaam zijn anders niet uit
  // elkaar te houden.
  email: string;
}

export interface Contacten {
  docenten: Contact[];
  admins: Contact[];
}

function adminsVanSchool(schoolId: string | null) {
  return prisma.user.findMany({
    where: { role: "ADMIN", actief: true, verwijderdOp: null, schoolId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
}

/** Docenten van de klassen waar deze leerling in zit. */
async function docentenVanLeerling(leerlingId: string): Promise<Contact[]> {
  const koppelingen = await prisma.klasDocent.findMany({
    where: {
      klas: { verwijderdOp: null, leerlingen: { some: { leerlingId } } },
      docent: { verwijderdOp: null, actief: true },
    },
    include: { docent: { select: { id: true, name: true, email: true } } },
  });
  return Array.from(new Map(koppelingen.map((kd) => [kd.docent.id, kd.docent])).values());
}

/** Docenten van de klassen waar de kinderen van deze ouder in zitten. */
async function docentenVanOuder(ouderId: string): Promise<Contact[]> {
  const koppelingen = await prisma.klasDocent.findMany({
    where: {
      klas: {
        verwijderdOp: null,
        leerlingen: { some: { leerling: { kindVan: { some: { ouderId } } } } },
      },
      docent: { verwijderdOp: null, actief: true },
    },
    include: { docent: { select: { id: true, name: true, email: true } } },
  });
  return Array.from(new Map(koppelingen.map((kd) => [kd.docent.id, kd.docent])).values());
}

/**
 * De mensen die deze gebruiker mag aanschrijven, gegroepeerd voor de UI.
 * Alleen zinvol voor LEERLING en OUDER; docenten en admins gebruiken de
 * gewone gebruikerslijst van de school.
 */
export async function contactenVoor(
  userId: string,
  role: string,
  schoolId: string | null
): Promise<Contacten> {
  const [docenten, admins] = await Promise.all([
    role === "OUDER" ? docentenVanOuder(userId) : docentenVanLeerling(userId),
    adminsVanSchool(schoolId),
  ]);
  return { docenten, admins };
}

/**
 * Set met id's die deze gebruiker mag aanschrijven. Gebruikt bij het versturen.
 * Voor DOCENT/ADMIN geeft dit `null` terug: die zijn niet beperkt tot een
 * contactenlijst — voor hen geldt alleen de schoolgrens, die de aanroeper
 * al controleert.
 */
export async function toegestaneOntvangerIds(
  userId: string,
  role: string,
  schoolId: string | null
): Promise<Set<string> | null> {
  if (role !== "LEERLING" && role !== "OUDER") return null;
  const { docenten, admins } = await contactenVoor(userId, role, schoolId);
  return new Set([...docenten, ...admins].map((c) => c.id));
}
