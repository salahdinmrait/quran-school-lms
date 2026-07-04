/**
 * Jadwal LMS — Test Seed
 * Creates: 1 admin, 2 docenten, 100 leerlingen, 62 ouders (unique by parent name),
 * 2 klassen, 5 vakken, and all the join-table links.
 * Idempotent: safe to run multiple times.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

// ─── Passwords ───────────────────────────────────────────────────────────────
const ADMIN_PW    = "Admin@2024";
const DOCENT_PW   = "Docent@2024";
const LEERLING_PW = "Leerling@2024";
const OUDER_PW    = "Ouder@2024";

// ─── Student data from CSV ───────────────────────────────────────────────────
interface Row { nr: number; name: string; parentName: string; }

const studenten: Row[] = [
  { nr:  1, name: "Omar Al-Rashidi",      parentName: "Khalid Al-Rashidi" },
  { nr:  2, name: "Leila Al-Rashidi",     parentName: "Khalid Al-Rashidi" },
  { nr:  3, name: "Yusuf Al-Rashidi",     parentName: "Khalid Al-Rashidi" },
  { nr:  4, name: "Emma De Vries",        parentName: "Erik De Vries" },
  { nr:  5, name: "Lotte De Vries",       parentName: "Erik De Vries" },
  { nr:  6, name: "Bas De Vries",         parentName: "Erik De Vries" },
  { nr:  7, name: "Kofi Mensah",          parentName: "Kwame Mensah" },
  { nr:  8, name: "Akosua Mensah",        parentName: "Kwame Mensah" },
  { nr:  9, name: "Sofia Garcia",         parentName: "Miguel Garcia" },
  { nr: 10, name: "Carlos Garcia",        parentName: "Miguel Garcia" },
  { nr: 11, name: "Isabel Garcia",        parentName: "Miguel Garcia" },
  { nr: 12, name: "Hana Yamamoto",        parentName: "Hiroshi Yamamoto" },
  { nr: 13, name: "Ren Yamamoto",         parentName: "Hiroshi Yamamoto" },
  { nr: 14, name: "Adaeze Okonkwo",       parentName: "Emeka Okonkwo" },
  { nr: 15, name: "Chukwuemeka Okonkwo",  parentName: "Emeka Okonkwo" },
  { nr: 16, name: "Ngozi Okonkwo",        parentName: "Emeka Okonkwo" },
  { nr: 17, name: "Anika Patel",          parentName: "Rajesh Patel" },
  { nr: 18, name: "Dev Patel",            parentName: "Rajesh Patel" },
  { nr: 19, name: "Jonas Muller",         parentName: "Thomas Muller" },
  { nr: 20, name: "Anna Muller",          parentName: "Thomas Muller" },
  { nr: 21, name: "Felix Muller",         parentName: "Thomas Muller" },
  { nr: 22, name: "Rania Benali",         parentName: "Yassine Benali" },
  { nr: 23, name: "Hamza Benali",         parentName: "Yassine Benali" },
  { nr: 24, name: "Maja Johansson",       parentName: "Anders Johansson" },
  { nr: 25, name: "Axel Johansson",       parentName: "Anders Johansson" },
  { nr: 26, name: "Elin Johansson",       parentName: "Anders Johansson" },
  { nr: 27, name: "Pablo Fernandez",      parentName: "Ricardo Fernandez" },
  { nr: 28, name: "Lucia Fernandez",      parentName: "Ricardo Fernandez" },
  { nr: 29, name: "Kweku Nkrumah",        parentName: "Ato Nkrumah" },
  { nr: 30, name: "Ama Nkrumah",          parentName: "Ato Nkrumah" },
  { nr: 31, name: "Camille Dubois",       parentName: "Laurent Dubois" },
  { nr: 32, name: "Hugo Dubois",          parentName: "Laurent Dubois" },
  { nr: 33, name: "Manon Dubois",         parentName: "Laurent Dubois" },
  { nr: 34, name: "Ziad Al-Farouqi",      parentName: "Tariq Al-Farouqi" },
  { nr: 35, name: "Sara Al-Farouqi",      parentName: "Tariq Al-Farouqi" },
  { nr: 36, name: "Sanne Bakker",         parentName: "Peter Bakker" },
  { nr: 37, name: "Daan Bakker",          parentName: "Peter Bakker" },
  { nr: 38, name: "Fleur Bakker",         parentName: "Peter Bakker" },
  { nr: 39, name: "Mia Andersen",         parentName: "Lars Andersen" },
  { nr: 40, name: "Gabriel Santos",       parentName: "Felipe Santos" },
  { nr: 41, name: "Ana Santos",           parentName: "Felipe Santos" },
  { nr: 42, name: "Younes Ibrahim",       parentName: "Hassan Ibrahim" },
  { nr: 43, name: "Dina Ibrahim",         parentName: "Hassan Ibrahim" },
  { nr: 44, name: "Kareem Ibrahim",       parentName: "Hassan Ibrahim" },
  { nr: 45, name: "Ji-ho Kim",            parentName: "Jae-won Kim" },
  { nr: 46, name: "Soo-yeon Kim",         parentName: "Jae-won Kim" },
  { nr: 47, name: "Giulia Rossi",         parentName: "Marco Rossi" },
  { nr: 48, name: "Matteo Rossi",         parentName: "Marco Rossi" },
  { nr: 49, name: "Lara Boutros",         parentName: "Georges Boutros" },
  { nr: 50, name: "Joost Smit",           parentName: "Kees Smit" },
  { nr: 51, name: "Lieke Smit",           parentName: "Kees Smit" },
  { nr: 52, name: "Aminata Diallo",       parentName: "Mamadou Diallo" },
  { nr: 53, name: "Ibrahima Diallo",      parentName: "Mamadou Diallo" },
  { nr: 54, name: "Zofia Nowak",          parentName: "Marek Nowak" },
  { nr: 55, name: "Piotr Nowak",          parentName: "Marek Nowak" },
  { nr: 56, name: "Kasia Nowak",          parentName: "Marek Nowak" },
  { nr: 57, name: "Nabila Chowdhury",     parentName: "Rashed Chowdhury" },
  { nr: 58, name: "Rifat Chowdhury",      parentName: "Rashed Chowdhury" },
  { nr: 59, name: "Theo Moreau",          parentName: "Antoine Moreau" },
  { nr: 60, name: "Chloe Moreau",         parentName: "Antoine Moreau" },
  { nr: 61, name: "Louis Moreau",         parentName: "Antoine Moreau" },
  { nr: 62, name: "Kwabena Osei",         parentName: "Nana Osei" },
  { nr: 63, name: "Roos Jansen",          parentName: "Henk Jansen" },
  { nr: 64, name: "Tim Jansen",           parentName: "Henk Jansen" },
  { nr: 65, name: "Lina El-Masri",        parentName: "Samir El-Masri" },
  { nr: 66, name: "Khaled El-Masri",      parentName: "Samir El-Masri" },
  { nr: 67, name: "Michal Kowalski",      parentName: "Tomasz Kowalski" },
  { nr: 68, name: "Zosia Kowalski",       parentName: "Tomasz Kowalski" },
  { nr: 69, name: "Mira Steenberg",       parentName: "Jan Steenberg" },
  { nr: 70, name: "Tom van Dijk",         parentName: "Rob van Dijk" },
  { nr: 71, name: "Aisha Rashid",         parentName: "Bilal Rashid" },
  { nr: 72, name: "Lena Bauer",           parentName: "Klaus Bauer" },
  { nr: 73, name: "Musa Traore",          parentName: "Seydou Traore" },
  { nr: 74, name: "Nina Olsen",           parentName: "Bjorn Olsen" },
  { nr: 75, name: "Adam El-Khatib",       parentName: "Nour El-Khatib" },
  { nr: 76, name: "Zoe Papadopoulos",     parentName: "Stavros Papadopoulos" },
  { nr: 77, name: "Bilal Hamdouni",       parentName: "Said Hamdouni" },
  { nr: 78, name: "Yara Bergmann",        parentName: "Dirk Bergmann" },
  { nr: 79, name: "Leo Svensson",         parentName: "Hans Svensson" },
  { nr: 80, name: "Amina Coulibaly",      parentName: "Sekou Coulibaly" },
  { nr: 81, name: "Finn Larsen",          parentName: "Torben Larsen" },
  { nr: 82, name: "Nour Aziz",            parentName: "Fares Aziz" },
  { nr: 83, name: "Vera Novak",           parentName: "Pavel Novak" },
  { nr: 84, name: "Julian Castro",        parentName: "Diego Castro" },
  { nr: 85, name: "Tanya Boateng",        parentName: "Ernest Boateng" },
  { nr: 86, name: "Emir Yilmaz",          parentName: "Mehmet Yilmaz" },
  { nr: 87, name: "Grace Oduya",          parentName: "Victor Oduya" },
  { nr: 88, name: "Sam Visser",           parentName: "Arjan Visser" },
  { nr: 89, name: "Reem Saleh",           parentName: "Walid Saleh" },
  { nr: 90, name: "Tariq Hassan",         parentName: "Mahmoud Hassan" },
  { nr: 91, name: "Elena Popescu",        parentName: "Ion Popescu" },
  { nr: 92, name: "Sven Eriksson",        parentName: "Bo Eriksson" },
  { nr: 93, name: "Fatou Sow",            parentName: "Oumar Sow" },
  { nr: 94, name: "Mateus Oliveira",      parentName: "Bruno Oliveira" },
  { nr: 95, name: "Yuna Park",            parentName: "Sung-jin Park" },
  { nr: 96, name: "Celine Fontaine",      parentName: "Pascal Fontaine" },
  { nr: 97, name: "Idris Mansour",        parentName: "Farouk Mansour" },
  { nr: 98, name: "Petra Horvat",         parentName: "Stjepan Horvat" },
  { nr: 99, name: "Kenji Tanaka",         parentName: "Shiro Tanaka" },
  { nr: 100, name: "Layla Qasim",         parentName: "Amir Qasim" },
];

// ─── Email helper ─────────────────────────────────────────────────────────────
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-\s]+/g, ".")
    .replace(/[^a-z0-9.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}
const lEmail = (n: string) => `${toSlug(n)}@leerling.test`;
const oEmail  = (n: string) => `${toSlug(n)}@ouder.test`;

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱  Seeding Jadwal LMS…\n");

  // Hash once, reuse (test accounts)
  console.log("  Hashing passwords…");
  const [hashAdmin, hashDocent, hashLeerling, hashOuder] = await Promise.all([
    bcrypt.hash(ADMIN_PW,    10),
    bcrypt.hash(DOCENT_PW,   10),
    bcrypt.hash(LEERLING_PW, 10),
    bcrypt.hash(OUDER_PW,    10),
  ]);

  // 1 ── Admin
  await prisma.user.upsert({
    where:  { email: "admin@jadwal.test" },
    create: { name: "School Beheerder", email: "admin@jadwal.test", password: hashAdmin, role: "ADMIN" },
    update: {},
  });
  console.log("  ✓ Admin");

  // 2 ── Docenten
  const docent1 = await prisma.user.upsert({
    where:  { email: "docent1@jadwal.test" },
    create: { name: "Ustadh Ibrahim Al-Karim", email: "docent1@jadwal.test", password: hashDocent, role: "DOCENT" },
    update: {},
  });
  const docent2 = await prisma.user.upsert({
    where:  { email: "docent2@jadwal.test" },
    create: { name: "Ustadha Maryam Hassan", email: "docent2@jadwal.test", password: hashDocent, role: "DOCENT" },
    update: {},
  });
  console.log("  ✓ Docenten (2)");

  // 3 ── Vakken
  const vakDefs = [
    { naam: "Hifdh",    categorie: "HIFZ",     beschrijving: "Quranmemorisation" },
    { naam: "Tajweed",  categorie: "TAJWEED",   beschrijving: "Correcte recitatie" },
    { naam: "Arabisch", categorie: "ARABISCH",  beschrijving: "Arabische taal" },
    { naam: "Fiqh",     categorie: "FIQH",      beschrijving: "Islamitische jurisprudentie" },
    { naam: "Sira",     categorie: "SIRA",       beschrijving: "Profetbiografie" },
  ];
  const vakken: { id: string }[] = [];
  for (const v of vakDefs) {
    let vak = await prisma.vak.findFirst({ where: { naam: v.naam } });
    if (!vak) vak = await prisma.vak.create({ data: v });
    vakken.push({ id: vak.id });
  }
  console.log("  ✓ Vakken (5)");

  // 4 ── Klassen
  let klas1 = await prisma.klas.findFirst({ where: { naam: "Klas 1" } });
  if (!klas1) klas1 = await prisma.klas.create({ data: { naam: "Klas 1", beschrijving: "Eerste groep (1–50)" } });
  let klas2 = await prisma.klas.findFirst({ where: { naam: "Klas 2" } });
  if (!klas2) klas2 = await prisma.klas.create({ data: { naam: "Klas 2", beschrijving: "Tweede groep (51–100)" } });
  console.log("  ✓ Klassen (2)");

  // 5 ── Klas-Vak
  for (const klas of [klas1, klas2]) {
    for (const v of vakken) {
      await prisma.klasVak.upsert({
        where:  { klasId_vakId: { klasId: klas.id, vakId: v.id } },
        create: { klasId: klas.id, vakId: v.id },
        update: {},
      });
    }
  }

  // 6 ── Klas-Docent
  await prisma.klasDocent.upsert({
    where:  { klasId_docentId: { klasId: klas1.id, docentId: docent1.id } },
    create: { klasId: klas1.id, docentId: docent1.id },
    update: {},
  });
  await prisma.klasDocent.upsert({
    where:  { klasId_docentId: { klasId: klas2.id, docentId: docent2.id } },
    create: { klasId: klas2.id, docentId: docent2.id },
    update: {},
  });
  console.log("  ✓ Docenten & vakken gekoppeld aan klassen");

  // 7 ── Leerlingen
  const leerlingIds: { nr: number; id: string; name: string; email: string; parentName: string }[] = [];
  for (const s of studenten) {
    const email = lEmail(s.name);
    const u = await prisma.user.upsert({
      where: { email },
      create: { name: s.name, email, password: hashLeerling, role: "LEERLING" },
      update: {},
    });
    leerlingIds.push({ nr: s.nr, id: u.id, name: s.name, email, parentName: s.parentName });
    const klasId = s.nr <= 50 ? klas1.id : klas2.id;
    await prisma.klasLeerling.upsert({
      where:  { klasId_leerlingId: { klasId, leerlingId: u.id } },
      create: { klasId, leerlingId: u.id },
      update: {},
    });
  }
  console.log("  ✓ Leerlingen (100) + ingeschreven in klassen");

  // 8 ── Ouders
  const parentMap = new Map<string, { id: string; name: string; email: string }>();
  for (const s of studenten) {
    if (!parentMap.has(s.parentName)) {
      const email = oEmail(s.parentName);
      const u = await prisma.user.upsert({
        where: { email },
        create: { name: s.parentName, email, password: hashOuder, role: "OUDER" },
        update: {},
      });
      parentMap.set(s.parentName, { id: u.id, name: s.parentName, email });
    }
  }
  console.log(`  ✓ Ouders (${parentMap.size})`);

  // 9 ── Ouder-Leerling koppelingen
  for (const l of leerlingIds) {
    const ouder = parentMap.get(l.parentName)!;
    await prisma.ouderLeerling.upsert({
      where:  { leerlingId: l.id },
      create: { ouderId: ouder.id, leerlingId: l.id },
      update: {},
    });
  }
  console.log("  ✓ Ouder↔leerling koppelingen");

  // ─── Build output ─────────────────────────────────────────────────────────
  const sep = "─".repeat(74);
  const lines: string[] = [
    "╔══════════════════════════════════════════════════════════════════════════╗",
    "║               JADWAL LMS — TEST ACCOUNTS                                ║",
    "╚══════════════════════════════════════════════════════════════════════════╝",
    "",
    sep,
    "  ADMIN",
    sep,
    `  Email:      admin@jadwal.test`,
    `  Wachtwoord: ${ADMIN_PW}`,
    "",
    sep,
    "  DOCENTEN",
    sep,
    `  docent1@jadwal.test  /  ${DOCENT_PW}  →  Ustadh Ibrahim Al-Karim  (Klas 1)`,
    `  docent2@jadwal.test  /  ${DOCENT_PW}  →  Ustadha Maryam Hassan   (Klas 2)`,
    "",
    sep,
    `  LEERLINGEN — wachtwoord: ${LEERLING_PW}`,
    sep,
    "  #    Naam                          Email",
    "  " + "─".repeat(70),
    "  [ Klas 1 — leerlingen 1–50 ]",
  ];

  for (const l of leerlingIds.filter((l) => l.nr <= 50)) {
    lines.push(`  ${String(l.nr).padStart(3)}. ${l.name.padEnd(28)} ${l.email}`);
  }
  lines.push("");
  lines.push("  [ Klas 2 — leerlingen 51–100 ]");
  for (const l of leerlingIds.filter((l) => l.nr > 50)) {
    lines.push(`  ${String(l.nr).padStart(3)}. ${l.name.padEnd(28)} ${l.email}`);
  }

  lines.push("");
  lines.push(sep);
  lines.push(`  OUDERS (${parentMap.size} unieke accounts) — wachtwoord: ${OUDER_PW}`);
  lines.push(sep);
  lines.push("  Naam                           Email                              Kinderen");
  lines.push("  " + "─".repeat(70));

  const childrenByParent = new Map<string, string[]>();
  for (const l of leerlingIds) {
    if (!childrenByParent.has(l.parentName)) childrenByParent.set(l.parentName, []);
    childrenByParent.get(l.parentName)!.push(l.name);
  }

  const sortedParents = Array.from(parentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  for (const p of sortedParents) {
    const kids = (childrenByParent.get(p.name) ?? []).join(", ");
    lines.push(`  ${p.name.padEnd(30)} ${p.email.padEnd(35)} ${kids}`);
  }

  lines.push("");
  lines.push(sep);
  lines.push("  SCHOOL SETUP");
  lines.push(sep);
  lines.push("  2 klassen: Klas 1 (lln 1–50) en Klas 2 (lln 51–100)");
  lines.push("  5 vakken: Hifdh, Tajweed, Arabisch, Fiqh, Sira — beide klassen");
  lines.push("  Elke ouder is automatisch gekoppeld aan hun kind(eren)");
  lines.push(sep);

  const output = lines.join("\n");
  console.log("\n" + output + "\n");

  const outPath = join(process.cwd(), "prisma", "accounts.txt");
  writeFileSync(outPath, output + "\n", "utf-8");
  console.log(`📄  Opgeslagen in: prisma/accounts.txt\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
