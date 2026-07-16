// Herstelt een Jadwal-backup (gemaakt door /api/cron/backup) in de database.
//
// Gebruik (PowerShell, in de map quran-school-lms):
//   $env:DATABASE_URL="<Neon-string>"
//   $env:BACKUP_SECRET="<zelfde secret als in Vercel>"
//   npx tsx scripts/herstel-backup.ts <pad-naar-bestand-of-blob-url>
//
// Bedoeld voor herstel in een LEGE database (na een crash). Bestaande rijen
// met hetzelfde id worden overgeslagen (skipDuplicates), dus nogmaals draaien
// is veilig maar overschrijft niets.

import { PrismaClient } from "@prisma/client";
import { gunzipSync } from "zlib";
import { readFileSync } from "fs";
import crypto from "crypto";

const prisma = new PrismaClient();

function ontsleutel(bestand: Buffer, secret: string): Buffer {
  const sleutel = crypto.createHash("sha256").update(secret).digest();
  // Bestandsindeling: [12 bytes iv][16 bytes auth-tag][ciphertext]
  const iv = bestand.subarray(0, 12);
  const tag = bestand.subarray(12, 28);
  const data = bestand.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", sleutel, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

async function laadBestand(bron: string): Promise<Buffer> {
  if (bron.startsWith("http://") || bron.startsWith("https://")) {
    const res = await fetch(bron);
    if (!res.ok) throw new Error(`Download mislukt: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return readFileSync(bron);
}

async function main() {
  const bron = process.argv[2];
  const secret = process.env.BACKUP_SECRET;
  if (!bron) {
    console.error("Gebruik: npx tsx scripts/herstel-backup.ts <bestand-of-url>");
    process.exit(1);
  }
  if (!secret) {
    console.error("Zet eerst BACKUP_SECRET (zelfde waarde als in Vercel).");
    process.exit(1);
  }

  console.log(`Backup laden: ${bron}`);
  const json = gunzipSync(ontsleutel(await laadBestand(bron), secret));
  const backup = JSON.parse(json.toString("utf8")) as {
    versie: number;
    gemaaktOp: string;
    data: Record<string, Record<string, unknown>[]>;
  };
  console.log(`Backup van ${backup.gemaaktOp} (versie ${backup.versie})`);

  const d = backup.data;

  // Berichten hebben een self-reference (replyToId): eerst zonder invoegen,
  // daarna de reply-koppelingen terugzetten.
  const berichten = (d.berichten ?? []) as ({ id: string; replyToId: string | null } & Record<string, unknown>)[];
  const berichtenZonderReply = berichten.map((b) => ({ ...b, replyToId: null }));

  // Volgorde volgt de foreign keys
  const stappen: [string, (rows: never[]) => Promise<{ count: number }>][] = [
    ["scholen", (r) => prisma.school.createMany({ data: r, skipDuplicates: true })],
    ["gebruikers", (r) => prisma.user.createMany({ data: r, skipDuplicates: true })],
    ["klassen", (r) => prisma.klas.createMany({ data: r, skipDuplicates: true })],
    ["vakken", (r) => prisma.vak.createMany({ data: r, skipDuplicates: true })],
    ["klasVakken", (r) => prisma.klasVak.createMany({ data: r, skipDuplicates: true })],
    ["klasDocenten", (r) => prisma.klasDocent.createMany({ data: r, skipDuplicates: true })],
    ["klasLeerlingen", (r) => prisma.klasLeerling.createMany({ data: r, skipDuplicates: true })],
    ["lessen", (r) => prisma.les.createMany({ data: r, skipDuplicates: true })],
    ["aanwezigheid", (r) => prisma.aanwezigheid.createMany({ data: r, skipDuplicates: true })],
    ["huiswerk", (r) => prisma.huiswerk.createMany({ data: r, skipDuplicates: true })],
    ["inleveringen", (r) => prisma.inlevering.createMany({ data: r, skipDuplicates: true })],
    ["huiswerkLeerlingen", (r) => prisma.huiswerkLeerling.createMany({ data: r, skipDuplicates: true })],
    ["cijfers", (r) => prisma.cijfer.createMany({ data: r, skipDuplicates: true })],
    ["studieMateriaal", (r) => prisma.studieMateriaal.createMany({ data: r, skipDuplicates: true })],
    ["ouderLeerlingen", (r) => prisma.ouderLeerling.createMany({ data: r, skipDuplicates: true })],
    ["leerlingDossiers", (r) => prisma.leerlingDossier.createMany({ data: r, skipDuplicates: true })],
    ["hifdhProfielen", (r) => prisma.hifdhProfiel.createMany({ data: r, skipDuplicates: true })],
    ["hifdhTaken", (r) => prisma.hifdhTaak.createMany({ data: r, skipDuplicates: true })],
  ];

  for (const [naam, fn] of stappen) {
    const rows = (naam === "berichten" ? [] : (d[naam] ?? [])) as never[];
    if (rows.length === 0) {
      console.log(`  ${naam}: (leeg)`);
      continue;
    }
    const res = await fn(rows);
    console.log(`  ${naam}: ${res.count}/${rows.length} teruggezet`);
  }

  // Berichten in twee stappen (self-reference)
  if (berichtenZonderReply.length > 0) {
    const res = await prisma.bericht.createMany({
      data: berichtenZonderReply as never[],
      skipDuplicates: true,
    });
    console.log(`  berichten: ${res.count}/${berichtenZonderReply.length} teruggezet`);
    const metReply = berichten.filter((b) => b.replyToId);
    for (const b of metReply) {
      await prisma.bericht
        .update({ where: { id: b.id }, data: { replyToId: b.replyToId } })
        .catch(() => {}); // bestond al met juiste reply, of ontbrekende parent
    }
    console.log(`  berichten: ${metReply.length} reply-koppelingen teruggezet`);
  }

  console.log("Klaar. Controleer de aantallen hierboven.");
}

main()
  .catch((e) => {
    console.error("Herstel mislukt:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
