// Vult één school met demo-data om Jadwal aan klanten te kunnen laten zien.
//
// Gebruik (PowerShell, in de map quran-school-lms):
//   $env:DATABASE_URL="<Neon-string>"
//   npx tsx scripts/demo-vullen.ts --droog     # laat alleen zien wat het zou doen
//   npx tsx scripts/demo-vullen.ts             # vult de school
//   npx tsx scripts/demo-vullen.ts --opnieuw   # wist eerst de vorige demo-data
//
// Veiligheid: het script werkt uitsluitend binnen de school met slug
// SCHOOL_SLUG. Alles wat het aanmaakt krijgt die schoolId mee en een
// demo-markering; --opnieuw verwijdert alleen gemarkeerde rijen. Voor en na de
// vulling worden alle rijen van álle andere scholen geteld en vergeleken —
// wijkt er iets af, dan stopt het script met een foutmelding.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeFileSync } from "fs";
import path from "path";

const SCHOOL_SLUG = "test-school";
const DEMO_DOMEIN = "demo.jadwal.test";
// Staat in de beschrijving van elke demo-klas en elk demo-vak. Alleen rijen met
// deze markering mogen door --opnieuw verwijderd worden.
const MARKERING = "[demo]";
const WACHTWOORD = "Demo@2024";

const DROOG = process.argv.includes("--droog");
const OPNIEUW = process.argv.includes("--opnieuw");

const prisma = new PrismaClient();

// ── Willekeur met vaste startwaarde, zodat elke run dezelfde data oplevert ───
let zaad = 20260828;
function rnd() {
  zaad |= 0;
  zaad = (zaad + 0x6d2b79f5) | 0;
  let t = Math.imul(zaad ^ (zaad >>> 15), 1 | zaad);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function kies<T>(a: readonly T[]): T {
  return a[Math.floor(rnd() * a.length)];
}
function tussen(min: number, max: number) {
  return min + Math.floor(rnd() * (max - min + 1));
}
function husselen<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// ── Wie er in de school zit ─────────────────────────────────────────────────
const DOCENTEN = [
  { naam: "Ustadh Yassin El Amrani", email: `yassin@${DEMO_DOMEIN}`, telefoon: "06-24118834" },
  { naam: "Ustadha Fatima Bouzid", email: `fatima@${DEMO_DOMEIN}`, telefoon: "06-38927741" },
  { naam: "Ustadh Abdelilah Haddadi", email: `abdelilah@${DEMO_DOMEIN}`, telefoon: "06-11740592" },
  { naam: "Ustadha Khadija Yildirim", email: `khadija@${DEMO_DOMEIN}`, telefoon: "06-45803317" },
];

const BEHEERDER = { naam: "Nourdin Bakkali", email: `beheer@${DEMO_DOMEIN}`, telefoon: "06-19008842" };

// Elk gezin is één ouderaccount met één of twee kinderen. OuderLeerling heeft
// @@unique([leerlingId]): een kind heeft hoogstens één ouder.
const GEZINNEN: { ouder: string; kinderen: string[] }[] = [
  { ouder: "Rachid Boukhris", kinderen: ["Amine Boukhris", "Israa Boukhris"] },
  { ouder: "Nadia El Haddad", kinderen: ["Salma El Haddad"] },
  { ouder: "Hassan Ait Bella", kinderen: ["Youssef Ait Bella", "Lina Ait Bella"] },
  { ouder: "Samira Chakir", kinderen: ["Nour Chakir"] },
  { ouder: "Mustafa Ben Salah", kinderen: ["Ilyas Ben Salah"] },
  { ouder: "Latifa Ouazzani", kinderen: ["Maryam Ouazzani", "Adam Ouazzani"] },
  { ouder: "Erdem Demirci", kinderen: ["Bilal Demirci"] },
  { ouder: "Karima Kaddouri", kinderen: ["Aya Kaddouri"] },
  { ouder: "Abdellah El Fassi", kinderen: ["Rayan El Fassi", "Hafsa El Fassi"] },
  { ouder: "Zohra Belkacem", kinderen: ["Soumaya Belkacem"] },
  { ouder: "Serkan Yildiz", kinderen: ["Hamza Yildiz"] },
  { ouder: "Malika Zerrouki", kinderen: ["Imane Zerrouki"] },
  { ouder: "Driss Mansouri", kinderen: ["Ismail Mansouri"] },
  { ouder: "Fouzia Bouras", kinderen: ["Idriss Bouras"] },
  { ouder: "Ayse Ozturk", kinderen: ["Sara Ozturk", "Yasmina Ozturk"] },
  { ouder: "Said El Idrissi", kinderen: ["Zakaria El Idrissi"] },
  { ouder: "Hakima Cherkaoui", kinderen: ["Rania Cherkaoui"] },
  { ouder: "Noureddine Tazi", kinderen: ["Mohamed Amine Tazi"] },
  { ouder: "Jamila Boulahia", kinderen: ["Oussama Boulahia"] },
  { ouder: "Khalid Berrada", kinderen: ["Anas Berrada"] },
  { ouder: "Souad Ouhadi", kinderen: ["Ayoub Ouhadi", "Nada Ouhadi"] },
  { ouder: "Mounir Sahraoui", kinderen: ["Karim Sahraoui"] },
];

const VAKKEN = [
  { naam: "Hifdh", categorie: "HIFZ", beschrijving: "Memoriseren van de Koran" },
  { naam: "Tajweed", categorie: "TAJWEED", beschrijving: "Uitspraak en recitatieregels" },
  { naam: "Arabisch", categorie: "ARABISCH", beschrijving: "Lezen, schrijven en woordenschat" },
  { naam: "Fiqh", categorie: "FIQH", beschrijving: "Aanbidding en dagelijkse voorschriften" },
  { naam: "Sira", categorie: "SIRA", beschrijving: "Het leven van de Profeet" },
  { naam: "Akhlaq", categorie: "OVERIG", beschrijving: "Omgangsvormen en karaktervorming" },
];

// weekdag: 0 = zondag … 6 = zaterdag
const KLASSEN = [
  {
    naam: "Klas 1 — Beginners",
    beschrijving: "Eerste jaar, 7 t/m 9 jaar",
    weekdag: 6,
    lokaal: "Lokaal A",
    vakken: ["Hifdh", "Tajweed", "Arabisch"],
    docenten: [0, 3],
    aantal: 10,
  },
  {
    naam: "Klas 2 — Gevorderd",
    beschrijving: "Tweede en derde jaar, 10 t/m 12 jaar",
    weekdag: 0,
    lokaal: "Lokaal B",
    vakken: ["Hifdh", "Tajweed", "Arabisch", "Fiqh"],
    docenten: [1, 2],
    aantal: 10,
  },
  {
    naam: "Klas 3 — Hifdh",
    beschrijving: "Memorisatieklas, 12 jaar en ouder",
    weekdag: 6,
    lokaal: "Lokaal C",
    vakken: ["Hifdh", "Tajweed", "Sira", "Akhlaq"],
    docenten: [0, 2],
    aantal: 8,
  },
];

const WEKEN_TERUG = 10;
const WEKEN_VOORUIT = 3;
const LESTIJDEN = [
  { begintijd: "10:00", eindtijd: "11:00" },
  { begintijd: "11:15", eindtijd: "12:15" },
];

// ── Teksten ─────────────────────────────────────────────────────────────────
const DOSSIER_TEKSTEN = [
  { titel: "Kennismaking met de ouders", inhoud: "Kort gesproken na de les. Thuis wordt drie keer per week geoefend, meestal na maghrib. De ouder wil graag elke maand een korte terugkoppeling over de voortgang." },
  { titel: "Leestempo", inhoud: "Leest vlot maar slikt de laatste letter van een woord regelmatig in. We oefenen sinds deze maand met langzaam voorlezen en dat gaat duidelijk beter." },
  { titel: "Concentratie", inhoud: "Het tweede lesuur is lastig; de aandacht zakt na ongeveer twintig minuten weg. Vooraan zetten helpt. Afgesproken om de zwaarste stof in het eerste uur te doen." },
  { titel: "Memorisatie", inhoud: "Nieuwe ayaat gaan goed, de herhaling blijft achter. Advies gegeven om per week één oude soera mee te nemen in plaats van alleen nieuwe stof." },
  { titel: "Tajweed-aandachtspunt", inhoud: "De ghunnah wordt te kort aangehouden en idghaam gaat nog door elkaar met idhaar. Extra oefenblad meegegeven voor thuis." },
  { titel: "Gedrag in de klas", inhoud: "Helpt uit zichzelf klasgenoten die achterlopen en ruimt na de les op zonder dat het gevraagd wordt. Complimenteren waar het kan." },
  { titel: "Verzuim besproken", inhoud: "Twee keer afwezig geweest wegens ziekte, netjes vooraf gemeld door de ouder. De gemiste stof is in een extra kwartier na de les ingehaald." },
  { titel: "Arabisch schrijven", inhoud: "De verbindingen tussen de letters worden nog los geschreven. Schrijfschrift meegegeven; over vier weken kijken we opnieuw." },
  { titel: "Motivatie", inhoud: "Duidelijk gegroeid sinds de plaatsing in deze groep. Vraagt nu zelf om extra werk voor thuis, wat een half jaar geleden niet gebeurde." },
  { titel: "Gesprek met de ouder", inhoud: "De ouder maakt zich zorgen over het tempo vergeleken met leeftijdsgenoten. Uitgelegd dat de basis nu goed staat en dat versnellen daarna vanzelf gaat." },
  { titel: "Toetsresultaat", inhoud: "Mondelinge overhoring van de laatste tien ayaat foutloos afgelegd, alleen bij de laatste ayah even geaarzeld. Mooie stap vooruit." },
  { titel: "Groepsindeling", inhoud: "Werkt beter in een klein groepje dan klassikaal. Voor de komende periode ingedeeld bij een vast duo." },
  { titel: "Aandacht voor uitspraak", inhoud: "Het onderscheid tussen de letters saad en sien is nog wisselend. Wekelijks vijf minuten gericht oefenen aan het begin van de les." },
  { titel: "Thuissituatie", inhoud: "Verhuisd binnen de stad; de reistijd is langer geworden waardoor er soms een paar minuten te laat wordt binnengekomen. Afgesproken dat dit geen probleem is zolang het gemeld wordt." },
  { titel: "Huiswerk", inhoud: "Levert het huiswerk consequent op tijd in, meestal al ruim voor de volgende les. Het werk is verzorgd en netjes geschreven." },
  { titel: "Plan voor komend blok", inhoud: "Doel voor de komende acht weken: soera Al-Mulk afronden en de herhaling van juz 30 op peil houden. Tussentijds evalueren na vier weken." },
];

const HUISWERK_TEKSTEN: Record<string, { titel: string; beschrijving: string }[]> = {
  Hifdh: [
    { titel: "Soera Al-Mulk 1 t/m 10 memoriseren", beschrijving: "Leer de eerste tien ayaat uit je hoofd. Neem elke dag twee ayaat en herhaal het geheel op vrijdag." },
    { titel: "Herhaling juz 30", beschrijving: "Herhaal de soeras die we dit blok hebben gehad. Laat het thuis één keer aan iemand horen." },
    { titel: "Soera An-Naba 1 t/m 20", beschrijving: "Memoriseer tot en met ayah 20. Let op de pauzetekens; we overhoren volgende les." },
  ],
  Tajweed: [
    { titel: "Oefenblad idghaam", beschrijving: "Maak de tien voorbeelden op het blad en onderstreep waar idghaam voorkomt." },
    { titel: "Ghunnah oefenen", beschrijving: "Neem de ayaat op het blad hardop door en houd de ghunnah twee tellen aan." },
    { titel: "Regels van de noon saakinah", beschrijving: "Schrijf de vier regels op met bij elke regel één eigen voorbeeld." },
  ],
  Arabisch: [
    { titel: "Woordenlijst les 4", beschrijving: "Leer de twintig woorden van les 4. Schrijf elk woord drie keer over." },
    { titel: "Letters verbinden", beschrijving: "Maak bladzijde 12 en 13 van het schrijfschrift af." },
    { titel: "Korte zinnen lezen", beschrijving: "Lees de zinnen van les 5 vijf keer hardop voor. Streep de woorden aan die je niet kent." },
  ],
  Fiqh: [
    { titel: "De voorwaarden van het gebed", beschrijving: "Schrijf de voorwaarden op die we in de les hebben behandeld en leer ze uit je hoofd." },
    { titel: "Wudu stap voor stap", beschrijving: "Zet de stappen van de wudu in de goede volgorde op papier." },
  ],
  Sira: [
    { titel: "De hijra samenvatten", beschrijving: "Schrijf in tien zinnen wat er tijdens de hijra gebeurde en waarom." },
    { titel: "De metgezellen", beschrijving: "Kies één metgezel en schrijf op wat je over deze persoon geleerd hebt." },
  ],
  Akhlaq: [
    { titel: "Goede omgang thuis", beschrijving: "Noteer deze week drie momenten waarop je iemand thuis geholpen hebt." },
    { titel: "Eerlijkheid", beschrijving: "Schrijf op wat we in de les over eerlijkheid hebben besproken en wat jij daarvan meeneemt." },
  ],
};

const INLEVER_TEKSTEN = [
  "Gemaakt en gecontroleerd door mijn vader.",
  "Af, alleen de laatste vraag snapte ik niet helemaal.",
  "Alles geleerd, ik heb het drie keer opgezegd zonder fouten.",
  "Ik heb het huiswerk gemaakt maar ik heb nog een vraag over de laatste ayah.",
  "Klaar. Het oefenblad zit erbij.",
  "Gedaan, het kostte me deze week wat meer tijd dan normaal.",
  "Ingeleverd. Ik heb ook de herhaling van vorige week meegenomen.",
];

const DOCENT_OPMERKINGEN = [
  "Netjes gedaan, ga zo door.",
  "Goed werk. Let volgende keer op de laatste twee ayaat.",
  "Prima ingeleverd, de uitspraak mag nog iets rustiger.",
  "Bijna helemaal goed, kijk nog even naar vraag 3.",
];

const LES_BESCHRIJVINGEN: (string | null)[] = [
  "Nieuwe stof plus overhoring van vorige week.",
  "Klassikaal lezen en daarna in tweetallen oefenen.",
  "Herhalingsles, geen nieuwe stof.",
  "Uitleg aan het bord en daarna zelfstandig werken.",
  null,
  null,
];

const CIJFER_OMSCHRIJVINGEN = [
  "Mondelinge overhoring",
  "Toets hoofdstuk 2",
  "Wekelijkse recitatie",
  "Schriftelijke toets",
  "Presentatie in de klas",
  "Herhalingstoets",
];

const MATERIAAL = [
  { titel: "Uitspraakoefeningen", beschrijving: "Korte opnames per letter om thuis mee te oefenen.", linkUrl: "https://example.org/jadwal-demo/uitspraak" },
  { titel: "Werkboek Arabisch deel 1", beschrijving: "Digitale versie van het werkboek dat we in de les gebruiken.", linkUrl: "https://example.org/jadwal-demo/werkboek" },
  { titel: "Overzicht tajweed-regels", beschrijving: "Eén A4 met alle regels die dit jaar aan bod komen.", linkUrl: "https://example.org/jadwal-demo/tajweed" },
  { titel: "Weekplanning memorisatie", beschrijving: "Schema om thuis bij te houden wat er geleerd en herhaald is.", linkUrl: "https://example.org/jadwal-demo/planning" },
  { titel: "Sira tijdlijn", beschrijving: "Tijdlijn met de gebeurtenissen die we dit blok behandelen.", linkUrl: "https://example.org/jadwal-demo/sira" },
];

// ── Hulpjes ─────────────────────────────────────────────────────────────────
function epost(naam: string, rol: "leerling" | "ouder") {
  const s = naam
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, "")
    .trim()
    .split(/\s+/)
    .join(".");
  return `${s}.${rol}@${DEMO_DOMEIN}`;
}

function lesDatum(weekOffset: number, weekdag: number): Date {
  const nu = new Date();
  const anker = new Date(Date.UTC(nu.getFullYear(), nu.getMonth(), nu.getDate()));
  // Terug naar de meest recente gewenste weekdag op of vóór vandaag
  anker.setUTCDate(anker.getUTCDate() - ((anker.getUTCDay() - weekdag + 7) % 7));
  anker.setUTCDate(anker.getUTCDate() + weekOffset * 7);
  return anker;
}

function maandagVan(d: Date): Date {
  const m = new Date(d);
  m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
  m.setUTCHours(0, 0, 0, 0);
  return m;
}

function dagenGeleden(n: number, uur = 19): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(uur, tussen(0, 59), 0, 0);
  return d;
}

// ── Telling van alles buiten de doelschool, als bewijs dat we niets raken ────
async function telBuitenSchool(schoolId: string) {
  const andersOfLeeg = { OR: [{ schoolId: { not: schoolId } }, { schoolId: null }] };
  const [
    gebruikers, klassen, vakken, lessen, aanwezigheid, huiswerk,
    inleveringen, cijfers, dossiers, berichten, materialen, ouderLinks, profielen,
  ] = await Promise.all([
    prisma.user.count({ where: andersOfLeeg }),
    prisma.klas.count({ where: andersOfLeeg }),
    prisma.vak.count({ where: andersOfLeeg }),
    prisma.les.count({ where: { klas: andersOfLeeg } }),
    prisma.aanwezigheid.count({ where: { les: { klas: andersOfLeeg } } }),
    prisma.huiswerk.count({ where: { vak: andersOfLeeg } }),
    prisma.inlevering.count({ where: { leerling: andersOfLeeg } }),
    prisma.cijfer.count({ where: { leerling: andersOfLeeg } }),
    prisma.leerlingDossier.count({ where: { leerling: andersOfLeeg } }),
    prisma.bericht.count({ where: { verzender: andersOfLeeg } }),
    prisma.studieMateriaal.count({ where: { docent: andersOfLeeg } }),
    prisma.ouderLeerling.count({ where: { leerling: andersOfLeeg } }),
    prisma.hifdhProfiel.count({ where: { leerling: andersOfLeeg } }),
  ]);
  return { gebruikers, klassen, vakken, lessen, aanwezigheid, huiswerk, inleveringen, cijfers, dossiers, berichten, materialen, ouderLinks, profielen };
}

async function telBinnenSchool(schoolId: string) {
  const eigen = { schoolId };
  const [
    admins, docenten, leerlingen, ouders, klassen, vakken, lessen, aanwezigheid,
    huiswerk, inleveringen, cijfers, dossiers, berichten, materialen, ouderLinks, profielen, taken,
  ] = await Promise.all([
    prisma.user.count({ where: { ...eigen, role: "ADMIN" } }),
    prisma.user.count({ where: { ...eigen, role: "DOCENT" } }),
    prisma.user.count({ where: { ...eigen, role: "LEERLING" } }),
    prisma.user.count({ where: { ...eigen, role: "OUDER" } }),
    prisma.klas.count({ where: eigen }),
    prisma.vak.count({ where: eigen }),
    prisma.les.count({ where: { klas: eigen } }),
    prisma.aanwezigheid.count({ where: { les: { klas: eigen } } }),
    prisma.huiswerk.count({ where: { vak: eigen } }),
    prisma.inlevering.count({ where: { leerling: eigen } }),
    prisma.cijfer.count({ where: { leerling: eigen } }),
    prisma.leerlingDossier.count({ where: { leerling: eigen } }),
    prisma.bericht.count({ where: { verzender: eigen } }),
    prisma.studieMateriaal.count({ where: { docent: eigen } }),
    prisma.ouderLeerling.count({ where: { leerling: eigen } }),
    prisma.hifdhProfiel.count({ where: { leerling: eigen } }),
    prisma.hifdhTaak.count({ where: { profiel: { leerling: eigen } } }),
  ]);
  return { admins, docenten, leerlingen, ouders, klassen, vakken, lessen, aanwezigheid, huiswerk, inleveringen, cijfers, dossiers, berichten, materialen, ouderLinks, profielen, taken };
}

// ── Vorige demo-data opruimen ───────────────────────────────────────────────
async function wisDemo(schoolId: string) {
  const users = await prisma.user.findMany({
    where: { schoolId, email: { endsWith: `@${DEMO_DOMEIN}` } },
    select: { id: true },
  });
  const klassen = await prisma.klas.findMany({
    where: { schoolId, beschrijving: { contains: MARKERING } },
    select: { id: true },
  });
  const vakken = await prisma.vak.findMany({
    where: { schoolId, beschrijving: { contains: MARKERING } },
    select: { id: true },
  });
  const uids = users.map((u) => u.id);
  const kids = klassen.map((k) => k.id);
  const vids = vakken.map((v) => v.id);
  if (uids.length === 0 && kids.length === 0 && vids.length === 0) {
    console.log("Geen eerdere demo-data gevonden, niets te wissen.");
    return;
  }
  console.log(`Wissen: ${uids.length} accounts, ${kids.length} klassen, ${vids.length} vakken (en alles wat eraan hangt).`);

  const lessen = kids.length
    ? (await prisma.les.findMany({ where: { klasId: { in: kids } }, select: { id: true } })).map((l) => l.id)
    : [];
  const hw = await prisma.huiswerk.findMany({
    where: { OR: [{ vakId: { in: vids } }, { lesId: { in: lessen } }] },
    select: { id: true },
  });
  const hwids = hw.map((h) => h.id);

  await prisma.aanwezigheid.deleteMany({ where: { OR: [{ lesId: { in: lessen } }, { leerlingId: { in: uids } }] } });
  await prisma.inlevering.deleteMany({ where: { OR: [{ huiswerkId: { in: hwids } }, { leerlingId: { in: uids } }] } });
  await prisma.huiswerkLeerling.deleteMany({ where: { OR: [{ huiswerkId: { in: hwids } }, { leerlingId: { in: uids } }] } });
  await prisma.hifdhTaak.deleteMany({ where: { profiel: { leerlingId: { in: uids } } } });
  await prisma.hifdhProfiel.deleteMany({ where: { leerlingId: { in: uids } } });
  await prisma.huiswerk.deleteMany({ where: { id: { in: hwids } } });
  await prisma.les.deleteMany({ where: { id: { in: lessen } } });
  await prisma.cijfer.deleteMany({ where: { OR: [{ vakId: { in: vids } }, { leerlingId: { in: uids } }] } });
  await prisma.leerlingDossier.deleteMany({ where: { OR: [{ leerlingId: { in: uids } }, { auteurId: { in: uids } }] } });
  // Antwoorden eerst: replyToId verwijst naar een ander bericht.
  const berichtFilter = { OR: [{ verzenderId: { in: uids } }, { ontvangerId: { in: uids } }] };
  await prisma.bericht.deleteMany({ where: { AND: [berichtFilter, { replyToId: { not: null } }] } });
  await prisma.bericht.deleteMany({ where: berichtFilter });
  await prisma.ouderLeerling.deleteMany({ where: { OR: [{ ouderId: { in: uids } }, { leerlingId: { in: uids } }] } });
  await prisma.klasLeerling.deleteMany({ where: { OR: [{ klasId: { in: kids } }, { leerlingId: { in: uids } }] } });
  await prisma.klasDocent.deleteMany({ where: { OR: [{ klasId: { in: kids } }, { docentId: { in: uids } }] } });
  await prisma.klasVak.deleteMany({ where: { OR: [{ klasId: { in: kids } }, { vakId: { in: vids } }] } });
  await prisma.studieMateriaal.deleteMany({ where: { OR: [{ docentId: { in: uids } }, { klasId: { in: kids } }, { vakId: { in: vids } }] } });
  await prisma.passwordResetToken.deleteMany({ where: { gebruikerId: { in: uids } } });
  await prisma.klas.deleteMany({ where: { id: { in: kids } } });
  await prisma.vak.deleteMany({ where: { id: { in: vids } } });
  await prisma.user.deleteMany({ where: { id: { in: uids } } });
}

// ── Vullen ──────────────────────────────────────────────────────────────────
async function bouw(schoolId: string) {
  const hash = await bcrypt.hash(WACHTWOORD, 10);
  const maakUser = (naam: string, email: string, role: string, telefoon: string | null) =>
    prisma.user.create({ data: { name: naam, email, password: hash, role, telefoon, schoolId } });

  // Accounts
  const beheerder = await maakUser(BEHEERDER.naam, BEHEERDER.email, "ADMIN", BEHEERDER.telefoon);
  const docenten: { id: string; name: string }[] = [];
  for (const d of DOCENTEN) docenten.push(await maakUser(d.naam, d.email, "DOCENT", d.telefoon));

  const leerlingen: { id: string; name: string }[] = [];
  const ouders: { id: string; name: string }[] = [];
  for (const gezin of GEZINNEN) {
    const ouder = await maakUser(gezin.ouder, epost(gezin.ouder, "ouder"), "OUDER", `06-${tussen(10, 99)}${tussen(100000, 999999)}`);
    ouders.push(ouder);
    for (const kind of gezin.kinderen) {
      const l = await maakUser(kind, epost(kind, "leerling"), "LEERLING", null);
      leerlingen.push(l);
      // Max één ouder per kind — @@unique([leerlingId]) bewaakt dat ook.
      await prisma.ouderLeerling.create({ data: { ouderId: ouder.id, leerlingId: l.id } });
    }
  }

  // Vakken
  const vakken = new Map<string, { id: string; naam: string }>();
  for (const v of VAKKEN) {
    const rij = await prisma.vak.create({
      data: { naam: v.naam, beschrijving: `${v.beschrijving} ${MARKERING}`, categorie: v.categorie, schoolId },
    });
    vakken.set(v.naam, rij);
  }

  // Klassen, met leerlingen verdeeld zodat broers en zussen niet altijd samen zitten
  const verdeeld = husselen(leerlingen);
  let cursor = 0;
  const klassen: {
    id: string; naam: string; weekdag: number; lokaal: string;
    vakken: { id: string; naam: string }[]; docenten: { id: string; name: string }[];
    leerlingen: { id: string; name: string }[];
  }[] = [];

  for (const k of KLASSEN) {
    const rij = await prisma.klas.create({
      data: { naam: k.naam, beschrijving: `${k.beschrijving} ${MARKERING}`, schoolId },
    });
    const kVakken = k.vakken.map((n) => vakken.get(n)!);
    for (const v of kVakken) await prisma.klasVak.create({ data: { klasId: rij.id, vakId: v.id } });
    const kDocenten = k.docenten.map((i) => docenten[i]);
    for (const d of kDocenten) await prisma.klasDocent.create({ data: { klasId: rij.id, docentId: d.id } });
    const kLeerlingen = verdeeld.slice(cursor, cursor + k.aantal);
    cursor += k.aantal;
    for (const l of kLeerlingen) await prisma.klasLeerling.create({ data: { klasId: rij.id, leerlingId: l.id } });
    klassen.push({ id: rij.id, naam: k.naam, weekdag: k.weekdag, lokaal: k.lokaal, vakken: kVakken, docenten: kDocenten, leerlingen: kLeerlingen });
  }

  // Lessen: elke week twee lesuren, met een roterend vak
  const vandaag = new Date();
  vandaag.setHours(23, 59, 59, 999);
  type LesRij = { id: string; datum: Date; vakId: string; vakNaam: string; klasIndex: number };
  const lessen: LesRij[] = [];
  for (let ki = 0; ki < klassen.length; ki++) {
    const k = klassen[ki];
    let teller = 0;
    for (let w = -WEKEN_TERUG; w <= WEKEN_VOORUIT; w++) {
      const datum = lesDatum(w, k.weekdag);
      for (const tijd of LESTIJDEN) {
        const vak = k.vakken[teller % k.vakken.length];
        teller++;
        const les = await prisma.les.create({
          data: {
            klasId: k.id,
            vakId: vak.id,
            datum,
            begintijd: tijd.begintijd,
            eindtijd: tijd.eindtijd,
            lokaal: k.lokaal,
            beschrijving: kies(LES_BESCHRIJVINGEN),
          },
        });
        lessen.push({ id: les.id, datum, vakId: vak.id, vakNaam: vak.naam, klasIndex: ki });
      }
    }
  }

  // Aanwezigheid alleen op lessen die al geweest zijn. Elke leerling krijgt een
  // eigen betrouwbaarheid, zodat de percentages onderling verschillen.
  const trouw = new Map<string, number>();
  for (const l of leerlingen) trouw.set(l.id, 0.7 + rnd() * 0.28);
  let aanwezigheidGemaakt = 0;
  for (const les of lessen) {
    if (les.datum > vandaag) continue;
    for (const l of klassen[les.klasIndex].leerlingen) {
      const p = trouw.get(l.id)!;
      const r = rnd();
      let status: string;
      if (r < p) status = "AANWEZIG";
      else {
        const q = rnd();
        status = q < 0.45 ? "AFWEZIG" : q < 0.75 ? "TE_LAAT" : "GEOORLOOFD";
      }
      await prisma.aanwezigheid.create({ data: { lesId: les.id, leerlingId: l.id, status } });
      aanwezigheidGemaakt++;
    }
  }

  // Huiswerk bij de twee meest recente lessen per vak, plus per klas één opdracht
  // die maar aan een paar leerlingen gegeven is.
  let huiswerkGemaakt = 0;
  let inleveringGemaakt = 0;
  for (let ki = 0; ki < klassen.length; ki++) {
    const k = klassen[ki];
    for (const vak of k.vakken) {
      const gehad = lessen
        .filter((l) => l.klasIndex === ki && l.vakId === vak.id && l.datum <= vandaag)
        .sort((a, b) => b.datum.getTime() - a.datum.getTime())
        .slice(0, 2);
      const teksten = HUISWERK_TEKSTEN[vak.naam] ?? HUISWERK_TEKSTEN.Hifdh;
      for (let i = 0; i < gehad.length; i++) {
        const t = teksten[i % teksten.length];
        const les = gehad[i];
        const h = await prisma.huiswerk.create({
          data: { titel: t.titel, beschrijving: t.beschrijving, vakId: vak.id, lesId: les.id },
        });
        huiswerkGemaakt++;
        // Ouder huiswerk is vaker ingeleverd dan het huiswerk van vorige week.
        const kans = i === 0 ? 0.45 : 0.75;
        for (const l of k.leerlingen) {
          if (rnd() > kans) continue;
          const metOpmerking = rnd() < 0.4;
          const ingeleverdOp = new Date(les.datum.getTime() + tussen(1, 4) * 86400000);
          // Een deel blijft bewust op "ingeleverd, nog niet afgevinkt", zodat
          // de docent in de demo ook werk ziet dat nog beoordeeld moet worden.
          const afgevinkt = rnd() < 0.7;
          await prisma.inlevering.create({
            data: {
              huiswerkId: h.id,
              leerlingId: l.id,
              inhoud: kies(INLEVER_TEKSTEN),
              opmerking: metOpmerking && afgevinkt ? kies(DOCENT_OPMERKINGEN) : null,
              opmerkingOp: metOpmerking && afgevinkt ? dagenGeleden(tussen(1, 6)) : null,
              ingeleverdOp,
              afgevinktOp: afgevinkt
                ? new Date(ingeleverdOp.getTime() + tussen(1, 3) * 86400000)
                : null,
              createdAt: ingeleverdOp,
            },
          });
          inleveringGemaakt++;
        }
      }
    }
    // Extra oefening voor drie leerlingen — laat zien dat huiswerk gericht kan.
    const doelVak = k.vakken[0];
    const extra = await prisma.huiswerk.create({
      data: {
        titel: "Extra oefening herhaling",
        beschrijving: "Alleen voor de leerlingen die vorige week de herhaling niet afkregen. Neem de laatste twee bladzijden nog een keer door.",
        vakId: doelVak.id,
      },
    });
    huiswerkGemaakt++;
    for (const l of husselen(k.leerlingen).slice(0, 3)) {
      await prisma.huiswerkLeerling.create({ data: { huiswerkId: extra.id, leerlingId: l.id } });
    }
  }

  // Cijfers: twee per leerling per vak van de eigen klas
  let cijferGemaakt = 0;
  for (const k of klassen) {
    for (const l of k.leerlingen) {
      for (const vak of k.vakken) {
        for (let i = 0; i < 2; i++) {
          const metOpmerking = rnd() < 0.25;
          await prisma.cijfer.create({
            data: {
              waarde: Math.round((5.5 + rnd() * 4.5) * 10) / 10,
              omschrijving: kies(CIJFER_OMSCHRIJVINGEN),
              opmerking: metOpmerking ? kies(DOCENT_OPMERKINGEN) : null,
              opmerkingOp: metOpmerking ? dagenGeleden(tussen(2, 30)) : null,
              datum: dagenGeleden(tussen(3, 63), 12),
              vakId: vak.id,
              leerlingId: l.id,
            },
          });
          cijferGemaakt++;
        }
      }
    }
  }

  // Leerlingdossier: één tot drie notities per leerling, van een eigen docent
  let dossierGemaakt = 0;
  for (const k of klassen) {
    for (const l of k.leerlingen) {
      const notities = husselen(DOSSIER_TEKSTEN).slice(0, tussen(1, 3));
      for (const n of notities) {
        await prisma.leerlingDossier.create({
          data: {
            leerlingId: l.id,
            auteurId: rnd() < 0.85 ? kies(k.docenten).id : beheerder.id,
            titel: n.titel,
            inhoud: n.inhoud,
            createdAt: dagenGeleden(tussen(2, 70)),
          },
        });
        dossierGemaakt++;
      }
    }
  }

  // Berichten
  let berichtGemaakt = 0;
  const stuur = async (
    verzenderId: string,
    ontvangerId: string,
    onderwerp: string,
    inhoud: string,
    opties: { replyToId?: string; groepId?: string; doelLabel?: string; dagen?: number; gelezen?: boolean } = {}
  ) => {
    const b = await prisma.bericht.create({
      data: {
        verzenderId,
        ontvangerId,
        onderwerp,
        inhoud,
        gelezen: opties.gelezen ?? rnd() < 0.6,
        groepId: opties.groepId ?? null,
        doelLabel: opties.doelLabel ?? null,
        replyToId: opties.replyToId ?? null,
        createdAt: dagenGeleden(opties.dagen ?? tussen(1, 40)),
      },
    });
    berichtGemaakt++;
    return b;
  };

  // Schoolbrede mededeling aan alle ouders
  for (const o of ouders) {
    await stuur(
      beheerder.id,
      o.id,
      "Aangepaste lestijden in de komende vakantieweek",
      "Beste ouder,\n\nIn de vakantieweek verschuiven de lessen naar de zaterdagochtend van 10:00 tot 12:15. De lessen op zondag komen die week te vervallen. De week daarna volgen we weer het gewone rooster.\n\nMet vriendelijke groet,\nHet bestuur",
      { groepId: "demo-mededeling-ouders", doelLabel: "Alle ouders", dagen: 12 }
    );
  }
  // En aan het team
  for (const d of docenten) {
    await stuur(
      beheerder.id,
      d.id,
      "Teamoverleg dinsdagavond",
      "Assalamu alaikum,\n\nDinsdag om 20:00 hebben we het maandelijkse overleg. Op de agenda staan de rapportgesprekken en de verdeling van de nieuwe leerlingen over de klassen. Graag je aanwezigheid doorgeven.\n\nJazakoemoellahoe khayran",
      { groepId: "demo-mededeling-docenten", doelLabel: "Alle docenten", dagen: 9 }
    );
  }

  // Gesprekken tussen ouder en docent, met antwoorden heen en weer
  const gesprekken = [
    {
      onderwerp: "Vraag over het huiswerk",
      vanOuder: "Assalamu alaikum ustadh,\n\nMijn zoon vertelde dat hij tien ayaat moet leren voor volgende week, maar hij weet niet zeker welke soera. Kunt u dat bevestigen?",
      vanDocent: "Wa alaikum assalam,\n\nDat klopt: soera Al-Mulk, ayah 1 tot en met 10. Het staat ook bij het huiswerk in de app, onder de les van afgelopen zaterdag.",
      slot: "Duidelijk, dank u wel. We gaan er deze week mee aan de slag.",
    },
    {
      onderwerp: "Afwezig komende zaterdag",
      vanOuder: "Assalamu alaikum,\n\nWij zijn komende zaterdag op een familiebijeenkomst buiten de stad. Mijn dochter kan er dus niet bij zijn.",
      vanDocent: "Wa alaikum assalam, dank voor het doorgeven. Ik zet het als geoorloofd in de presentie. De stof staat in de app, dan kan ze het thuis doornemen.",
      slot: null,
    },
    {
      onderwerp: "Voortgang memorisatie",
      vanOuder: "Assalamu alaikum ustadha,\n\nHoe gaat het op dit moment met de memorisatie? Thuis oefenen we elke avond, maar ik weet niet of het genoeg is.",
      vanDocent: "Wa alaikum assalam,\n\nHet gaat goed vooruit. De nieuwe ayaat zitten er meestal binnen een week in. De herhaling van oudere soeras blijft nog wat achter, dus als jullie thuis één dag per week alleen aan herhaling besteden zou dat veel helpen.",
      slot: "Goed idee, dat gaan we op woensdag doen.",
    },
    {
      onderwerp: "Vervoer na de les",
      vanOuder: "Assalamu alaikum,\n\nIk sta soms vast in het verkeer en ben dan een kwartier later. Is dat een probleem?",
      vanDocent: "Wa alaikum assalam, dat is geen probleem. Er is altijd iemand van het team aanwezig tot half één.",
      slot: null,
    },
    {
      onderwerp: "Boek kwijt",
      vanOuder: "Assalamu alaikum ustadh, het werkboek Arabisch is bij ons thuis zoekgeraakt. Kunnen we een nieuw exemplaar krijgen?",
      vanDocent: "Wa alaikum assalam, dat kan. Ik leg er zaterdag een klaar. De digitale versie staat ook bij het studiemateriaal in de app.",
      slot: "Jazakallahu khayran.",
    },
    {
      onderwerp: "Rapportgesprek inplannen",
      vanOuder: "Assalamu alaikum,\n\nWanneer zijn de rapportgesprekken dit jaar? We willen er graag allebei bij zijn.",
      vanDocent: "Wa alaikum assalam,\n\nDe gesprekken staan gepland over drie weken, op zaterdag na de les. Ik stuur binnenkort een lijst met tijdvakken rond.",
      slot: null,
    },
    {
      onderwerp: "Ziekmelding",
      vanOuder: "Assalamu alaikum, mijn zoon is ziek en komt vandaag niet naar de les.",
      vanDocent: "Wa alaikum assalam, beterschap gewenst. Ik heb het genoteerd.",
      slot: null,
    },
    {
      onderwerp: "Extra oefening thuis",
      vanOuder: "Assalamu alaikum ustadha, heeft u tips voor extra oefening thuis met de uitspraak?",
      vanDocent: "Wa alaikum assalam,\n\nBij het studiemateriaal staan korte opnames per letter. Vijf tot tien minuten per dag meeluisteren en nazeggen werkt het beste, liever kort en dagelijks dan één keer lang.",
      slot: "Dank u, we beginnen vanavond.",
    },
  ];

  const gekoppeld = await prisma.ouderLeerling.findMany({
    where: { leerling: { schoolId } },
    select: { ouderId: true, leerlingId: true },
  });
  const klasVanLeerling = new Map<string, number>();
  klassen.forEach((k, i) => k.leerlingen.forEach((l) => klasVanLeerling.set(l.id, i)));

  const bruikbaar = gekoppeld.filter((g) => klasVanLeerling.has(g.leerlingId));
  for (let i = 0; i < gesprekken.length && i < bruikbaar.length; i++) {
    const g = gesprekken[i];
    const link = bruikbaar[i * 2 < bruikbaar.length ? i * 2 : i];
    const docent = kies(klassen[klasVanLeerling.get(link.leerlingId)!].docenten);
    const dag = tussen(6, 35);
    const eerste = await stuur(link.ouderId, docent.id, g.onderwerp, g.vanOuder, { dagen: dag, gelezen: true });
    const tweede = await stuur(docent.id, link.ouderId, `Re: ${g.onderwerp}`, g.vanDocent, {
      replyToId: eerste.id, dagen: Math.max(1, dag - 1), gelezen: true,
    });
    if (g.slot) {
      await stuur(link.ouderId, docent.id, `Re: ${g.onderwerp}`, g.slot, {
        replyToId: tweede.id, dagen: Math.max(1, dag - 2), gelezen: rnd() < 0.5,
      });
    }
  }

  // Gesprekken tussen docent en leerling
  const aanLeerling = [
    { onderwerp: "Goed gedaan vandaag", inhoud: "Je overhoring ging vandaag foutloos. Ga zo door en vergeet de herhaling van vorige week niet.", antwoord: "Jazakallahu khayran ustadh, ik ga verder met de volgende ayaat." },
    { onderwerp: "Huiswerk nog niet binnen", inhoud: "Ik zie je inlevering van deze week nog niet staan. Lukt het om die voor zaterdag in de app te zetten?", antwoord: "Sorry, ik was het vergeten. Ik lever het vanavond in." },
    { onderwerp: "Oefenblad tajweed", inhoud: "Ik heb het oefenblad bij het studiemateriaal gezet. Neem het door voor de volgende les.", antwoord: "Gevonden, dank u." },
    { onderwerp: "Herhaling deze week", inhoud: "Neem deze week soera An-Naba nog een keer helemaal door, dan overhoren we die zaterdag.", antwoord: null },
    { onderwerp: "Je presentatie", inhoud: "Je presentatie over de hijra was goed opgebouwd. Volgende keer iets rustiger praten, dan komt het nog beter over.", antwoord: "Dank u wel, ik ga erop letten." },
    { onderwerp: "Nieuwe indeling", inhoud: "Vanaf volgende week zit je in het groepje bij het raam, samen met twee klasgenoten. Dat werkt rustiger voor je.", antwoord: null },
  ];
  for (let i = 0; i < aanLeerling.length; i++) {
    const k = klassen[i % klassen.length];
    const leerling = k.leerlingen[(i * 3) % k.leerlingen.length];
    const docent = kies(k.docenten);
    const m = aanLeerling[i];
    const dag = tussen(3, 25);
    const eerste = await stuur(docent.id, leerling.id, m.onderwerp, m.inhoud, { dagen: dag, gelezen: true });
    if (m.antwoord) {
      await stuur(leerling.id, docent.id, `Re: ${m.onderwerp}`, m.antwoord, {
        replyToId: eerste.id, dagen: Math.max(1, dag - 1), gelezen: rnd() < 0.7,
      });
    }
  }

  // Hifdh-profielen voor de memorisatieklas en een deel van klas 2
  const hifdhLeerlingen = [...klassen[2].leerlingen, ...klassen[1].leerlingen.slice(0, 4)];
  let profielGemaakt = 0;
  let taakGemaakt = 0;
  for (const l of hifdhLeerlingen) {
    const start = { surah: 78, ayah: 1 };
    const huidig = { surah: 67 + tussen(0, 5), ayah: tussen(1, 20) };
    const profiel = await prisma.hifdhProfiel.create({
      data: {
        leerlingId: l.id,
        startSurahNr: start.surah,
        startAyahNr: start.ayah,
        huidigeSurahNr: huidig.surah,
        huidigeAyahNr: huidig.ayah,
        ayaatPerWeek: tussen(4, 12),
        opmerkingen: kies([
          "Werkt aan juz 29, herhaling van juz 30 loopt mee.",
          "Tempo bewust wat lager gehouden zodat de herhaling niet achterloopt.",
          "Kan meer aan dan het weekdoel; volgende blok verhogen.",
          null,
        ]),
      },
    });
    profielGemaakt++;
    for (let w = 4; w >= 0; w--) {
      const week = maandagVan(lesDatum(-w, 1));
      const van = tussen(1, 12);
      await prisma.hifdhTaak.create({
        data: {
          profielId: profiel.id,
          type: "NIEUW",
          surahNr: huidig.surah,
          vanAyah: van,
          totAyah: van + tussen(3, 8),
          weekStart: week,
          voltooid: w > 0,
          voltooidOp: w > 0 ? dagenGeleden(w * 7 - tussen(1, 4)) : null,
        },
      });
      const vanH = tussen(1, 10);
      await prisma.hifdhTaak.create({
        data: {
          profielId: profiel.id,
          type: "HERHALING",
          surahNr: 78 + tussen(0, 6),
          vanAyah: vanH,
          totAyah: vanH + tussen(5, 15),
          weekStart: week,
          voltooid: w > 1,
          voltooidOp: w > 1 ? dagenGeleden(w * 7 - tussen(1, 4)) : null,
        },
      });
      taakGemaakt += 2;
    }
  }

  // Studiemateriaal
  let materiaalGemaakt = 0;
  for (let i = 0; i < MATERIAAL.length; i++) {
    const k = klassen[i % klassen.length];
    const m = MATERIAAL[i];
    await prisma.studieMateriaal.create({
      data: {
        titel: m.titel,
        beschrijving: m.beschrijving,
        linkUrl: m.linkUrl,
        docentId: kies(k.docenten).id,
        klasId: k.id,
        vakId: kies(k.vakken).id,
        schoolId,
        createdAt: dagenGeleden(tussen(5, 50)),
      },
    });
    materiaalGemaakt++;
  }

  console.log(
    `Aangemaakt: 1 beheerder, ${docenten.length} docenten, ${leerlingen.length} leerlingen, ${ouders.length} ouders, ` +
      `${klassen.length} klassen, ${vakken.size} vakken, ${lessen.length} lessen, ${aanwezigheidGemaakt} presentieregels, ` +
      `${huiswerkGemaakt} huiswerkopdrachten, ${inleveringGemaakt} inleveringen, ${cijferGemaakt} cijfers, ` +
      `${dossierGemaakt} dossiernotities, ${berichtGemaakt} berichten, ${profielGemaakt} hifdh-profielen, ` +
      `${taakGemaakt} hifdh-taken, ${materiaalGemaakt} studiematerialen.`
  );

  // Overzicht van de inloggegevens om te kunnen showcasen
  const regels = [
    `Demo-accounts voor school "${SCHOOL_SLUG}" — wachtwoord voor iedereen: ${WACHTWOORD}`,
    "",
    `ADMIN     ${BEHEERDER.email.padEnd(46)} ${BEHEERDER.naam}`,
    ...DOCENTEN.map((d) => `DOCENT    ${d.email.padEnd(46)} ${d.naam}`),
    "",
    ...klassen.flatMap((k) => [
      `--- ${k.naam} (${k.docenten.map((d) => d.name).join(", ")})`,
      ...k.leerlingen.map((l) => `LEERLING  ${epost(l.name, "leerling").padEnd(46)} ${l.name}`),
    ]),
    "",
    ...GEZINNEN.map((g) => `OUDER     ${epost(g.ouder, "ouder").padEnd(46)} ${g.ouder} — ${g.kinderen.join(", ")}`),
  ];
  const pad = path.join(process.cwd(), "demo-accounts.txt");
  writeFileSync(pad, regels.join("\n") + "\n", "utf8");
  console.log(`Inloggegevens weggeschreven naar ${pad}`);
}

// ── Hoofdprogramma ──────────────────────────────────────────────────────────
async function main() {
  const school = await prisma.school.findUnique({ where: { slug: SCHOOL_SLUG } });
  if (!school) {
    throw new Error(`Geen school met slug "${SCHOOL_SLUG}" gevonden — er is niets aangepast.`);
  }
  if (school.slug !== SCHOOL_SLUG) {
    throw new Error("Onverwachte school gevonden, gestopt.");
  }
  console.log(`Doelschool: ${school.naam} (${school.slug}) — id ${school.id}`);

  const andereScholen = await prisma.school.findMany({
    where: { id: { not: school.id } },
    select: { naam: true, slug: true },
  });
  console.log(`Blijft ongemoeid: ${andereScholen.map((s) => `${s.naam} (${s.slug})`).join(", ") || "geen andere scholen"}`);

  const buitenVoor = await telBuitenSchool(school.id);
  const binnenVoor = await telBinnenSchool(school.id);
  console.log("Nu in de doelschool:", binnenVoor);

  const alAanwezig = await prisma.user.count({
    where: { schoolId: school.id, email: { endsWith: `@${DEMO_DOMEIN}` } },
  });

  if (DROOG) {
    const lesPerKlas = (WEKEN_TERUG + WEKEN_VOORUIT + 1) * LESTIJDEN.length;
    const leerlingTotaal = GEZINNEN.reduce((n, g) => n + g.kinderen.length, 0);
    const nu = new Date();
    let geweest = 0;
    for (const k of KLASSEN) {
      for (let w = -WEKEN_TERUG; w <= WEKEN_VOORUIT; w++) {
        if (lesDatum(w, k.weekdag) <= nu) geweest += LESTIJDEN.length;
      }
    }
    console.log("\nProefdraai — er wordt niets weggeschreven. Zou aanmaken:");
    console.log({
      beheerders: 1,
      docenten: DOCENTEN.length,
      ouders: GEZINNEN.length,
      leerlingen: leerlingTotaal,
      klassen: KLASSEN.length,
      vakken: VAKKEN.length,
      lessen: KLASSEN.length * lesPerKlas,
      lessenDieAlGeweestZijn: geweest,
      ouderKindKoppelingen: leerlingTotaal,
    });
    if (alAanwezig > 0) {
      console.log(`\nLet op: er staan al ${alAanwezig} demo-accounts. Draai met --opnieuw om die eerst te wissen.`);
    }
    return;
  }

  if (alAanwezig > 0 && !OPNIEUW) {
    throw new Error(
      `Er staan al ${alAanwezig} demo-accounts in deze school. Draai met --opnieuw om de vorige demo-data te wissen en opnieuw te vullen.`
    );
  }
  if (OPNIEUW) await wisDemo(school.id);

  await bouw(school.id);

  const buitenNa = await telBuitenSchool(school.id);
  const verschillen = Object.entries(buitenNa).filter(([k, v]) => v !== (buitenVoor as Record<string, number>)[k]);
  if (verschillen.length > 0) {
    throw new Error(
      `Data buiten "${SCHOOL_SLUG}" is veranderd — dit hoort niet te kunnen: ` +
        verschillen.map(([k, v]) => `${k} ${(buitenVoor as Record<string, number>)[k]} → ${v}`).join(", ")
    );
  }
  console.log("Gecontroleerd: alle andere scholen zijn onveranderd.");
  console.log("Nu in de doelschool:", await telBinnenSchool(school.id));
}

main()
  .catch((e) => {
    console.error("\nMislukt:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
