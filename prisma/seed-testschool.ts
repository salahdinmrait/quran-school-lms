/**
 * Testschool demo-seed — vult de bestaande testschool met realistische demo-data:
 * lesrooster, huiswerk (met inleveringen), berichten heen-en-weer, cijfers,
 * aanwezigheid en studiemateriaal. Maakt ook 2 18+ leerling-accounts.
 *
 * Draai tegen Neon (productie):
 *   DATABASE_URL="postgresql://...neon..." npx tsx prisma/seed-testschool.ts
 *
 * Kies eventueel een specifieke school met SEED_SCHOOL_SLUG=mijn-school.
 * Veilig om vaker te draaien: bestaande demo-content van DEZE school wordt eerst
 * opgeruimd; accounts worden ge-upsert (geen dubbele).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}
function weekOffset(ref: Date, offset: number): Date {
  const mon = getMonday(ref);
  mon.setDate(mon.getDate() + offset * 7);
  return mon;
}
function saturday(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 5);
  return d;
}
function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const PW = "Jadwal@2026"; // bekend wachtwoord voor alle demo-accounts

async function main() {
  const today = new Date();
  const hash = await bcrypt.hash(PW, 10);

  // ── 1. Vind de testschool ──────────────────────────────────────────────────
  const slug = process.env.SEED_SCHOOL_SLUG;
  const school = slug
    ? await prisma.school.findUnique({ where: { slug } })
    : (await prisma.school.findMany({ orderBy: { createdAt: "asc" }, take: 1 }))[0];

  if (!school) {
    console.error("❌  Geen school gevonden. Maak eerst een school aan via /dev, of zet SEED_SCHOOL_SLUG.");
    process.exit(1);
  }
  console.log(`🏫  School: ${school.naam} (${school.slug})\n`);
  const schoolId = school.id;

  // ── 2. Bestaande demo-content van DEZE school opruimen ─────────────────────
  console.log("🧹  Opruimen oude demo-content van deze school…");
  await prisma.aanwezigheid.deleteMany({ where: { les: { klas: { schoolId } } } });
  await prisma.inlevering.deleteMany({ where: { huiswerk: { vak: { schoolId } } } });
  await prisma.huiswerkLeerling.deleteMany({ where: { huiswerk: { vak: { schoolId } } } });
  await prisma.cijfer.deleteMany({ where: { vak: { schoolId } } });
  await prisma.huiswerk.deleteMany({ where: { vak: { schoolId } } });
  await prisma.les.deleteMany({ where: { klas: { schoolId } } });
  await prisma.studieMateriaal.deleteMany({ where: { schoolId } });
  await prisma.bericht.deleteMany({ where: { OR: [{ verzender: { schoolId } }, { ontvanger: { schoolId } }] } });

  // ── 3. Structuur garanderen (vakken, docenten, klassen, leerlingen, ouders) ─
  async function ensureVak(naam: string, categorie: string) {
    const bestaand = await prisma.vak.findFirst({ where: { naam, schoolId } });
    if (bestaand) return bestaand;
    return prisma.vak.create({ data: { naam, categorie, schoolId } });
  }
  const vakken = [
    await ensureVak("Tajweed", "TAJWEED"),
    await ensureVak("Arabisch", "ARABISCH"),
    await ensureVak("Fiqh", "FIQH"),
    await ensureVak("Memorisatie", "HIFZ"),
  ];

  async function ensureUser(name: string, email: string, role: string, isVolwassen = false) {
    return prisma.user.upsert({
      where: { email },
      create: { name, email, password: hash, role, schoolId, isVolwassen },
      update: { name, role, schoolId, isVolwassen },
    });
  }
  const emailBase = (s: string) => `${s}@${school.slug}.test`;

  const docent1 = await ensureUser("Ustadh Yusuf", emailBase("yusuf.docent"), "DOCENT");
  const docent2 = await ensureUser("Ustadha Maryam", emailBase("maryam.docent"), "DOCENT");
  const docenten = [docent1, docent2];

  // Leerlingen + ouders
  const leerlingNamen = [
    "Omar Al-Rashidi", "Bilal Yilmaz", "Fatima Bensaid", "Khadija El Amrani",
    "Ibrahim Demir", "Soumaya Haddad", "Yassin Boukhari", "Layla Cherif",
    "Mohammed Ait", "Noor Saleh",
  ];
  const leerlingen = [];
  const ouders = [];
  for (let i = 0; i < leerlingNamen.length; i++) {
    const naam = leerlingNamen[i];
    const slugn = naam.toLowerCase().replace(/[^a-z]+/g, ".");
    const l = await ensureUser(naam, emailBase(slugn), "LEERLING");
    leerlingen.push(l);
    // Voor ~70% een ouder
    if (i % 3 !== 0) {
      const ouder = await ensureUser(`Ouder van ${naam.split(" ")[0]}`, emailBase(`ouder.${slugn}`), "OUDER");
      ouders.push(ouder);
      await prisma.ouderLeerling.upsert({
        where: { ouderId_leerlingId: { ouderId: ouder.id, leerlingId: l.id } },
        create: { ouderId: ouder.id, leerlingId: l.id },
        update: {},
      });
    }
  }

  // ── 4. Twee 18+ leerlingen (zelfstandig, zonder ouder) ─────────────────────
  const volwassen1 = await ensureUser("Amir (18+)", emailBase("amir.18plus"), "LEERLING", true);
  const volwassen2 = await ensureUser("Salma (18+)", emailBase("salma.18plus"), "LEERLING", true);
  leerlingen.push(volwassen1, volwassen2);
  console.log(`👤  18+ accounts: ${volwassen1.email} / ${volwassen2.email}  (wachtwoord: ${PW})`);

  // ── 5. Klassen met koppelingen ─────────────────────────────────────────────
  async function ensureKlas(naam: string) {
    const bestaand = await prisma.klas.findFirst({ where: { naam, schoolId } });
    if (bestaand) return bestaand;
    return prisma.klas.create({ data: { naam, schoolId } });
  }
  const klasA = await ensureKlas("Klas 1A — Zaterdag");
  const klasB = await ensureKlas("Klas 2B — Zondag");
  const klassen = [klasA, klasB];

  async function koppel(klasId: string, docentId: string, vakIds: string[], leerlingIds: string[]) {
    await prisma.klasDocent.upsert({ where: { klasId_docentId: { klasId, docentId } }, create: { klasId, docentId }, update: {} });
    for (const vakId of vakIds) {
      await prisma.klasVak.upsert({ where: { klasId_vakId: { klasId, vakId } }, create: { klasId, vakId }, update: {} });
    }
    for (const leerlingId of leerlingIds) {
      await prisma.klasLeerling.upsert({ where: { klasId_leerlingId: { klasId, leerlingId } }, create: { klasId, leerlingId }, update: {} });
    }
  }
  const helft = Math.ceil(leerlingen.length / 2);
  await koppel(klasA.id, docent1.id, [vakken[0].id, vakken[1].id, vakken[3].id], leerlingen.slice(0, helft).map((l) => l.id));
  await koppel(klasB.id, docent2.id, [vakken[1].id, vakken[2].id, vakken[3].id], leerlingen.slice(helft).map((l) => l.id));

  // Herlaad klassen met hun koppelingen
  const klasData = await prisma.klas.findMany({
    where: { schoolId },
    include: {
      vakken: { include: { vak: true } },
      leerlingen: { include: { leerling: true } },
      docenten: { include: { docent: true } },
    },
  });

  // ── 6. Lessen (verleden + toekomst), Saterdag/Zondag ───────────────────────
  console.log("📅  Lessen aanmaken…");
  const lesBeschrijvingen = [
    "Neem soera Al-Mulk door voor deze les.",
    "Herhaal de tajweed-regels van vorige week.",
    "Lees hoofdstuk 3 van het werkboek. Video: https://youtu.be/dQw4w9WgXcQ",
    "Bereid de woordjes voor (bladzijde 12).",
    null,
  ];
  const lesIds: { id: string; klasId: string; vakId: string; datum: Date }[] = [];
  for (let w = -3; w <= 2; w++) {
    const mon = weekOffset(today, w);
    for (const klas of klasData) {
      const dag = klas.naam.includes("Zondag") ? new Date(saturday(mon).getTime() + 86400000) : saturday(mon);
      const slots = [
        { begin: "09:00", eind: "10:00" },
        { begin: "10:15", eind: "11:15" },
        { begin: "11:30", eind: "12:30" },
      ];
      for (let s = 0; s < klas.vakken.length && s < slots.length; s++) {
        const vak = klas.vakken[s].vak;
        const les = await prisma.les.create({
          data: {
            datum: dag,
            begintijd: slots[s].begin,
            eindtijd: slots[s].eind,
            lokaal: `Lokaal ${s + 1}`,
            beschrijving: rnd(lesBeschrijvingen),
            klasId: klas.id,
            vakId: vak.id,
          },
        });
        lesIds.push({ id: les.id, klasId: klas.id, vakId: vak.id, datum: dag });
      }
    }
  }
  console.log(`   ✓ ${lesIds.length} lessen`);

  // ── 7. Huiswerk + inleveringen ─────────────────────────────────────────────
  console.log("📚  Huiswerk + inleveringen aanmaken…");
  const hwTitels: Record<string, string[]> = {
    TAJWEED: ["Oefen de madd-regels", "Reciteer soera An-Nas met tajweed"],
    ARABISCH: ["Leer de woordjes les 4", "Maak de oefeningen blz. 20"],
    FIQH: ["Lees over de wudu-stappen", "Beantwoord de vragen over salah"],
    HIFZ: ["Memoriseer soera Al-Ikhlas", "Herhaal soera Al-Falaq"],
  };
  let hwCount = 0, invCount = 0;
  for (const klas of klasData) {
    for (const kv of klas.vakken) {
      const vak = kv.vak;
      const titels = hwTitels[vak.categorie] ?? ["Maak de opdracht"];
      for (let t = 0; t < titels.length; t++) {
        const deadline = weekOffset(today, t === 0 ? 0 : 1);
        const lesVanVak = lesIds.find((l) => l.klasId === klas.id && l.vakId === vak.id);
        const hw = await prisma.huiswerk.create({
          data: {
            titel: titels[t],
            beschrijving:
              t === 0
                ? "Lever je opname of antwoord in via de app."
                : "Bekijk de uitleg: https://example.com/uitleg en oefen thuis.",
            deadline,
            vakId: vak.id,
            lesId: lesVanVak?.id ?? null,
          },
        });
        hwCount++;
        // ~65% van de leerlingen levert in
        for (const kl of klas.leerlingen) {
          if (Math.random() < 0.65) {
            const eigen = Math.random() < 0.5;
            await prisma.inlevering.create({
              data: {
                huiswerkId: hw.id,
                leerlingId: kl.leerling.id,
                inhoud: eigen ? "Klaar ustadh, ik heb het geoefend en opgenomen." : "✓",
                ...(eigen && Math.random() < 0.5
                  ? { opmerking: "Goed gedaan! Let nog op je uitspraak.", opmerkingOp: new Date() }
                  : {}),
              },
            });
            invCount++;
          }
        }
      }
    }
  }
  console.log(`   ✓ ${hwCount} huiswerk, ${invCount} inleveringen`);

  // ── 8. Berichten heen-en-weer ──────────────────────────────────────────────
  console.log("✉️   Berichten aanmaken…");
  let berCount = 0;
  for (const klas of klasData) {
    const docent = klas.docenten[0]?.docent;
    if (!docent) continue;
    for (const kl of klas.leerlingen.slice(0, 4)) {
      const leerling = kl.leerling;
      // Docent → leerling
      const origineel = await prisma.bericht.create({
        data: {
          onderwerp: "Goed bezig!",
          inhoud: `Assalamu alaykum ${leerling.name.split(" ")[0]}, je was goed voorbereid afgelopen les. Ga zo door!`,
          verzenderId: docent.id,
          ontvangerId: leerling.id,
          gelezen: Math.random() < 0.5,
        },
      });
      berCount++;
      // Leerling → docent (reactie, threaded)
      if (Math.random() < 0.7) {
        await prisma.bericht.create({
          data: {
            onderwerp: "Re: Goed bezig!",
            inhoud: "Wa alaykum salaam ustadh, dank u wel! Ik blijf oefenen.",
            verzenderId: leerling.id,
            ontvangerId: docent.id,
            replyToId: origineel.id,
          },
        });
        berCount++;
      }
    }
    // Docent → een ouder
    const eersteOuderKoppeling = await prisma.ouderLeerling.findFirst({
      where: { leerling: { leerlingKlassen: { some: { klasId: klas.id } } } },
      include: { ouder: true },
    });
    if (eersteOuderKoppeling) {
      await prisma.bericht.create({
        data: {
          onderwerp: "Aankondiging: ouderavond",
          inhoud: "Beste ouder, volgende maand is er een ouderavond. Meer info volgt via de app.",
          verzenderId: docent.id,
          ontvangerId: eersteOuderKoppeling.ouder.id,
        },
      });
      berCount++;
    }
  }
  // 18+ leerling → docent (initiatief)
  await prisma.bericht.create({
    data: {
      onderwerp: "Vraag over het huiswerk",
      inhoud: "Assalamu alaykum ustadh, mag ik mijn opname later vandaag insturen?",
      verzenderId: volwassen1.id,
      ontvangerId: docent1.id,
    },
  });
  berCount++;
  console.log(`   ✓ ${berCount} berichten`);

  // ── 9. Cijfers ─────────────────────────────────────────────────────────────
  console.log("🔢  Cijfers aanmaken…");
  let cijferCount = 0;
  for (const klas of klasData) {
    for (const kv of klas.vakken) {
      for (const kl of klas.leerlingen) {
        if (Math.random() < 0.8) {
          const waarde = Math.round((5 + Math.random() * 4.5) * 10) / 10;
          await prisma.cijfer.create({
            data: {
              waarde,
              omschrijving: `Toets ${kv.vak.naam}`,
              opmerking: Math.random() < 0.3 ? "Mooie vooruitgang deze periode." : null,
              datum: weekOffset(today, -1),
              vakId: kv.vak.id,
              leerlingId: kl.leerling.id,
            },
          });
          cijferCount++;
        }
      }
    }
  }
  console.log(`   ✓ ${cijferCount} cijfers`);

  // ── 10. Aanwezigheid (verleden lessen) ─────────────────────────────────────
  console.log("✅  Aanwezigheid aanmaken…");
  const statussen = ["AANWEZIG", "AANWEZIG", "AANWEZIG", "AANWEZIG", "TE_LAAT", "AFWEZIG", "GEOORLOOFD"];
  let aanwCount = 0;
  for (const les of lesIds.filter((l) => l.datum < today)) {
    const klas = klasData.find((k) => k.id === les.klasId);
    if (!klas) continue;
    for (const kl of klas.leerlingen) {
      await prisma.aanwezigheid.create({
        data: { status: rnd(statussen), lesId: les.id, leerlingId: kl.leerling.id },
      });
      aanwCount++;
    }
  }
  console.log(`   ✓ ${aanwCount} aanwezigheidsrecords`);

  // ── 11. Studiemateriaal ────────────────────────────────────────────────────
  console.log("📂  Studiemateriaal aanmaken…");
  const materialen = [
    { titel: "Tajweed-regels overzicht", beschrijving: "Handige samenvatting van de regels.", linkUrl: "https://example.com/tajweed.pdf", vakId: vakken[0].id, klasId: klasA.id, docentId: docent1.id },
    { titel: "Arabisch alfabet poster", beschrijving: "Print en hang thuis op.", linkUrl: "https://example.com/alfabet.png", vakId: vakken[1].id, klasId: klasA.id, docentId: docent1.id },
    { titel: "Recitatie soera Al-Mulk (audio)", beschrijving: "Luister en reciteer mee. https://example.com/almulk.mp3", vakId: vakken[3].id, klasId: klasB.id, docentId: docent2.id },
  ];
  for (const m of materialen) {
    await prisma.studieMateriaal.create({ data: { ...m, schoolId } });
  }
  console.log(`   ✓ ${materialen.length} studiematerialen`);

  console.log("\n🎉  Klaar! De testschool is gevuld met demo-data.");
  console.log(`    Alle demo-accounts hebben wachtwoord: ${PW}`);
  console.log(`    Docent: ${docent1.email}`);
  console.log(`    Leerling: ${leerlingen[0].email}`);
  console.log(`    18+ leerling: ${volwassen1.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
