import "dotenv/config";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { b2Ingesteld, b2Host, b2ObjectUrl, b2SleutelUitUrl, maakDownloadUrl, maakSleutel, maakUploadUrl } from "../lib/b2";

async function main() {
  console.log("b2Ingesteld:", b2Ingesteld(), "host:", b2Host());

  const inhoud = Buffer.from("Jadwal B2 rooktest " + new Date().toISOString());
  const sleutel = maakSleutel("rooktest voorbeeld.txt");
  console.log("sleutel:", sleutel);

  const url = b2ObjectUrl(sleutel);
  console.log("objectUrl herkend als eigen sleutel:", b2SleutelUitUrl(new URL(url)) === sleutel);

  const uploadUrl = await maakUploadUrl({ sleutel, contentType: "text/plain", bytes: inhoud.byteLength });
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/plain", "Content-Length": String(inhoud.byteLength) },
    body: inhoud,
  });
  console.log("PUT status:", put.status, put.ok ? "OK" : await put.text());
  if (!put.ok) process.exit(1);

  // Zonder handtekening moet de privé-bucket weigeren.
  const kaal = await fetch(url);
  console.log("kale URL status (moet 401/403 zijn):", kaal.status);

  const downloadUrl = await maakDownloadUrl(sleutel, { bestandsnaam: "rooktest voorbeeld.txt" });
  const get = await fetch(downloadUrl);
  const terug = await get.text();
  console.log("GET status:", get.status, "identiek:", terug === inhoud.toString());
  console.log("Content-Disposition:", get.headers.get("content-disposition"));

  // Te veel bytes sturen dan opgegeven moet stuklopen op de handtekening.
  const sleutel2 = maakSleutel("te-groot.txt");
  const krap = await maakUploadUrl({ sleutel: sleutel2, contentType: "text/plain", bytes: 10 });
  const teveel = Buffer.from("dit zijn veel meer dan tien bytes");
  const put2 = await fetch(krap, {
    method: "PUT",
    headers: { "Content-Type": "text/plain", "Content-Length": String(teveel.byteLength) },
    body: teveel,
  });
  console.log("PUT met afwijkende lengte (moet falen):", put2.status);

  const client = new S3Client({
    region: /^s3\.([a-z0-9-]+)\./.exec(process.env.B2_ENDPOINT!)![1],
    endpoint: `https://${process.env.B2_ENDPOINT}`,
    credentials: { accessKeyId: process.env.B2_KEY_ID!, secretAccessKey: process.env.B2_APP_KEY! },
  });
  await client.send(new DeleteObjectCommand({ Bucket: process.env.B2_BUCKET!, Key: sleutel }));
  console.log("opgeruimd:", sleutel);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
