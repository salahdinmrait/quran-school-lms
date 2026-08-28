import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/api-auth";

// Toegestane bestandstypes voor bijlages bij huiswerk, berichten, cijfers, lessen
// en studiemateriaal — zelfde lijst als /api/upload (de grote-bestanden-route voor
// docenten op het web), maar hier voor alle rollen en met een kleine limiet.
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic",
  "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/aac", "audio/x-m4a",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

// 4 MB — zelfde grens als MAX_BIJLAGE_BYTES in de app (lib/bijlage.ts). Boven de
// 4,5 MB-lichaamslimiet van Vercel kwam je vroeger niet uit omdat het bestand als
// base64 (×1,33) werd verstuurd; hier gaat het ongecodeerd als multipart mee, dus
// 4 MB past ruim.
const MAX_BIJLAGE_BYTES = 4 * 1024 * 1024;

// POST /api/bijlage-upload
// Directe server-side upload naar Vercel Blob voor de mobiele app: leerling,
// ouder, docent en admin mogen allemaal een bijlage toevoegen aan huiswerk,
// berichten, cijfers, lessen of studiemateriaal (in tegenstelling tot /api/upload,
// dat alleen voor docenten via het web is). Simpeler dan de client-upload-token-
// flow van /api/upload omdat bijlages hier altijd klein genoeg zijn om in één
// verzoek mee te sturen.
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 401 });
  }

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

  if (file.size > MAX_BIJLAGE_BYTES) {
    return NextResponse.json({ error: "Bestand is te groot (max 4 MB)" }, { status: 413 });
  }

  const type = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "Bestandstype niet toegestaan" }, { status: 400 });
  }

  try {
    const blob = await put(`bijlagen/${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: type,
    });
    return NextResponse.json({ url: blob.url, naam: file.name, type });
  } catch (err) {
    console.error("[POST /api/bijlage-upload]", err);
    return NextResponse.json({ error: "Upload mislukt" }, { status: 500 });
  }
}
