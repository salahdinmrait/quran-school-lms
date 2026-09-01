import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth";
import { b2Ingesteld, b2ObjectUrl, maakSleutel, maakUploadUrl, uploadNaarB2 } from "@/lib/b2";
import { leesJson } from "@/lib/json-body";
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

// De grens voor de nieuwe route: de client uploadt rechtstreeks naar B2, dus
// Vercels lichaamslimiet van ~4,5 MB speelt hier geen rol meer.
const MAX_BIJLAGE_BYTES = 10 * 1024 * 1024;

// De oude weg (het bestand loopt wél door deze functie heen) blijft bestaan
// voor app-versies die nog niet zijn bijgewerkt — de webapp en deze API
// worden los uitgerold. Daar geldt de oude 4 MB, want groter komt sowieso
// niet door Vercel heen.
const MAX_RELAY_BYTES = 4 * 1024 * 1024;

// Zonder limiet kan een enkel account de opslag in een paar minuten volgooien.
// 30 uploads per kwartier is ruim voor normaal gebruik (een klas foto's achter
// elkaar) en houdt het leegtrekken van de opslag tegen.
const MAX_UPLOADS = 30;
const VENSTER_MINUTEN = 15;

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

  if (!b2Ingesteld()) {
    console.error("[POST /api/bijlage-upload] B2 niet ingesteld");
    return NextResponse.json({ error: "Bijlage-opslag is niet ingesteld" }, { status: 500 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? uitgifteUploadUrl(request)
    : doorgeefUpload(request);
}

/**
 * Nieuwe weg: de client vraagt een kortlevende upload-URL aan en zet het
 * bestand daarna zélf bij B2 neer. `url` is wat hij daarna als `bijlageUrl`
 * meestuurt; die wordt bij het opslaan opnieuw gekeurd door
 * `veiligeBijlageUrl()` in lib/bijlage.ts.
 */
async function uitgifteUploadUrl(request: Request): Promise<Response> {
  const gelezen = await leesJson(request);
  if (!gelezen.ok) return gelezen.response;
  const { naam, type, grootte } = gelezen.data;

  if (typeof naam !== "string" || naam.length === 0 || naam.length > 255) {
    return NextResponse.json({ error: "Ongeldige bestandsnaam" }, { status: 400 });
  }
  if (typeof type !== "string" || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "Bestandstype niet toegestaan" }, { status: 400 });
  }
  if (typeof grootte !== "number" || !Number.isInteger(grootte) || grootte <= 0) {
    return NextResponse.json({ error: "Ongeldige bestandsgrootte" }, { status: 400 });
  }
  if (grootte > MAX_BIJLAGE_BYTES) {
    return NextResponse.json({ error: "Bestand is te groot (max 10 MB)" }, { status: 413 });
  }

  const objectSleutel = maakSleutel(naam);
  try {
    const uploadUrl = await maakUploadUrl({ sleutel: objectSleutel, contentType: type, bytes: grootte });
    return NextResponse.json({
      uploadUrl,
      // Precies deze headers moeten mee; ze zijn meeondertekend, dus een
      // afwijkende waarde laat B2 de upload weigeren.
      headers: { "Content-Type": type, "Content-Length": String(grootte) },
      url: b2ObjectUrl(objectSleutel),
      naam,
      type,
    });
  } catch (err) {
    console.error("[POST /api/bijlage-upload] presign", err);
    return NextResponse.json({ error: "Upload mislukt" }, { status: 500 });
  }
}

/** Oude weg: multipart-formulier, de server zet het bestand voor de client neer. */
async function doorgeefUpload(request: Request): Promise<Response> {
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
  if (file.size > MAX_RELAY_BYTES) {
    return NextResponse.json({ error: "Bestand is te groot (max 4 MB)" }, { status: 413 });
  }

  const type = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "Bestandstype niet toegestaan" }, { status: 400 });
  }

  try {
    const objectSleutel = maakSleutel(file.name || "bijlage");
    const url = await uploadNaarB2(objectSleutel, Buffer.from(await file.arrayBuffer()), type);
    return NextResponse.json({ url, naam: file.name || "bijlage", type });
  } catch (err) {
    console.error("[POST /api/bijlage-upload] relay", err);
    return NextResponse.json({ error: "Upload mislukt" }, { status: 500 });
  }
}
