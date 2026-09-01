import "dotenv/config";
import { appendFileSync, existsSync, readFileSync } from "fs";
import { prisma } from "../lib/prisma";
import { b2Ingesteld, maakSleutel, uploadNaarB2 } from "../lib/b2";

/**
 * Bestaande bijlagen van Vercel Blob naar Backblaze B2 halen.
 *
 * Draaien (met de productie-database):
 *
 *   $env:DATABASE_URL="<Neon-string>"; npx tsx scripts/migreer-naar-b2.ts --droog
 *   $env:DATABASE_URL="<Neon-string>"; npx tsx scripts/migreer-naar-b2.ts
 *
 * Per rij: het bestand van de Blob-URL ophalen, naar B2 zetten, en pas daarna
 * `bijlageUrl` bijwerken. Gaat er iets mis, dan blijft de rij naar Blob wijzen
 * en werkt de bijlage gewoon — de oude weg blijft immers ondersteund tot fase 7.
 * Opnieuw draaien pakt alleen de rijen op die nog niet over zijn.
 *
 * De oude Blob-bestanden worden hier **niet** weggegooid. Ze komen in
 * `migratie-blob-urls.txt` te staan; verwijderen is een aparte stap, pas als in
 * de app gecontroleerd is dat de bijlagen het doen:
 *
 *   $env:BLOB_READ_WRITE_TOKEN="<token>"; npx tsx scripts/migreer-naar-b2.ts --blob-opruimen
 */

const BLOB_HOST = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i;
const LOGBESTAND = "migratie-blob-urls.txt";

type Rij = {
  id: string;
  bijlageNaam: string | null;
  bijlageUrl: string | null;
  bijlageType: string | null;
};

const SELECT = { id: true, bijlageNaam: true, bijlageUrl: true, bijlageType: true } as const;
const WHERE = { bijlageUrl: { contains: ".public.blob.vercel-storage.com" } };

// Elke tabel met een bijlage. Losse update-functies in plaats van
// prisma[naam] — zo controleert TypeScript de veldnamen mee.
const TABELLEN: Array<{
  naam: string;
  zoek: () => Promise<Rij[]>;
  bijwerken: (id: string, url: string) => Promise<unknown>;
}> = [
  {
    naam: "huiswerk",
    zoek: () => prisma.huiswerk.findMany({ where: WHERE, select: SELECT }),
    bijwerken: (id, bijlageUrl) => prisma.huiswerk.update({ where: { id }, data: { bijlageUrl } }),
  },
  {
    naam: "inlevering",
    zoek: () => prisma.inlevering.findMany({ where: WHERE, select: SELECT }),
    bijwerken: (id, bijlageUrl) => prisma.inlevering.update({ where: { id }, data: { bijlageUrl } }),
  },
  {
    naam: "les",
    zoek: () => prisma.les.findMany({ where: WHERE, select: SELECT }),
    bijwerken: (id, bijlageUrl) => prisma.les.update({ where: { id }, data: { bijlageUrl } }),
  },
  {
    naam: "cijfer",
    zoek: () => prisma.cijfer.findMany({ where: WHERE, select: SELECT }),
    bijwerken: (id, bijlageUrl) => prisma.cijfer.update({ where: { id }, data: { bijlageUrl } }),
  },
  {
    naam: "bericht",
    zoek: () => prisma.bericht.findMany({ where: WHERE, select: SELECT }),
    bijwerken: (id, bijlageUrl) => prisma.bericht.update({ where: { id }, data: { bijlageUrl } }),
  },
  {
    naam: "studiemateriaal",
    zoek: () => prisma.studieMateriaal.findMany({ where: WHERE, select: SELECT }),
    bijwerken: (id, bijlageUrl) =>
      prisma.studieMateriaal.update({ where: { id }, data: { bijlageUrl } }),
  },
];

function blobUrl(waarde: string | null): URL | null {
  if (!waarde) return null;
  try {
    const u = new URL(waarde);
    return u.protocol === "https:" && BLOB_HOST.test(u.hostname) ? u : null;
  } catch {
    return null;
  }
}

async function overzetten(droog: boolean) {
  if (!b2Ingesteld()) {
    console.error("B2 is niet ingesteld — zet B2_BUCKET/B2_ENDPOINT/B2_KEY_ID/B2_APP_KEY in .env");
    process.exit(1);
  }

  let gedaan = 0;
  let overgeslagen = 0;
  let mislukt = 0;
  let bytes = 0;

  for (const tabel of TABELLEN) {
    const rijen = await tabel.zoek();
    if (rijen.length === 0) continue;
    console.log(`\n── ${tabel.naam} — ${rijen.length} bijlage(n) ──`);

    for (const rij of rijen) {
      // De where-clausule matcht op tekst; hier pas echt keuren.
      const oud = blobUrl(rij.bijlageUrl);
      if (!oud) {
        console.log(`  ⊘ ${rij.id}: geen geldige Blob-URL, overgeslagen`);
        overgeslagen++;
        continue;
      }

      const naam = rij.bijlageNaam ?? decodeURIComponent(oud.pathname.split("/").pop() ?? "bijlage");
      try {
        const res = await fetch(oud);
        if (!res.ok) {
          // 404 = het bestand is ooit uit Blob verdwenen; de rij wijst dan naar
          // niets en daar valt niets aan over te zetten.
          console.log(`  ✗ ${rij.id}: ophalen mislukt (${res.status}) — ${naam}`);
          mislukt++;
          continue;
        }
        const inhoud = Buffer.from(await res.arrayBuffer());
        const type = rij.bijlageType ?? res.headers.get("content-type") ?? "application/octet-stream";
        const sleutel = maakSleutel(naam);

        if (droog) {
          console.log(`  · ${rij.id}: zou ${(inhoud.length / 1024).toFixed(0)} kB → ${sleutel}`);
        } else {
          const nieuw = await uploadNaarB2(sleutel, inhoud, type);
          await tabel.bijwerken(rij.id, nieuw);
          // Pas loggen als de database om is: alleen dan mag het oude bestand weg.
          appendFileSync(LOGBESTAND, `${tabel.naam}\t${rij.id}\t${oud.toString()}\n`, "utf8");
          console.log(`  ✓ ${rij.id}: ${(inhoud.length / 1024).toFixed(0)} kB → ${sleutel}`);
        }
        bytes += inhoud.length;
        gedaan++;
      } catch (err) {
        console.log(`  ✗ ${rij.id}: ${(err as Error).message}`);
        mislukt++;
      }
    }
  }

  console.log(
    `\n${droog ? "DROOG — " : ""}${gedaan} overgezet (${(bytes / 1024 / 1024).toFixed(1)} MB), ` +
      `${overgeslagen} overgeslagen, ${mislukt} mislukt.`
  );
  if (!droog && gedaan > 0) {
    console.log(
      `Oude Blob-URL's staan in ${LOGBESTAND}. Controleer eerst in de app of de\n` +
        `bijlagen het doen; pas daarna: npx tsx scripts/migreer-naar-b2.ts --blob-opruimen`
    );
  }
  if (mislukt > 0) process.exitCode = 1;
}

async function blobOpruimen(droog: boolean) {
  if (!existsSync(LOGBESTAND)) {
    console.error(`${LOGBESTAND} bestaat niet — er is nog niets overgezet.`);
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN ontbreekt — buiten Vercel is die nodig om bij Blob te komen.");
    process.exit(1);
  }
  const { del } = await import("@vercel/blob");

  const urls = readFileSync(LOGBESTAND, "utf8")
    .split("\n")
    .map((r) => r.split("\t")[2])
    .filter((u): u is string => Boolean(u) && Boolean(blobUrl(u)));

  console.log(`${urls.length} Blob-bestand(en) om te verwijderen.`);
  if (droog) {
    urls.forEach((u) => console.log(`  · ${u}`));
    return;
  }
  // del() neemt maximaal 1000 URL's per keer.
  for (let i = 0; i < urls.length; i += 500) {
    await del(urls.slice(i, i + 500));
    console.log(`  ✓ ${Math.min(i + 500, urls.length)}/${urls.length}`);
  }
  console.log(`Klaar. ${LOGBESTAND} mag nu weg.`);
}

async function main() {
  const args = process.argv.slice(2);
  const droog = args.includes("--droog");
  if (args.includes("--blob-opruimen")) await blobOpruimen(droog);
  else await overzetten(droog);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
