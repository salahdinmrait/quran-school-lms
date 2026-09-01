import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// Relatief, niet via "@/": dit bestand wordt ook door losse tsx-scripts gebruikt.
import { b2Endpoint, maakB2Client, telBucket } from "./b2";

/**
 * De back-upbucket — bewust een **andere** bucket dan die van de bijlagen, met
 * eigen sleutels.
 *
 * Reden: `b2SleutelUitUrl()` laat alles binnen `bijlagen/` door. Zouden de
 * back-ups in dezelfde bucket staan, dan zou één versoepeling van dat patroon
 * genoeg zijn om een gebruiker via zijn eigen bijlage-rij naar een back-up te
 * laten wijzen. Twee buckets met elk een eigen, bucket-gescopete sleutel maakt
 * dat onmogelijk in plaats van onwaarschijnlijk.
 *
 * De inhoud blijft daarnaast versleuteld met BACKUP_SECRET (AES-256-GCM).
 */

const BUCKET = process.env.B2_BACKUP_BUCKET ?? "";
const KEY_ID = process.env.B2_BACKUP_KEY_ID ?? "";
const APP_KEY = process.env.B2_BACKUP_APP_KEY ?? "";

export const BACKUP_PREFIX = "backups/";

export function backupIngesteld(): boolean {
  return Boolean(BUCKET && KEY_ID && APP_KEY && b2Endpoint());
}

let client: S3Client | null = null;

function b2(): S3Client {
  if (!backupIngesteld()) {
    throw new Error(
      "Back-upopslag is niet ingesteld (B2_BACKUP_BUCKET/B2_BACKUP_KEY_ID/B2_BACKUP_APP_KEY)"
    );
  }
  if (!client) client = maakB2Client({ keyId: KEY_ID, appKey: APP_KEY });
  return client;
}

export interface BackupObject {
  sleutel: string;
  bytes: number;
  gemaaktOp: Date;
}

export async function backupSchrijf(sleutel: string, inhoud: Buffer): Promise<void> {
  await b2().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: sleutel,
      Body: inhoud,
      ContentType: "application/octet-stream",
      ContentLength: inhoud.byteLength,
    })
  );
}

export async function backupLijst(prefix = BACKUP_PREFIX): Promise<BackupObject[]> {
  const uit: BackupObject[] = [];
  let token: string | undefined;
  do {
    const pagina = await b2().send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token })
    );
    for (const obj of pagina.Contents ?? []) {
      if (!obj.Key) continue;
      uit.push({ sleutel: obj.Key, bytes: obj.Size ?? 0, gemaaktOp: obj.LastModified ?? new Date(0) });
    }
    token = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
  } while (token);
  return uit.sort((a, b) => b.gemaaktOp.getTime() - a.gemaaktOp.getTime());
}

export async function backupVerwijder(sleutels: string[]): Promise<void> {
  // DeleteObjects neemt maximaal 1000 sleutels per aanroep.
  for (let i = 0; i < sleutels.length; i += 1000) {
    await b2().send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: sleutels.slice(i, i + 1000).map((Key) => ({ Key })) },
      })
    );
  }
}

/** Kortlevende downloadlink; de bucket is privé, dus zonder dit werkt niets. */
export async function backupDownloadUrl(sleutel: string, secondenGeldig = 900): Promise<string> {
  return getSignedUrl(b2(), new GetObjectCommand({ Bucket: BUCKET, Key: sleutel }), {
    expiresIn: secondenGeldig,
  });
}

export async function backupOpslag(): Promise<{ bytes: number; objecten: number }> {
  return telBucket(b2(), BUCKET);
}
