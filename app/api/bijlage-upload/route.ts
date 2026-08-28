import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/api-auth";
import { telPogingen, registreerPoging } from "@/lib/rate-limit";

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic",
  "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/aac", "audio/x-m4a",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const MAX_BIJLAGE_BYTES = 4 * 1024 * 1024;

// Zonder limiet kan een enkel account de gratis 1 GB in een paar minuten
// volgooien. 30 uploads per kwartier is ruim voor normaal gebruik (een klas
// foto's achter elkaar) en houdt het leegtrekken van de opslag tegen.
const MAX_UPLOADS = 30;
const VENSTER_MINUTEN = 15;

/**
 * Maakt een veilige naam voor in het Blob-pad.
 *
 * `file.name` komt van de client. Ongefilterd bepaalt de gebruiker daarmee de
 * sleutel in de opslag - inclusief "../" om buiten bijlagen/ te komen, waar de
 * back-ups staan die de cron na 30 dagen opruimt.
 */
function veiligeBestandsnaam(ruw: string): string {
  const basis = ruw.split(/[\/\\]/).pop() ?? "";
  const schoon = basis
    // Alles wat geen letter, cijfer of . _ - spatie is wordt een underscore.
    // Dat vangt ook stuurtekens, zero-width en RTL-override in een keer.
    .replace(/[^\p{L}\p{N}._\- ]/gu, "_")
    .replace(/^\.+/, "")
    .trim();
  if (!schoon) return "bijlage";
  return schoon.slice(0, 100);
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 401 });
  }

  const sleutel = `bijlage-upload:${session.user.id}`;
  if ((await telPogingen(sleutel, VENSTER_MINUTEN)) >= MAX_UPLOADS) {
    return NextResponse.json(
      { error: "Te veel uploads achter elkaar. Probeer het over een kwartier opnieuw." },
      { status: 429 }
    );
  }
  await registreerPoging(sleutel);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Geen bestand ontvangen" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Bestand is leeg" }, { status: 400 });
  }
  if (file.size > MAX_BIJLAGE_BYTES) {
    return NextResponse.json({ error: "Bestand is te groot (max 4 MB)" }, { status: 413 });
  }

  const type = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "Bestandstype niet toegestaan" }, { status: 400 });
  }

  const naam = veiligeBestandsnaam(file.name || "bijlage");

  try {
    const blob = await put(`bijlagen/${naam}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: type,
    });
    return NextResponse.json({ url: blob.url, naam: file.name || naam, type });
  } catch (err) {
    console.error("[POST /api/bijlage-upload]", err);
    return NextResponse.json({ error: "Upload mislukt" }, { status: 500 });
  }
}
