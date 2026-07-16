import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { put, list, del } from "@vercel/blob";
import { gzipSync } from "zlib";
import crypto from "crypto";

// Dagelijkse volledige backup van alle data naar Vercel Blob (zie vercel.json crons).
// Blob-URLs zijn publiek-maar-onraadbaar; daarom wordt de backup versleuteld
// met AES-256-GCM (sleutel afgeleid van BACKUP_SECRET) vóór het uploaden.
export const maxDuration = 300;

const BEWAAR_DAGEN = 30;

function versleutel(data: Buffer, secret: string): Buffer {
  const sleutel = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", sleutel, iv);
  const versleuteld = Buffer.concat([cipher.update(data), cipher.final()]);
  // Bestandsindeling: [12 bytes iv][16 bytes auth-tag][ciphertext]
  return Buffer.concat([iv, cipher.getAuthTag(), versleuteld]);
}

export async function GET(req: NextRequest) {
  // Vercel Cron stuurt Authorization: Bearer <CRON_SECRET>
  const authz = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authz !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 401 });
  }
  if (!process.env.BACKUP_SECRET) {
    return NextResponse.json({ error: "BACKUP_SECRET is niet geconfigureerd" }, { status: 500 });
  }

  try {
    // ── 1. Alle tabellen exporteren ─────────────────────────────────────────
    const [
      scholen, gebruikers, klassen, vakken,
      klasVakken, klasDocenten, klasLeerlingen,
      lessen, aanwezigheid, huiswerk, inleveringen, huiswerkLeerlingen,
      cijfers, berichten, studieMateriaal, ouderLeerlingen,
      leerlingDossiers, hifdhProfielen, hifdhTaken,
    ] = await Promise.all([
      prisma.school.findMany(),
      prisma.user.findMany(),
      prisma.klas.findMany(),
      prisma.vak.findMany(),
      prisma.klasVak.findMany(),
      prisma.klasDocent.findMany(),
      prisma.klasLeerling.findMany(),
      prisma.les.findMany(),
      prisma.aanwezigheid.findMany(),
      prisma.huiswerk.findMany(),
      prisma.inlevering.findMany(),
      prisma.huiswerkLeerling.findMany(),
      prisma.cijfer.findMany(),
      prisma.bericht.findMany(),
      prisma.studieMateriaal.findMany(),
      prisma.ouderLeerling.findMany(),
      prisma.leerlingDossier.findMany(),
      prisma.hifdhProfiel.findMany(),
      prisma.hifdhTaak.findMany(),
    ]);

    const backup = {
      versie: 1,
      gemaaktOp: new Date().toISOString(),
      // Volgorde = herstel-volgorde (foreign keys)
      data: {
        scholen, gebruikers, klassen, vakken,
        klasVakken, klasDocenten, klasLeerlingen,
        lessen, aanwezigheid, huiswerk, inleveringen, huiswerkLeerlingen,
        cijfers, berichten, studieMateriaal, ouderLeerlingen,
        leerlingDossiers, hifdhProfielen, hifdhTaken,
      },
    };

    // ── 2. Comprimeren + versleutelen + uploaden ────────────────────────────
    const json = Buffer.from(JSON.stringify(backup), "utf8");
    const bestand = versleutel(gzipSync(json), process.env.BACKUP_SECRET);

    const datum = new Date().toISOString().slice(0, 10);
    const blob = await put(`backups/jadwal-backup-${datum}.json.gz.enc`, bestand, {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/octet-stream",
    });

    // ── 3. Oude backups opruimen (> 30 dagen) ───────────────────────────────
    const grens = Date.now() - BEWAAR_DAGEN * 24 * 60 * 60 * 1000;
    const { blobs } = await list({ prefix: "backups/" });
    const verlopen = blobs.filter((b) => new Date(b.uploadedAt).getTime() < grens);
    if (verlopen.length > 0) {
      await del(verlopen.map((b) => b.url));
    }

    // ── 4. Transiente tabellen opschonen ────────────────────────────────────
    const [oudePogingen, oudeTokens] = await Promise.all([
      // Rate-limit-pogingen ouder dan 1 dag
      prisma.loginPoging.deleteMany({
        where: { tijdstip: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      // Verlopen of gebruikte reset-tokens ouder dan 30 dagen
      prisma.passwordResetToken.deleteMany({
        where: { verlooptOp: { lt: new Date(grens) } },
      }),
    ]);

    console.log(
      `[backup] ${blob.pathname} (${(bestand.length / 1024).toFixed(0)} kB), ` +
        `${verlopen.length} oude backups verwijderd, ` +
        `${oudePogingen.count} loginpogingen + ${oudeTokens.count} tokens opgeschoond`
    );

    return NextResponse.json({
      success: true,
      bestand: blob.pathname,
      grootteKb: Math.round(bestand.length / 1024),
      oudeBackupsVerwijderd: verlopen.length,
    });
  } catch (err) {
    console.error("[GET /api/cron/backup]", err);
    return NextResponse.json({ error: "Backup mislukt" }, { status: 500 });
  }
}
