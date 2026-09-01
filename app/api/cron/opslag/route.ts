import { NextRequest, NextResponse } from "next/server";
import { b2Ingesteld, bijlagenOpslag } from "@/lib/b2";
import {
  backupIngesteld,
  backupLijst,
  backupOpslag,
  backupSchrijf,
  backupVerwijder,
} from "@/lib/b2-backup";
import { sendMail, opslagWaarschuwingEmail } from "@/lib/email";

// Dagelijkse controle van het opslaggebruik bij Backblaze B2 (zie vercel.json
// crons). B2 is pay-as-you-go: er is geen grens waar iets op stukloopt, alleen
// een rekening die oploopt (~$6 per TB per maand). Dit stuurt één mail zodra de
// drempel gepasseerd is, en pas weer een nieuwe zodra het gebruik eerst onder
// de drempel is gezakt.
export const maxDuration = 60;

const STANDAARD_DREMPEL_GB = 400;
const MARKER = "alerts/opslag-gewaarschuwd";
const GB = 1024 * 1024 * 1024;

export async function GET(req: NextRequest) {
  // Vercel Cron stuurt Authorization: Bearer <CRON_SECRET>
  const authz = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authz !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 401 });
  }
  if (!b2Ingesteld() || !backupIngesteld()) {
    console.error("[opslag] B2 is niet volledig ingesteld");
    return NextResponse.json({ error: "Opslag is niet geconfigureerd" }, { status: 500 });
  }

  const drempelGb = Number(process.env.B2_WAARSCHUW_GB) || STANDAARD_DREMPEL_GB;

  try {
    // ── 1. Beide buckets optellen ───────────────────────────────────────────
    const [bijlagen, backups] = await Promise.all([bijlagenOpslag(), backupOpslag()]);
    const bijlagenGb = bijlagen.bytes / GB;
    const backupsGb = backups.bytes / GB;
    const totaalGb = bijlagenGb + backupsGb;
    const bovenDrempel = totaalGb >= drempelGb;

    // ── 2. Al gewaarschuwd sinds de laatste keer onder de drempel? ──────────
    // De marker staat in de back-upbucket; die is privé en verder ongebruikt.
    const markers = await backupLijst(MARKER);
    const gewaarschuwd = markers.some((m) => m.sleutel === MARKER);

    let gemaild = false;
    if (bovenDrempel && !gewaarschuwd) {
      const beheerderEmail = process.env.BEHEERDER_EMAIL;
      if (beheerderEmail) {
        await sendMail({
          to: beheerderEmail,
          subject: "Jadwal: opslag boven de waarschuwingsgrens",
          html: opslagWaarschuwingEmail({ bijlagenGb, backupsGb, drempelGb }),
        });
        gemaild = true;
      } else {
        console.warn("[opslag] Drempel bereikt maar BEHEERDER_EMAIL is niet ingesteld");
      }
      // Marker altijd zetten (ook zonder BEHEERDER_EMAIL) om niet elke dag te loggen.
      await backupSchrijf(MARKER, Buffer.from(new Date().toISOString()));
    } else if (!bovenDrempel && gewaarschuwd) {
      // Terug onder de drempel: een volgende overschrijding mag weer waarschuwen.
      await backupVerwijder([MARKER]);
    }

    return NextResponse.json({
      bijlagenGb: Number(bijlagenGb.toFixed(2)),
      backupsGb: Number(backupsGb.toFixed(2)),
      objecten: bijlagen.objecten + backups.objecten,
      drempelGb,
      bovenDrempel,
      gemaild,
    });
  } catch (err) {
    console.error("[GET /api/cron/opslag]", err);
    return NextResponse.json({ error: "Controle mislukt" }, { status: 500 });
  }
}
