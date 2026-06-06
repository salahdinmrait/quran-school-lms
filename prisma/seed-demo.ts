/**
 * Demo data seed — voegt realistisch lesrooster, huiswerk, absentie en cijfers toe
 * aan de bestaande testomgeving.
 *
 * Run: DATABASE_URL="..." npx tsx prisma/seed-demo.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── helpers ────────────────────────────────────────────────────────────────────

/** Returns the Monday of the week containing `d` */
function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

/** Returns date N weeks from the Monday of the reference date */
function weekOffset(ref: Date, offset: number): Date {
  const mon = getMonday(ref);
  mon.setDate(mon.getDate() + offset * 7);
  return mon;
}

/** Returns a Saturday of the week starting on `monday` */
function saturday(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 5);
  return d;
}

function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🎯  Seeding demo data…\n");

  const today = new Date();

  // Fetch school entities
  const klassen   = await prisma.klas.findMany({ include: { vakken: { include: { vak: true } }, leerlingen: { include: { leerling: true } } } });
  const docenten  = await prisma.user.findMany({ where: { role: "DOCENT" } });

  if (klassen.length === 0) { console.error("❌  Geen klassen gevonden — voer eerst seed.ts uit."); process.exit(1); }

  console.log(`  Gevonden: ${klassen.length} klassen, ${docenten.length} docenten`);

  // ── 1. Clear existing demo data to allow re-runs ────────────────────────────
  console.log("  Opruimen bestaande demo data…");
  await prisma.aanwezigheid.deleteMany({});
  await prisma.inlevering.deleteMany({});
  await prisma.cijfer.deleteMany({});
  await prisma.huiswerk.deleteMany({});
  await prisma.les.deleteMany({});
  console.log("  ✓ Bestaande data verwijderd");

  // ── 2. Lessen ───────────────────────────────────────────────────────────────
  // Create lessons for -3 weeks … +2 weeks (Saturdays, weekend school style)
  // Each klas: 3 slots per Saturday (Hifdh 09:00-10:00, Arabisch 10:00-11:00, Fiqh 11:00-12:00)
  const lessenData: { datum: Date; begintijd: string; eindtijd: string; lokaal: string; klasId: string; vakId: string | null }[] = [];

  const lessenSlots = [
    { begintijd: "09:00", eindtijd: "10:00", vakCat: "HIFZ" },
    { begintijd: "10:00", eindtijd: "11:00", vakCat: "ARABISCH" },
    { begintijd: "11:00", eindtijd: "12:00", vakCat: "FIQH" },
  ];

  for (let week = -3; week <= 2; week++) {
    const mon = weekOffset(today, week);
    const sat = saturday(mon);

    for (const klas of klassen) {
      for (const slot of lessenSlots) {
        const vakId = klas.vakken.find((kv) => kv.vak.categorie === slot.vakCat)?.vak.id ?? null;
        lessenData.push({
          datum: sat,
          begintijd: slot.begintijd,
          eindtijd: slot.eindtijd,
          lokaal: klas.naam === "Klas 1" ? "Lokaal A" : "Lokaal B",
          klasId: klas.id,
          vakId,
        });
      }
    }
  }

  // Batch create all lessons
  await prisma.les.createMany({ data: lessenData });
  const lessenCreated = await prisma.les.findMany({ select: { id: true, klasId: true, datum: true, vakId: true } });
  console.log(`  ✓ Lessen aangemaakt: ${lessenCreated.length}`);

  // ── 3. Huiswerk ─────────────────────────────────────────────────────────────
  const huiswerkTemplates = [
    { titel: "Memoriseer Surah Al-Ikhlas", cat: "HIFZ",     beschrijving: "Leer surah Al-Ikhlas van buiten (4 ayaat)." },
    { titel: "Memoriseer Surah Al-Falaq",  cat: "HIFZ",     beschrijving: "Leer surah Al-Falaq van buiten (5 ayaat)." },
    { titel: "Memoriseer Surah An-Nas",    cat: "HIFZ",     beschrijving: "Leer surah An-Nas van buiten (6 ayaat)." },
    { titel: "Arabische letters oefenen",  cat: "ARABISCH",  beschrijving: "Schrijf alle 28 Arabische letters 3× over." },
    { titel: "Vocabulaire les 3",          cat: "ARABISCH",  beschrijving: "Leer de 20 woorden van les 3 uit het werkboek." },
    { titel: "Arabische zinnen lezen",     cat: "ARABISCH",  beschrijving: "Lees bladzijde 12–14 hardop voor aan een ouder." },
    { titel: "Vijf pilaren uitschrijven",  cat: "FIQH",     beschrijving: "Schrijf de 5 pilaren van de islam op met uitleg." },
    { titel: "Wudhu stappen leren",        cat: "FIQH",     beschrijving: "Memoriseer de correcte volgorde van wudhu." },
    { titel: "De 99 namen (eerste 10)",    cat: "FIQH",     beschrijving: "Memoriseer de eerste 10 namen van Allah met betekenis." },
    { titel: "Tajweed: madd regels",       cat: "TAJWEED",  beschrijving: "Maak de oefeningen op bladzijde 8 van het tajweed boek." },
  ];

  // Build all huiswerk for all klassen
  const huiswerkBatch: { titel: string; beschrijving: string; deadline: Date; vakId: string }[] = [];
  // We'll need to track (klasId, huiswerkIdx) for inleveringen later
  // So create per-klas first and collect ids
  const huiswerkItems: { id: string; vakId: string; klasId: string }[] = [];

  for (const klas of klassen) {
    for (let wi = 0; wi < huiswerkTemplates.length; wi++) {
      const tmpl = huiswerkTemplates[wi];
      const vakId = klas.vakken.find((kv) => kv.vak.categorie === tmpl.cat)?.vak.id;
      if (!vakId) continue;

      const deadlineDate = weekOffset(today, Math.floor(wi / 3) - 2);
      deadlineDate.setDate(deadlineDate.getDate() + 6);

      const hw = await prisma.huiswerk.create({
        data: { titel: tmpl.titel, beschrijving: tmpl.beschrijving, deadline: deadlineDate, vakId },
      });
      huiswerkItems.push({ id: hw.id, vakId, klasId: klas.id });
    }
  }
  console.log(`  ✓ Huiswerk aangemaakt: ${huiswerkItems.length}`);

  // ── 4. Absentie (batch, voor lessen in het verleden) ────────────────────────
  const verledenLessen = lessenCreated.filter((l) => l.datum < today);
  const statusOptions: ("AANWEZIG" | "TE_LAAT" | "AFWEZIG" | "GEOORLOOFD")[] =
    ["AANWEZIG", "AANWEZIG", "AANWEZIG", "AANWEZIG", "TE_LAAT", "AFWEZIG", "GEOORLOOFD"];

  const aanwezigheidData: { lesId: string; leerlingId: string; status: string }[] = [];
  for (const les of verledenLessen) {
    const klas = klassen.find((k) => k.id === les.klasId)!;
    for (const { leerling } of klas.leerlingen) {
      aanwezigheidData.push({ lesId: les.id, leerlingId: leerling.id, status: rnd(statusOptions) });
    }
  }
  await prisma.aanwezigheid.createMany({ data: aanwezigheidData, skipDuplicates: true });
  console.log(`  ✓ Aanwezigheidsrecords: ${aanwezigheidData.length}`);

  // ── 5. Huiswerk afvinken (~70% per student, batch) ──────────────────────────
  const inleveringData: { huiswerkId: string; leerlingId: string; inhoud: string }[] = [];
  for (const hw of huiswerkItems) {
    const klas = klassen.find((k) => k.id === hw.klasId)!;
    const shuffled = [...klas.leerlingen].sort(() => Math.random() - 0.3);
    const countToDo = Math.floor(shuffled.length * 0.7);
    for (let i = 0; i < countToDo; i++) {
      inleveringData.push({ huiswerkId: hw.id, leerlingId: shuffled[i].leerling.id, inhoud: "✓" });
    }
  }
  await prisma.inlevering.createMany({ data: inleveringData, skipDuplicates: true });
  console.log(`  ✓ Huiswerk afgevinkt: ${inleveringData.length} inleveringen`);

  // ── 6. Cijfers (batch) ───────────────────────────────────────────────────────
  const vakOmschrijvingen: Record<string, string[]> = {
    HIFZ:     ["Mondeling overhoring surah Al-Ikhlas", "Mondeling overhoring surah Al-Falaq"],
    ARABISCH: ["Dictee hoofdstuk 1", "Leesvaardigheid les 3"],
    FIQH:     ["Toets: de 5 pilaren", "Overhoring gebedstijden"],
    TAJWEED:  ["Tajweed beoordeling", "Recitatie toets"],
    SIRA:     ["Toets: leven van de profeet ﷺ", "Werkstuk: de hijra"],
  };

  const cijferData: { waarde: number; omschrijving: string; datum: Date; vakId: string; leerlingId: string }[] = [];
  for (const klas of klassen) {
    for (const { leerling } of klas.leerlingen) {
      for (const { vak } of klas.vakken) {
        const omschrijvingen = vakOmschrijvingen[vak.categorie] ?? ["Toets"];
        for (const omschrijving of omschrijvingen) {
          const waarde = Math.min(10, Math.max(5, 7 + (Math.random() - 0.5) * 4));
          cijferData.push({
            waarde: Math.round(waarde * 10) / 10,
            omschrijving,
            datum: weekOffset(today, -2),
            vakId: vak.id,
            leerlingId: leerling.id,
          });
        }
      }
    }
  }
  await prisma.cijfer.createMany({ data: cijferData });
  console.log(`  ✓ Cijfers aangemaakt: ${cijferData.length}`);

  // ── 7. Hifdh profielen voor eerste 5 leerlingen per klas ────────────────────
  const { createTakenForProfiel } = await import("../lib/hifdh-utils");

  let hifdhProfielen = 0;
  for (const klas of klassen) {
    const firstFive = klas.leerlingen.slice(0, 5);
    for (let idx = 0; idx < firstFive.length; idx++) {
      const leerling = firstFive[idx].leerling;
      const startSurah = 114 - idx;
      const existing = await prisma.hifdhProfiel.findUnique({ where: { leerlingId: leerling.id } });
      if (existing) continue;

      const profiel = await prisma.hifdhProfiel.create({
        data: {
          leerlingId: leerling.id,
          startSurahNr: startSurah,
          startAyahNr: 1,
          huidigeSurahNr: startSurah,
          huidigeAyahNr: 1,
          ayaatPerWeek: 5,
        },
      });

      await createTakenForProfiel(profiel.id);
      hifdhProfielen++;
    }
  }
  console.log(`  ✓ Hifdh-profielen aangemaakt: ${hifdhProfielen} (elk met 6 weken taken)`);

  console.log("\n✅  Demo data klaar!\n");
  console.log("  Lessen:      " + lessenCreated.length);
  console.log("  Huiswerk:    " + huiswerkItems.length);
  console.log("  Afgevinkt:   " + inleveringData.length + " inleveringen");
  console.log("  Absentie:    " + aanwezigheidData.length + " records");
  console.log("  Cijfers:     " + cijferData.length);
  console.log("  Hifdh:       " + hifdhProfielen + " profielen\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
