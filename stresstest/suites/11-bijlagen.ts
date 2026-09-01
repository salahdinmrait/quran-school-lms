import {
  api, groep, verwacht, verwachtGeweigerd, verwachtStatus, verwachtValidatiefout,
  nooitServerfout, sla_over, kort, ok, GEMENE_STRINGS,
} from "../lib";
import { prisma } from "../fixture";
import { verwijderVanB2 } from "../../lib/b2";
import type { Ctx } from "../context";

export const naam = "Bijlagen: upload, URL-injectie en downloadscoping";

const BLOB_AAN = !!process.env.BLOB_READ_WRITE_TOKEN;
const B2_AAN = !!(
  process.env.B2_BUCKET && process.env.B2_ENDPOINT && process.env.B2_KEY_ID && process.env.B2_APP_KEY
);
const B2_HOST = `${process.env.B2_BUCKET}.${(process.env.B2_ENDPOINT ?? "").replace(/^https?:\/\//, "")}`;

/** Ziet eruit als onze eigen opslag; wordt nooit echt opgehaald (redirect: manual). */
const BLOB_URL = "https://abc123store.public.blob.vercel-storage.com/bijlagen/toets-a1b2.pdf";

const KWAADAARDIGE_URLS: { label: string; waarde: unknown }[] = [
  { label: "externe host", waarde: "https://kwaadaardig.example/phishing.html" },
  { label: "http zonder tls", waarde: "http://kwaadaardig.example/x.pdf" },
  { label: "javascript-schema", waarde: "javascript:alert(1)" },
  { label: "data-schema", waarde: "data:text/html,<script>alert(1)</script>" },
  { label: "file-schema", waarde: "file:///etc/passwd" },
  { label: "metadata-dienst (SSRF)", waarde: "http://169.254.169.254/latest/meta-data/" },
  { label: "localhost", waarde: "http://localhost:3000/api/dev/scholen" },
  { label: "geen geldige URL", waarde: "zomaar-wat-tekst" },
  { label: "hostnaam-achtervoegsel", waarde: "https://public.blob.vercel-storage.com.kwaadaardig.example/x" },
  { label: "pad-truc", waarde: "https://kwaadaardig.example/public.blob.vercel-storage.com/x" },
  { label: "inloggegevens in URL", waarde: "https://a.public.blob.vercel-storage.com@kwaadaardig.example/x" },
  { label: "protocolloos", waarde: "//kwaadaardig.example/x" },
  { label: "getal", waarde: 12345 },
  { label: "object", waarde: { url: "https://kwaadaardig.example" } },
  { label: "array", waarde: ["https://kwaadaardig.example"] },
  { label: "boolean", waarde: true },
  { label: "zeer lang", waarde: "https://a.public.blob.vercel-storage.com/" + "a".repeat(5000) },
];

/** Korte selectie voor de routes die dezelfde helper gebruiken. */
const KORTE_LIJST = KWAADAARDIGE_URLS.filter((k) =>
  ["externe host", "javascript-schema", "geen geldige URL", "inloggegevens in URL", "object"].includes(k.label)
);

function bestand(bestandsnaam: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], bestandsnaam, { type });
}

function formulierMet(f: File): FormData {
  const fd = new FormData();
  fd.append("file", f);
  return fd;
}

export async function draai(c: Ctx) {
  const f = c.f;

  // ── 1. Upload-endpoint: toegang ───────────────────────────────────────────
  groep("Bijlage-upload — toegang");
  {
    const zonder = await api("POST", "/api/bijlage-upload", {
      formData: formulierMet(bestand("x.png", "image/png", 10)),
    });
    verwachtStatus("upload zonder token wordt geweigerd", zonder, 401, "KRITIEK");

    const rommel = await api("POST", "/api/bijlage-upload", {
      token: "niet.een.geldig.token",
      formData: formulierMet(bestand("x.png", "image/png", 10)),
    });
    verwachtStatus("upload met een onzin-token wordt geweigerd", rommel, 401, "KRITIEK");

    const geknoeid = await api("POST", "/api/bijlage-upload", {
      token: c.leerlingA1.token.slice(0, -3) + "aaa",
      formData: formulierMet(bestand("x.png", "image/png", 10)),
    });
    verwachtStatus("upload met een geknoeide handtekening wordt geweigerd", geknoeid, 401, "KRITIEK");
  }

  // ── 2. Upload-endpoint: invoerkeuring (loopt niet tot de Blob-opslag) ─────
  groep("Bijlage-upload — invoerkeuring");
  {
    const leeg = await api("POST", "/api/bijlage-upload", {
      token: c.leerlingA1.token,
      formData: new FormData(),
    });
    verwachtStatus("upload zonder bestandsveld geeft 400", leeg, 400, "MIDDEL");

    const tekstveld = new FormData();
    tekstveld.append("file", "gewoon een string");
    const alsTekst = await api("POST", "/api/bijlage-upload", {
      token: c.leerlingA1.token, formData: tekstveld,
    });
    verwachtStatus("upload met een tekstveld in plaats van een bestand geeft 400", alsTekst, 400, "MIDDEL");

    const jsonInPlaats = await api("POST", "/api/bijlage-upload", {
      token: c.leerlingA1.token, body: { file: "x" },
    });
    verwachtValidatiefout("upload met JSON in plaats van multipart geeft een nette fout", jsonInPlaats, "MIDDEL");

    const nulBytes = await api("POST", "/api/bijlage-upload", {
      token: c.leerlingA1.token, formData: formulierMet(bestand("leeg.png", "image/png", 0)),
    });
    verwachtValidatiefout("leeg bestand wordt geweigerd", nulBytes, "LAAG");

    const teGroot = await api("POST", "/api/bijlage-upload", {
      token: c.leerlingA1.token,
      formData: formulierMet(bestand("groot.png", "image/png", 4 * 1024 * 1024 + 1)),
    });
    verwachtStatus("bestand boven 4 MB geeft 413", teGroot, 413, "HOOG");

    const verbodenTypes = [
      { label: "html", type: "text/html" },
      { label: "svg (kan script bevatten)", type: "image/svg+xml" },
      { label: "uitvoerbaar", type: "application/x-msdownload" },
      { label: "zip", type: "application/zip" },
      { label: "leeg type", type: "" },
      { label: "onzin-type", type: "geen/type/klopt" },
    ];
    for (const v of verbodenTypes) {
      const a = await api("POST", "/api/bijlage-upload", {
        token: c.leerlingA1.token, formData: formulierMet(bestand("x.bin", v.type, 32)),
      });
      verwachtStatus(`type ${v.label} wordt geweigerd`, a, 400, "HOOG");
    }
  }

  // ── 2b. Upload-endpoint: de presign-weg (JSON) ───────────────────────────
  // De client uploadt zelf naar B2; deze route deelt alleen een kortlevende
  // PUT-URL uit. Hier wordt gekeurd wat híj mag uitdelen.
  groep("Bijlage-upload — presign (JSON)");
  if (!B2_AAN) {
    sla_over("B2_* ontbreekt; de presign-weg is niet te testen");
  } else {
    const ongeldig: { label: string; body: Record<string, unknown> }[] = [
      { label: "naam ontbreekt", body: { type: "image/png", grootte: 10 } },
      { label: "naam is geen tekst", body: { naam: 42, type: "image/png", grootte: 10 } },
      { label: "type niet toegestaan", body: { naam: "x.html", type: "text/html", grootte: 10 } },
      { label: "grootte ontbreekt", body: { naam: "x.png", type: "image/png" } },
      { label: "grootte is tekst", body: { naam: "x.png", type: "image/png", grootte: "10" } },
      { label: "grootte 0", body: { naam: "x.png", type: "image/png", grootte: 0 } },
      { label: "grootte negatief", body: { naam: "x.png", type: "image/png", grootte: -5 } },
      { label: "grootte gebroken getal", body: { naam: "x.png", type: "image/png", grootte: 1.5 } },
    ];
    for (const g of ongeldig) {
      const a = await api("POST", "/api/bijlage-upload", { token: c.leerlingA1.token, body: g.body });
      verwachtStatus(`presign: ${g.label} wordt geweigerd`, a, 400, "HOOG");
    }

    const teGroot = await api("POST", "/api/bijlage-upload", {
      token: c.leerlingA1.token,
      body: { naam: "groot.mp3", type: "audio/mpeg", grootte: 10 * 1024 * 1024 + 1 },
    });
    verwachtStatus("presign: boven 10 MB geeft 413", teGroot, 413, "HOOG");

    const goed = await api("POST", "/api/bijlage-upload", {
      token: c.leerlingA1.token,
      body: { naam: "../../backups/geheim.mp3", type: "audio/mpeg", grootte: 1024 },
    });
    verwachtStatus("presign: een geldige aanvraag levert een upload-URL", goed, 200, "HOOG");
    const uit = goed.body as { uploadUrl?: string; url?: string; headers?: Record<string, string> };
    verwacht(
      "presign: de upload-URL is ondertekend en wijst naar onze eigen bucket",
      typeof uit?.uploadUrl === "string" &&
        new URL(uit.uploadUrl).hostname === B2_HOST &&
        new URL(uit.uploadUrl).searchParams.has("X-Amz-Signature"),
      "KRITIEK",
      `ondertekende URL op ${B2_HOST}`,
      String(uit?.uploadUrl ?? "(geen)")
    );
    verwacht(
      "presign: een pad-traversal in de naam komt niet buiten bijlagen/ terecht",
      typeof uit?.url === "string" &&
        new URL(uit.url).hostname === B2_HOST &&
        /^\/bijlagen\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(new URL(uit.url).pathname),
      "KRITIEK",
      "platte sleutel onder /bijlagen/",
      String(uit?.url ?? "(geen)")
    );
    verwacht(
      "presign: de grootte staat vast in de mee te sturen headers",
      uit?.headers?.["Content-Length"] === "1024" && uit?.headers?.["Content-Type"] === "audio/mpeg",
      "HOOG",
      "Content-Length 1024 en Content-Type audio/mpeg",
      JSON.stringify(uit?.headers ?? null)
    );
    await prisma.loginPoging.deleteMany({ where: { sleutel: { startsWith: "bijlage-upload:" } } });
  }

  // ── 3. Upload-endpoint: gemene bestandsnamen ─────────────────────────────
  groep("Bijlage-upload — bestandsnamen");
  if (!B2_AAN) {
    sla_over("B2_* ontbreekt; namen die de opslag raken zijn niet te testen");
  } else {
    const namen = [
      "../../backups/jadwal-backup.json.gz.enc",
      "..\\..\\alerts\\opslag-80-gewaarschuwd.txt",
      "/etc/passwd",
      "A".repeat(600) + ".png",
      "",
      ".",
      "..",
      "محمد صورة.png",
    ];
    // Deze weg zet het bestand écht neer; wat we aanmaken ruimen we hieronder
    // weer op, anders groeit de bucket bij elke stresstestrun.
    const opruimen: string[] = [];
    for (const n of namen) {
      const a = await api("POST", "/api/bijlage-upload", {
        token: c.docentA1.token, formData: formulierMet(bestand(n, "image/png", 16)),
      });
      nooitServerfout(`bestandsnaam ${JSON.stringify(n.slice(0, 30))} laat de server niet vallen`, a, "HOOG");
      const url = (a.body as { url?: string })?.url;
      verwacht(
        `bestandsnaam ${JSON.stringify(n.slice(0, 30))} komt niet buiten bijlagen/ terecht`,
        typeof url !== "string" || new URL(url).pathname.startsWith("/bijlagen/"),
        "KRITIEK",
        "pad onder /bijlagen/",
        String(url ?? "(geen url)")
      );
      if (typeof url === "string") opruimen.push(new URL(url).pathname.slice(1));
    }
    for (const sleutel of opruimen) {
      try {
        await verwijderVanB2(sleutel);
      } catch {
        console.warn(`  ! opruimen van ${sleutel} mislukt — handmatig weghalen bij B2`);
      }
    }
  }

  // ── 4. Upload-endpoint: limiet tegen volgooien ───────────────────────────
  groep("Bijlage-upload — limiet tegen volgooien van de opslag");
  {
    let geremd = false;
    let laatste = "";
    for (let i = 0; i < 34 && !geremd; i++) {
      const a = await api("POST", "/api/bijlage-upload", {
        token: c.leerlingA2.token, formData: new FormData(),
      });
      laatste = kort(a);
      if (a.status === 429) geremd = true;
      if (a.status >= 500) break;
    }
    verwacht(
      "een account kan niet eindeloos blijven uploaden (429 na een reeks)",
      geremd,
      "HOOG",
      "429 na ongeveer 30 uploads binnen het venster",
      `geen 429 gezien; laatste antwoord ${laatste}`
    );
    await prisma.loginPoging.deleteMany({ where: { sleutel: { startsWith: "bijlage-upload:" } } });
  }

  // ── 5. bijlageUrl-injectie via de gewone schrijfroutes ───────────────────
  groep("bijlageUrl-injectie — berichten (laagste rol)");
  for (const k of KWAADAARDIGE_URLS) {
    const a = await api("POST", "/api/berichten", {
      token: c.leerlingA1.token,
      body: {
        onderwerp: "Stress bijlage",
        inhoud: "test",
        doelType: "GEBRUIKERS",
        doelIds: [f.docentA1.id],
        bijlageNaam: "rapport.pdf",
        bijlageType: "application/pdf",
        bijlageUrl: k.waarde,
      },
    });
    verwachtValidatiefout(`bericht met bijlageUrl (${k.label}) wordt geweigerd`, a, "KRITIEK");
  }

  groep("bijlageUrl-injectie — overige schrijfroutes");
  {
    const routes: { label: string; pad: string; token: string; body: Record<string, unknown> }[] = [
      {
        label: "les aanmaken", pad: "/api/lessen", token: c.docentA1.token,
        body: { klasId: f.klasA1, datum: "2030-01-10", begintijd: "09:00", eindtijd: "10:00" },
      },
      {
        label: "huiswerk aanmaken", pad: "/api/docent/huiswerk", token: c.docentA1.token,
        body: { titel: "Stress bijlage", vakId: f.vakA1, lesId: f.lesA1Toekomst },
      },
      {
        label: "cijfer invoeren", pad: "/api/docent/cijfers", token: c.docentA1.token,
        body: { leerlingId: f.leerlingA1.id, vakId: f.vakA1, waarde: 7 },
      },
      {
        label: "studiemateriaal", pad: "/api/studiemateriaal", token: c.docentA1.token,
        body: { titel: "Stress bijlage", klasId: f.klasA1 },
      },
    ];
    for (const r of routes) {
      for (const k of KORTE_LIJST) {
        const a = await api("POST", r.pad, {
          token: r.token,
          body: { ...r.body, bijlageNaam: "rapport.pdf", bijlageType: "application/pdf", bijlageUrl: k.waarde },
        });
        verwachtValidatiefout(`${r.label} met bijlageUrl (${k.label}) wordt geweigerd`, a, "KRITIEK");
      }
    }

    for (const k of KORTE_LIJST) {
      const a = await api("PATCH", `/api/lessen/${f.lesA1Toekomst}`, {
        token: c.docentA1.token,
        body: { bijlageNaam: "rapport.pdf", bijlageType: "application/pdf", bijlageUrl: k.waarde },
      });
      verwachtValidatiefout(`les wijzigen met bijlageUrl (${k.label}) wordt geweigerd`, a, "KRITIEK");
    }
  }

  groep("bijlageData — base64 hoort niet meer in de database");
  {
    const groot = "A".repeat(200_000);
    const a = await api("POST", "/api/berichten", {
      token: c.leerlingA1.token,
      body: {
        onderwerp: "Stress base64", inhoud: "test",
        doelType: "GEBRUIKERS", doelIds: [f.docentA1.id],
        bijlageNaam: "groot.pdf", bijlageType: "application/pdf", bijlageData: groot,
      },
    });
    verwachtValidatiefout("bericht met base64-bijlage wordt geweigerd (Neon niet volgooien)", a, "HOOG");

    const b = await api("POST", "/api/docent/huiswerk", {
      token: c.docentA1.token,
      body: {
        titel: "Stress base64", vakId: f.vakA1, lesId: f.lesA1Toekomst,
        bijlageNaam: "groot.pdf", bijlageType: "application/pdf", bijlageData: groot,
      },
    });
    verwachtValidatiefout("huiswerk met base64-bijlage wordt geweigerd", b, "HOOG");
  }

  groep("Een geldige Blob-URL wordt wel aangenomen");
  {
    const a = await api("POST", "/api/berichten", {
      token: c.leerlingA1.token,
      body: {
        onderwerp: "Stress geldige bijlage", inhoud: "test",
        doelType: "GEBRUIKERS", doelIds: [f.docentA1.id],
        bijlageNaam: "toets.pdf", bijlageType: "application/pdf", bijlageUrl: BLOB_URL,
      },
    });
    verwachtStatus("bericht met een echte Blob-URL wordt aangenomen", a, [200, 201], "HOOG");

    const rij = await prisma.bericht.findFirst({
      where: { onderwerp: "Stress geldige bijlage" },
      orderBy: { createdAt: "desc" },
      select: { id: true, bijlageUrl: true },
    });
    verwacht(
      "de Blob-URL wordt onveranderd opgeslagen",
      rij?.bijlageUrl === BLOB_URL,
      "HOOG",
      BLOB_URL,
      String(rij?.bijlageUrl)
    );

    if (rij) {
      const d = await api("GET", `/api/attachment/bericht/${rij.id}`, {
        token: c.docentA1.token, redirect: "manual",
      });
      verwacht(
        "de bijlage wordt doorgestuurd naar de Blob-URL",
        d.status === 302 || d.status === 307,
        "HOOG",
        "302/307 naar de Blob-URL",
        kort(d)
      );
      verwacht(
        "de doorstuurbestemming is de opgeslagen Blob-URL",
        (d.headers.get("location") ?? "").startsWith("https://abc123store.public.blob.vercel-storage.com/"),
        "HOOG",
        BLOB_URL,
        d.headers.get("location") ?? "(geen location)"
      );
    }
    await prisma.bericht.deleteMany({ where: { onderwerp: { startsWith: "Stress " } } });
  }

  // ── 6. Bestaande rijen: de downloadroute mag nooit blind doorsturen ──────
  groep("Oude rijen met een kwaadaardige URL (verdediging in de diepte)");
  {
    const origineel = await prisma.bericht.findUnique({
      where: { id: f.berichtAanA1 },
      select: { bijlageNaam: true, bijlageUrl: true, bijlageData: true, bijlageType: true },
    });

    const gevallen = [
      { label: "externe host", url: "https://kwaadaardig.example/phishing.html" },
      { label: "kapotte URL", url: "zomaar-wat-tekst" },
      { label: "javascript-schema", url: "javascript:alert(1)" },
      { label: "lege string", url: "" },
    ];

    for (const g of gevallen) {
      await prisma.bericht.update({
        where: { id: f.berichtAanA1 },
        data: { bijlageNaam: "rapport.pdf", bijlageUrl: g.url, bijlageData: null, bijlageType: "application/pdf" },
      });
      const a = await api("GET", `/api/attachment/bericht/${f.berichtAanA1}`, {
        token: c.leerlingA1.token, redirect: "manual",
      });
      nooitServerfout(`opgeslagen ${g.label} laat de downloadroute niet vallen`, a, "KRITIEK");
      const loc = a.headers.get("location") ?? "";
      verwacht(
        `opgeslagen ${g.label} wordt niet doorgestuurd`,
        !loc.includes("kwaadaardig.example") && !loc.startsWith("javascript:"),
        "KRITIEK",
        "geen doorsturen naar een vreemde bestemming",
        `${a.status} location=${loc || "(geen)"}`
      );
    }

    await prisma.bericht.update({ where: { id: f.berichtAanA1 }, data: origineel ?? {} });
  }

  // ── 7. Scoping blijft gelden voor een bijlage met Blob-URL ───────────────
  groep("Downloadscoping met een Blob-URL");
  {
    const origineel = await prisma.les.findUnique({
      where: { id: f.lesA1Toekomst },
      select: { bijlageNaam: true, bijlageUrl: true, bijlageData: true, bijlageType: true },
    });
    await prisma.les.update({
      where: { id: f.lesA1Toekomst },
      data: { bijlageNaam: "les.pdf", bijlageUrl: BLOB_URL, bijlageData: null, bijlageType: "application/pdf" },
    });

    const mag: { label: string; token: string }[] = [
      { label: "leerling in de klas", token: c.leerlingA1.token },
      { label: "ouder van een leerling in de klas", token: c.ouderA1.token },
      { label: "docent van de klas", token: c.docentA1.token },
      // ouderA3 is de ouder van leerlingA3, die ook in klas A1 zit.
      { label: "tweede ouder uit dezelfde klas", token: c.ouderA3.token },
      { label: "admin van de school", token: c.adminA.token },
    ];
    for (const m of mag) {
      const a = await api("GET", `/api/attachment/les/${f.lesA1Toekomst}`, { token: m.token, redirect: "manual" });
      verwacht(
        `${m.label} krijgt de bijlage`,
        a.status === 302 || a.status === 307,
        "MIDDEL",
        "302/307 naar de Blob-URL",
        kort(a)
      );
    }

    const magNiet: { label: string; token: string | null }[] = [
      { label: "leerling uit een andere klas", token: c.leerlingA4.token },
      { label: "leerling van een andere school", token: c.leerlingB1.token },
      { label: "docent van een andere school", token: c.docentB1.token },
      { label: "admin van een andere school", token: c.adminB.token },
      { label: "niemand (zonder token)", token: null },
    ];
    for (const m of magNiet) {
      const a = await api("GET", `/api/attachment/les/${f.lesA1Toekomst}`, {
        token: m.token, redirect: "manual",
      });
      verwachtGeweigerd(`${m.label} krijgt de bijlage niet`, a, "KRITIEK");
      verwacht(
        `${m.label} krijgt ook geen doorstuurlink`,
        !(a.headers.get("location") ?? "").includes("blob.vercel-storage.com"),
        "KRITIEK",
        "geen location-header met de Blob-URL",
        a.headers.get("location") ?? "(geen)"
      );
    }

    groep("Downloadroute — onbekende types en id's");
    for (const type of ["onbekend", "user", "school", "backup"]) {
      const a = await api("GET", `/api/attachment/${type}/${f.lesA1Toekomst}`, {
        token: c.docentA1.token, redirect: "manual",
      });
      verwachtGeweigerd(`type ${JSON.stringify(type)} levert geen bijlage`, a, "HOOG");
    }
    for (const g of GEMENE_STRINGS.slice(0, 8)) {
      const a = await api("GET", `/api/attachment/les/${encodeURIComponent(g.waarde)}`, {
        token: c.docentA1.token, redirect: "manual",
      });
      nooitServerfout(`id ${g.label} laat de downloadroute niet vallen`, a, "HOOG");
    }

    await prisma.les.update({ where: { id: f.lesA1Toekomst }, data: origineel ?? {} });
  }

  // ── 8. Opslagwaarschuwing (cron) ─────────────────────────────────────────
  groep("Cron opslagwaarschuwing");
  {
    const zonder = await api("GET", "/api/cron/blob-opslag");
    verwachtStatus("cron zonder autorisatie wordt geweigerd", zonder, 401, "KRITIEK");

    const fout1 = await api("GET", "/api/cron/blob-opslag", { headers: { authorization: "Bearer fout" } });
    verwachtStatus("cron met een verkeerd geheim wordt geweigerd", fout1, 401, "KRITIEK");

    const fout2 = await api("GET", "/api/cron/blob-opslag", {
      headers: { authorization: process.env.CRON_SECRET ?? "leeg" },
    });
    verwachtStatus("cron zonder Bearer-voorvoegsel wordt geweigerd", fout2, 401, "HOOG");

    const metGebruiker = await api("GET", "/api/cron/blob-opslag", { token: c.adminA.token });
    verwachtStatus("een gewone admin kan de cron niet aanroepen", metGebruiker, 401, "HOOG");

    if (!BLOB_AAN) {
      sla_over("BLOB_READ_WRITE_TOKEN ontbreekt lokaal; de geslaagde cronrun is niet te testen");
    } else if (process.env.CRON_SECRET) {
      const goed = await api("GET", "/api/cron/blob-opslag", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      verwachtStatus("cron met het juiste geheim werkt", goed, 200, "HOOG");
    } else {
      sla_over("CRON_SECRET ontbreekt lokaal");
    }
  }

  ok("bijlagen-suite afgerond");
}
