import { NextRequest, NextResponse } from "next/server";
import { list, put, del } from "@vercel/blob";
import { sendMail, opslagWaarschuwingEmail } from "@/lib/email";

// Dagelijkse controle van het Vercel Blob-gebruik (zie vercel.json crons).
// Er is geen betaald plan, dus de gratis 1 GB is een harde grens waar Vercel
// vanzelf voor gaat rekenen zodra die vol raakt — geen crash, wel kosten. Dit
// stuurt één mail zodra 80% bereikt is, en pas weer een nieuwe zodra het
// gebruik eerst onder de drempel is gezakt (bijv. na opschonen).
export const maxDuration = 60;

const GRATIS_LIMIET_BYTES = 1024 * 1024 * 1024; // Vercel Blob Hobby: 1 GB gratis
const DREMPEL_BYTES = 0.8 * GRATIS_LIMIET_BYTES;
const MARKER_PATH = "alerts/opslag-80-gewaarschuwd.txt";

export async function GET(req: NextRequest) {
  // Vercel Cron stuurt Authorization: Bearer <CRON_SECRET>
  const authz = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authz !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 401 });
  }

  try {
    // ── 1. Totaal Blob-gebruik optellen (gepagineerd, list() geeft max 1000/keer) ──
    let totaal = 0;
    let cursor: string | undefined;
    do {
      const pagina = await list({ cursor, limit: 1000 });
      totaal += pagina.blobs.reduce((som, b) => som + b.size, 0);
      cursor = pagina.hasMore ? pagina.cursor : undefined;
    } while (cursor);

    // ── 2. Kijken of er al gewaarschuwd is sinds de laatste keer onder de drempel ──
    const markerLijst = await list({ prefix: MARKER_PATH, limit: 1 });
    const marker = markerLijst.blobs.find((b) => b.pathname === MARKER_PATH);
    const bovenDrempel = totaal >= DREMPEL_BYTES;

    let gemaild = false;
    if (bovenDrempel && !marker) {
      const beheerderEmail = process.env.BEHEERDER_EMAIL;
      if (beheerderEmail) {
        const gebruiktMb = Math.round(totaal / (1024 * 1024));
        const limietMb = Math.round(GRATIS_LIMIET_BYTES / (1024 * 1024));
        await sendMail({
          to: beheerderEmail,
          subject: "Jadwal: bijlage-opslag nadert de gratis grens",
          html: opslagWaarschuwingEmail(gebruiktMb, limietMb),
        });
        gemaild = true;
      } else {
        console.warn("[blob-opslag] Drempel bereikt maar BEHEERDER_EMAIL is niet ingesteld");
      }
      // Marker altijd zetten (ook zonder BEHEERDER_EMAIL) om niet elke dag te loggen.
      await put(MARKER_PATH, "gewaarschuwd", { access: "public", addRandomSuffix: false });
    } else if (!bovenDrempel && marker) {
      // Terug onder de drempel: volgende overschrijding mag weer waarschuwen.
      await del(marker.url);
    }

    return NextResponse.json({
      totaalMb: Math.round(totaal / (1024 * 1024)),
      bovenDrempel,
      gemaild,
    });
  } catch (err) {
    console.error("[GET /api/cron/blob-opslag]", err);
    return NextResponse.json({ error: "Controle mislukt" }, { status: 500 });
  }
}
