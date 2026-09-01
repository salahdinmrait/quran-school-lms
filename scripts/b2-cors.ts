import "dotenv/config";
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Zet de CORS-regels op de bijlagen-bucket.
 *
 * Nodig omdat de webapp (browser) het bestand rechtstreeks naar B2 PUT. Zonder
 * deze regels blokkeert de browser die upload al bij het preflight-verzoek.
 * De mobiele app heeft dit niet nodig — die kent geen CORS.
 *
 * Draaien: `npx tsx scripts/b2-cors.ts` (leest de B2_*-waarden uit .env).
 */

const ORIGINS = [
  "https://quran-school-app.vercel.app",
  // Vercel-previews krijgen elke keer een andere naam.
  "https://*.vercel.app",
  // Lokaal ontwikkelen: Expo web en de LMS zelf.
  "http://localhost:8081",
  "http://localhost:3000",
];

async function main() {
  const endpoint = (process.env.B2_ENDPOINT ?? "").replace(/^https?:\/\//, "");
  const client = new S3Client({
    region: /^s3\.([a-z0-9-]+)\./.exec(endpoint)![1],
    endpoint: `https://${endpoint}`,
    credentials: {
      accessKeyId: process.env.B2_KEY_ID!,
      secretAccessKey: process.env.B2_APP_KEY!,
    },
  });
  const Bucket = process.env.B2_BUCKET!;

  await client.send(
    new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            ID: "jadwal-webapp-upload",
            AllowedOrigins: ORIGINS,
            AllowedMethods: ["GET", "HEAD", "PUT"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );

  const nu = await client.send(new GetBucketCorsCommand({ Bucket }));
  console.log(JSON.stringify(nu.CORSRules, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
