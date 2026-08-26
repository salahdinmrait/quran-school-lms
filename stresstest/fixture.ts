/**
 * Bouwt een schone, bekende testomgeving op: twee scholen met alle rollen,
 * klassen, vakken, lessen, huiswerk, cijfers, aanwezigheid en berichten.
 *
 * Idempotent: alles van vorige runs wordt eerst weggegooid, zodat de
 * stresstest-loop steeds vanaf dezelfde stand begint.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export const WACHTWOORD = "Stress@Test2026";
export const DOMEIN = "stresstest.local";

const prisma = new PrismaClient();

export interface Persoon {
  id: string;
  naam: string;
  email: string;
  rol: string;
  schoolId: string;
}

export interface Fixture {
  schoolA: { id: string; slug: string };
  schoolB: { id: string; slug: string };
  adminA: Persoon;
  adminB: Persoon;
  docentA1: Persoon;
  docentA2: Persoon;
  docentB1: Persoon;
  leerlingA1: Persoon; // klas A1, heeft ouder
  leerlingA2: Persoon; // klas A1, geen ouder
  leerlingA3: Persoon; // klas A1, heeft ouder
  leerlingA4: Persoon; // klas A2 (andere docent)
  leerlingB1: Persoon; // andere school
  ouderA1: Persoon; // ouder van leerlingA1
  ouderA3: Persoon; // ouder van leerlingA3
  klasA1: string;
  klasA2: string;
  klasB1: string;
  vakA1: string;
  vakA2: string;
  vakB1: string;
  lesA1Verleden: string;
  lesA1Toekomst: string;
  lesA2: string;
  lesB1: string;
  huiswerkKlas: string; // hele klas A1
  huiswerkGericht: string; // alleen leerlingA1
  huiswerkA2: string; // van docentA2
  cijferA1: string;
  berichtAanA1: string;
}

/** Weigert te draaien tegen iets anders dan een lokaal bestand. */
export function controleerVeiligeDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) {
    console.error("\n🛑  GESTOPT: DATABASE_URL wijst niet naar een lokaal SQLite-bestand.");
    console.error(`    Gevonden: ${url.slice(0, 30)}…`);
    console.error("    De stresstest maakt en verwijdert data; hij draait NOOIT tegen productie.\n");
    process.exit(1);
  }
}

async function opruimen() {
  // Alles van eerdere runs weg. Volgorde = omgekeerde foreign-key-volgorde.
  const scholen = await prisma.school.findMany({
    where: { slug: { in: ["stresstest-a", "stresstest-b"] } },
    select: { id: true },
  });
  const schoolIds = scholen.map((s) => s.id);

  const users = await prisma.user.findMany({
    where: { OR: [{ email: { contains: DOMEIN } }, { schoolId: { in: schoolIds } }] },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  if (userIds.length > 0) {
    await prisma.aanwezigheid.deleteMany({ where: { leerlingId: { in: userIds } } });
    await prisma.inlevering.deleteMany({ where: { leerlingId: { in: userIds } } });
    await prisma.huiswerkLeerling.deleteMany({ where: { leerlingId: { in: userIds } } });
    await prisma.cijfer.deleteMany({ where: { leerlingId: { in: userIds } } });
    await prisma.leerlingDossier.deleteMany({
      where: { OR: [{ leerlingId: { in: userIds } }, { auteurId: { in: userIds } }] },
    });
    await prisma.hifdhTaak.deleteMany({ where: { profiel: { leerlingId: { in: userIds } } } });
    await prisma.hifdhProfiel.deleteMany({ where: { leerlingId: { in: userIds } } });
    // Berichten: eerst de replies (self-relatie)
    await prisma.bericht.deleteMany({
      where: {
        replyToId: { not: null },
        OR: [{ verzenderId: { in: userIds } }, { ontvangerId: { in: userIds } }],
      },
    });
    await prisma.bericht.deleteMany({
      where: { OR: [{ verzenderId: { in: userIds } }, { ontvangerId: { in: userIds } }] },
    });
    await prisma.studieMateriaal.deleteMany({ where: { docentId: { in: userIds } } });
    await prisma.ouderLeerling.deleteMany({
      where: { OR: [{ ouderId: { in: userIds } }, { leerlingId: { in: userIds } }] },
    });
    await prisma.passwordResetToken.deleteMany({ where: { gebruikerId: { in: userIds } } });
    await prisma.klasDocent.deleteMany({ where: { docentId: { in: userIds } } });
    await prisma.klasLeerling.deleteMany({ where: { leerlingId: { in: userIds } } });
  }

  if (schoolIds.length > 0) {
    const klassen = await prisma.klas.findMany({ where: { schoolId: { in: schoolIds } }, select: { id: true } });
    const klasIds = klassen.map((k) => k.id);
    const vakken = await prisma.vak.findMany({ where: { schoolId: { in: schoolIds } }, select: { id: true } });
    const vakIds = vakken.map((v) => v.id);

    await prisma.aanwezigheid.deleteMany({ where: { les: { klasId: { in: klasIds } } } });
    await prisma.inlevering.deleteMany({ where: { huiswerk: { vakId: { in: vakIds } } } });
    await prisma.huiswerkLeerling.deleteMany({ where: { huiswerk: { vakId: { in: vakIds } } } });
    await prisma.hifdhTaak.deleteMany({ where: { huiswerk: { vakId: { in: vakIds } } } });
    await prisma.huiswerk.deleteMany({ where: { vakId: { in: vakIds } } });
    await prisma.cijfer.deleteMany({ where: { vakId: { in: vakIds } } });
    await prisma.les.deleteMany({ where: { klasId: { in: klasIds } } });
    await prisma.studieMateriaal.deleteMany({
      where: { OR: [{ klasId: { in: klasIds } }, { vakId: { in: vakIds } }, { schoolId: { in: schoolIds } }] },
    });
    await prisma.klasVak.deleteMany({ where: { klasId: { in: klasIds } } });
    await prisma.klasDocent.deleteMany({ where: { klasId: { in: klasIds } } });
    await prisma.klasLeerling.deleteMany({ where: { klasId: { in: klasIds } } });
    await prisma.klas.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await prisma.vak.deleteMany({ where: { schoolId: { in: schoolIds } } });
  }

  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.school.deleteMany({ where: { id: { in: schoolIds } } });

  // Rate-limit-tellers van vorige runs wissen, anders begint de volgende run
  // meteen op 429.
  await prisma.loginPoging.deleteMany({});
}

export async function bouwFixture(): Promise<Fixture> {
  controleerVeiligeDatabase();
  await opruimen();

  const hash = await bcrypt.hash(WACHTWOORD, 10);
  const nu = new Date();
  const gisteren = new Date(nu.getTime() - 86400000);
  const volgendeWeek = new Date(nu.getTime() + 7 * 86400000);

  const schoolA = await prisma.school.create({
    data: { naam: "Stresstest School A", slug: "stresstest-a", plaats: "Amsterdam" },
  });
  const schoolB = await prisma.school.create({
    data: { naam: "Stresstest School B", slug: "stresstest-b", plaats: "Rotterdam" },
  });

  async function maakUser(naam: string, lokaal: string, rol: string, schoolId: string): Promise<Persoon> {
    const email = `${lokaal}@${DOMEIN}`;
    const u = await prisma.user.create({
      data: { name: naam, email, password: hash, role: rol, schoolId },
    });
    return { id: u.id, naam, email, rol, schoolId };
  }

  const adminA = await maakUser("Admin Alpha", "admin.a", "ADMIN", schoolA.id);
  const adminB = await maakUser("Admin Beta", "admin.b", "ADMIN", schoolB.id);
  const docentA1 = await maakUser("Ustadh Ahmed", "docent.a1", "DOCENT", schoolA.id);
  const docentA2 = await maakUser("Ustadha Nour", "docent.a2", "DOCENT", schoolA.id);
  const docentB1 = await maakUser("Ustadh Bilal", "docent.b1", "DOCENT", schoolB.id);
  const leerlingA1 = await maakUser("Omar Test", "leerling.a1", "LEERLING", schoolA.id);
  const leerlingA2 = await maakUser("Fatima Test", "leerling.a2", "LEERLING", schoolA.id);
  const leerlingA3 = await maakUser("Yusuf Test", "leerling.a3", "LEERLING", schoolA.id);
  const leerlingA4 = await maakUser("Layla Test", "leerling.a4", "LEERLING", schoolA.id);
  const leerlingB1 = await maakUser("Bilal Bravo", "leerling.b1", "LEERLING", schoolB.id);
  const ouderA1 = await maakUser("Ouder van Omar", "ouder.a1", "OUDER", schoolA.id);
  const ouderA3 = await maakUser("Ouder van Yusuf", "ouder.a3", "OUDER", schoolA.id);

  await prisma.ouderLeerling.create({ data: { ouderId: ouderA1.id, leerlingId: leerlingA1.id } });
  await prisma.ouderLeerling.create({ data: { ouderId: ouderA3.id, leerlingId: leerlingA3.id } });

  const vakA1 = await prisma.vak.create({ data: { naam: "Hifdh A", categorie: "HIFZ", schoolId: schoolA.id } });
  const vakA2 = await prisma.vak.create({ data: { naam: "Fiqh A", categorie: "FIQH", schoolId: schoolA.id } });
  const vakB1 = await prisma.vak.create({ data: { naam: "Hifdh B", categorie: "HIFZ", schoolId: schoolB.id } });

  const klasA1 = await prisma.klas.create({ data: { naam: "Klas A1", schoolId: schoolA.id } });
  const klasA2 = await prisma.klas.create({ data: { naam: "Klas A2", schoolId: schoolA.id } });
  const klasB1 = await prisma.klas.create({ data: { naam: "Klas B1", schoolId: schoolB.id } });

  await prisma.klasDocent.createMany({
    data: [
      { klasId: klasA1.id, docentId: docentA1.id },
      { klasId: klasA2.id, docentId: docentA2.id },
      { klasId: klasB1.id, docentId: docentB1.id },
    ],
  });
  await prisma.klasVak.createMany({
    data: [
      { klasId: klasA1.id, vakId: vakA1.id },
      { klasId: klasA2.id, vakId: vakA2.id },
      { klasId: klasB1.id, vakId: vakB1.id },
    ],
  });
  await prisma.klasLeerling.createMany({
    data: [
      { klasId: klasA1.id, leerlingId: leerlingA1.id },
      { klasId: klasA1.id, leerlingId: leerlingA2.id },
      { klasId: klasA1.id, leerlingId: leerlingA3.id },
      { klasId: klasA2.id, leerlingId: leerlingA4.id },
      { klasId: klasB1.id, leerlingId: leerlingB1.id },
    ],
  });

  const lesA1Verleden = await prisma.les.create({
    data: { datum: gisteren, begintijd: "09:00", eindtijd: "10:00", lokaal: "1", klasId: klasA1.id, vakId: vakA1.id },
  });
  const lesA1Toekomst = await prisma.les.create({
    data: { datum: volgendeWeek, begintijd: "09:00", eindtijd: "10:00", lokaal: "1", klasId: klasA1.id, vakId: vakA1.id },
  });
  const lesA2 = await prisma.les.create({
    data: { datum: volgendeWeek, begintijd: "11:00", eindtijd: "12:00", lokaal: "2", klasId: klasA2.id, vakId: vakA2.id },
  });
  const lesB1 = await prisma.les.create({
    data: { datum: volgendeWeek, begintijd: "09:00", eindtijd: "10:00", lokaal: "1", klasId: klasB1.id, vakId: vakB1.id },
  });

  const huiswerkKlas = await prisma.huiswerk.create({
    data: { titel: "Huiswerk hele klas", beschrijving: "Voor iedereen", vakId: vakA1.id, lesId: lesA1Toekomst.id },
  });
  const huiswerkGericht = await prisma.huiswerk.create({
    data: { titel: "Alleen voor Omar", beschrijving: "Individueel", vakId: vakA1.id, lesId: lesA1Toekomst.id },
  });
  await prisma.huiswerkLeerling.create({
    data: { huiswerkId: huiswerkGericht.id, leerlingId: leerlingA1.id },
  });
  const huiswerkA2 = await prisma.huiswerk.create({
    data: { titel: "Huiswerk klas A2", vakId: vakA2.id, lesId: lesA2.id },
  });

  const cijferA1 = await prisma.cijfer.create({
    data: { waarde: 8.5, omschrijving: "Toets 1", vakId: vakA1.id, leerlingId: leerlingA1.id },
  });

  await prisma.aanwezigheid.create({
    data: { status: "AANWEZIG", lesId: lesA1Verleden.id, leerlingId: leerlingA1.id },
  });

  const berichtAanA1 = await prisma.bericht.create({
    data: {
      onderwerp: "Welkom",
      inhoud: "Assalamu alaykum",
      verzenderId: docentA1.id,
      ontvangerId: leerlingA1.id,
    },
  });

  return {
    schoolA: { id: schoolA.id, slug: schoolA.slug },
    schoolB: { id: schoolB.id, slug: schoolB.slug },
    adminA, adminB, docentA1, docentA2, docentB1,
    leerlingA1, leerlingA2, leerlingA3, leerlingA4, leerlingB1,
    ouderA1, ouderA3,
    klasA1: klasA1.id, klasA2: klasA2.id, klasB1: klasB1.id,
    vakA1: vakA1.id, vakA2: vakA2.id, vakB1: vakB1.id,
    lesA1Verleden: lesA1Verleden.id,
    lesA1Toekomst: lesA1Toekomst.id,
    lesA2: lesA2.id,
    lesB1: lesB1.id,
    huiswerkKlas: huiswerkKlas.id,
    huiswerkGericht: huiswerkGericht.id,
    huiswerkA2: huiswerkA2.id,
    cijferA1: cijferA1.id,
    berichtAanA1: berichtAanA1.id,
  };
}

export { prisma };
