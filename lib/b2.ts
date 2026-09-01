import { randomBytes } from "crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Backblaze B2 — de opslag voor bijlagen.
 *
 * Vervangt Vercel Blob, dat op 1 GB een harde grens heeft. B2 praat de
 * S3-API, dus we gebruiken de gewone AWS-SDK; er is geen Backblaze-eigen
 * client nodig.
 *
 * De bucket is **privé**. Er bestaat dus geen URL die zomaar werkt: uploaden
 * gaat met een kortlevende presigned PUT en downloaden met een kortlevende
 * presigned GET, allebei uitgedeeld door onze eigen API nadat die de
 * autorisatie heeft gecontroleerd (`loadBijlage()` in lib/bijlage.ts).
 *
 * Let op: B2 ondersteunt **geen** presigned POST (browser-formulier-upload) —
 * dat staat expliciet in hun lijst met niet-ondersteunde S3-functies. Vandaar
 * de PUT-variant hieronder.
 */

const BUCKET = process.env.B2_BUCKET ?? "";
const KEY_ID = process.env.B2_KEY_ID ?? "";
const APP_KEY = process.env.B2_APP_KEY ?? "";
// Zowel "s3.eu-central-003.backblazeb2.com" als een variant mét https:// of
// afsluitende slash wordt geaccepteerd; verderop bouwen we er zelf URL's mee.
const ENDPOINT = (process.env.B2_ENDPOINT ?? "")
  .trim()
  .replace(/^https?:\/\//i, "")
  .replace(/\/+$/, "")
  .toLowerCase();

/** Alle bijlagen staan plat onder deze map. Zie `SLEUTEL_PATROON`. */
export const BIJLAGE_PREFIX = "bijlagen/";

/**
 * Een sleutel die we zelf gemaakt hebben: `bijlagen/<hex>-<schone naam>`.
 *
 * Bewust plat en puur ASCII. Daardoor kan een URL die op onze bucket wijst
 * nooit ergens anders heen wijzen (geen `..`, geen `%2F`, geen submappen), en
 * is er geen verschil tussen de sleutel en zijn URL-codering — wat bij het
 * ondertekenen anders subtiel mis kan gaan.
 */
const SLEUTEL_PATROON = /^bijlagen\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function b2Ingesteld(): boolean {
  return Boolean(BUCKET && ENDPOINT && KEY_ID && APP_KEY);
}

/** De host waarop onze bucket bereikbaar is (virtual-hosted style). */
export function b2Host(): string {
  return `${BUCKET}.${ENDPOINT}`;
}

/** De endpoint zonder schema, bijv. `s3.eu-central-003.backblazeb2.com`. */
export function b2Endpoint(): string {
  return ENDPOINT;
}

// s3.eu-central-003.backblazeb2.com → eu-central-003. De regio zit bij B2 in
// de endpoint-naam; SigV4 wil hem los, en een verkeerde waarde geeft 403.
export function b2Regio(): string {
  const m = /^s3\.([a-z0-9-]+)\./.exec(ENDPOINT);
  return m ? m[1] : "us-east-1";
}

/** Een S3-client voor B2. De back-upbucket heeft eigen sleutels, zie lib/b2-backup.ts. */
export function maakB2Client(opts: { keyId: string; appKey: string }): S3Client {
  return new S3Client({
    region: b2Regio(),
    endpoint: `https://${ENDPOINT}`,
    credentials: { accessKeyId: opts.keyId, secretAccessKey: opts.appKey },
    // De SDK zet er anders standaard een CRC32 bij. Bij een presigned URL
    // wordt die berekend over een leeg lichaam — de client stuurt de echte
    // bytes pas later — en dat zou een controle bij B2 laten mislukken.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

let client: S3Client | null = null;

function b2(): S3Client {
  if (!b2Ingesteld()) {
    throw new Error("B2 is niet ingesteld (B2_BUCKET/B2_ENDPOINT/B2_KEY_ID/B2_APP_KEY)");
  }
  if (!client) client = maakB2Client({ keyId: KEY_ID, appKey: APP_KEY });
  return client;
}

/**
 * Alle objecten in een bucket optellen. B2 heeft geen kant-en-klare
 * bucketgrootte, dus dit loopt de lijst door — 1000 per keer.
 */
export async function telBucket(
  client: S3Client,
  bucket: string
): Promise<{ bytes: number; objecten: number }> {
  let bytes = 0;
  let objecten = 0;
  let token: string | undefined;
  do {
    const pagina = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token })
    );
    for (const obj of pagina.Contents ?? []) {
      bytes += obj.Size ?? 0;
      objecten++;
    }
    token = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
  } while (token);
  return { bytes, objecten };
}

/** Hoeveel er in de bijlagenbucket staat. Gebruikt door de opslagcron. */
export async function bijlagenOpslag(): Promise<{ bytes: number; objecten: number }> {
  return telBucket(b2(), BUCKET);
}

/**
 * De vaste URL van een object. Dit is wat er in `bijlageUrl` in de database
 * komt te staan — hij werkt zonder handtekening níet, en dat is de bedoeling.
 */
export function b2ObjectUrl(sleutel: string): string {
  return `https://${b2Host()}/${sleutel}`;
}

/**
 * Wijst deze URL naar een bijlage in onze eigen bucket? Zo ja: de sleutel.
 *
 * De prefix-eis is een beveiliging, geen opmaak: zonder die eis zou een
 * gebruiker `bijlageUrl` op een willekeurig ander object in de bucket kunnen
 * zetten en het via zijn eigen bijlage-rij ophalen.
 */
export function b2SleutelUitUrl(u: URL): string | null {
  if (!b2Ingesteld()) return null;
  if (u.hostname.toLowerCase() !== b2Host()) return null;
  const sleutel = u.pathname.replace(/^\//, "");
  if (!SLEUTEL_PATROON.test(sleutel) || sleutel.length > 200) return null;
  return sleutel;
}

/** Verzint een unieke, botsingsvrije sleutel bij een bestandsnaam. */
export function maakSleutel(bestandsnaam: string): string {
  const basis = (bestandsnaam.split(/[\/\\]/).pop() ?? "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^[.\-]+/, "")
    .slice(0, 80);
  return `${BIJLAGE_PREFIX}${randomBytes(12).toString("hex")}-${basis || "bijlage"}`;
}

/**
 * Kortlevende upload-URL. De client doet er één PUT naartoe met precies deze
 * `Content-Type` en `Content-Length`.
 *
 * Beide headers worden meeondertekend. Dat is hier de maatgrens: een client
 * die meer bytes stuurt dan hij opgaf, krijgt van B2 een handtekeningfout.
 * Presigned POST met een policy (de gebruikelijke manier om een maximum af te
 * dwingen) kan niet — B2 ondersteunt dat niet.
 */
export async function maakUploadUrl(opts: {
  sleutel: string;
  contentType: string;
  bytes: number;
  secondenGeldig?: number;
}): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: opts.sleutel,
    ContentType: opts.contentType,
    ContentLength: opts.bytes,
  });
  return getSignedUrl(b2(), cmd, {
    expiresIn: opts.secondenGeldig ?? 600,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}

/**
 * Kortlevende download-URL, met de oorspronkelijke bestandsnaam erin zodat
 * "opslaan als" niet de kale sleutel voorstelt. `inline` houdt het gedrag
 * gelijk aan de oude Blob-links: pdf's en foto's openen in beeld.
 */
export async function maakDownloadUrl(
  sleutel: string,
  opts?: { bestandsnaam?: string; secondenGeldig?: number }
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: sleutel,
    ...(opts?.bestandsnaam
      ? {
          ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(
            opts.bestandsnaam
          )}`,
        }
      : {}),
  });
  return getSignedUrl(b2(), cmd, { expiresIn: opts?.secondenGeldig ?? 300 });
}

/** Rechtstreeks uploaden vanaf de server (relay-route en migratiescript). */
export async function uploadNaarB2(
  sleutel: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  await b2().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: sleutel,
      Body: body,
      ContentType: contentType,
      ContentLength: body.byteLength,
    })
  );
  return b2ObjectUrl(sleutel);
}

/** Weghalen bij B2. Alleen voor sleutels die wij zelf gemaakt hebben. */
export async function verwijderVanB2(sleutel: string): Promise<void> {
  if (!SLEUTEL_PATROON.test(sleutel)) throw new Error(`Onveilige sleutel: ${sleutel}`);
  await b2().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: sleutel }));
}
