import { api, groep, verwacht, verwachtGeweigerd, verwachtStatus, verwachtValidatiefout, nooitServerfout, login, kort } from "../lib";
import { WACHTWOORD } from "../fixture";
import { prisma } from "../fixture";
import type { Ctx } from "../context";

export const naam = "Inloggen, tokens en rate-limiting";

export async function draai(c: Ctx) {
  const f = c.f;

  groep("Inloggen — geldige en ongeldige combinaties");

  verwacht(
    "juiste combinatie geeft een token",
    !!c.leerlingA1.token,
    "KRITIEK",
    "een JWT",
    "geen token"
  );

  {
    const a = await api("POST", "/api/mobile/login", {
      body: { email: f.leerlingA1.email, password: "FoutWachtwoord1!" },
    });
    verwachtStatus("fout wachtwoord wordt geweigerd", a, 401, "KRITIEK");
  }
  {
    const a = await api("POST", "/api/mobile/login", {
      body: { email: "bestaatniet@stresstest.local", password: WACHTWOORD },
    });
    verwachtStatus("onbekend e-mailadres wordt geweigerd", a, 401, "KRITIEK");
    verwacht(
      "geen accountenumeratie in de foutmelding",
      !/bestaat niet|onbekend account|geen gebruiker/i.test(a.tekst),
      "LAAG",
      "neutrale melding",
      kort(a)
    );
  }
  {
    const a = await api("POST", "/api/mobile/login", {
      body: { email: f.leerlingA1.email.toUpperCase(), password: WACHTWOORD },
    });
    verwachtStatus("hoofdletters in e-mail werken toch", a, 200, "MIDDEL");
  }
  {
    const a = await api("POST", "/api/mobile/login", {
      body: { email: `  ${f.leerlingA1.email}  `, password: WACHTWOORD },
    });
    verwachtStatus("spaties rond e-mail worden getrimd", a, 200, "LAAG");
  }
  {
    const a = await api("POST", "/api/mobile/login", { body: {} });
    verwachtValidatiefout("lege body geeft nette fout", a);
  }
  {
    const a = await api("POST", "/api/mobile/login", { body: "{niet eens json" });
    verwachtValidatiefout("kapotte JSON geeft nette fout", a, "HOOG");
  }
  {
    const a = await api("POST", "/api/mobile/login", {
      body: { email: { $ne: null }, password: { $ne: null } },
    });
    verwachtValidatiefout("object in plaats van string (NoSQL-stijl) wordt geweigerd", a, "KRITIEK");
  }
  {
    const a = await api("POST", "/api/mobile/login", {
      body: { email: "' OR 1=1 --", password: "' OR 1=1 --" },
    });
    verwachtValidatiefout("SQL-injectie in inlogveld wordt geweigerd", a, "KRITIEK");
  }
  {
    const a = await api("POST", "/api/mobile/login", {
      body: { email: f.leerlingA1.email, password: "A".repeat(20_000) },
    });
    nooitServerfout("extreem lang wachtwoord laat de server niet vallen", a);
  }

  groep("Tokens");

  {
    const a = await api("GET", "/api/leerling/huiswerk");
    verwachtGeweigerd("zonder token geen toegang", a);
  }
  {
    const a = await api("GET", "/api/leerling/huiswerk", { token: "onzin.token.waarde" });
    verwachtGeweigerd("onzin-token geeft geen toegang", a);
  }
  {
    // Handtekening slopen, payload intact laten
    const delen = c.leerlingA1.token.split(".");
    const geknoeid = `${delen[0]}.${delen[1]}.${"x".repeat(delen[2].length)}`;
    const a = await api("GET", "/api/leerling/huiswerk", { token: geknoeid });
    verwachtGeweigerd("token met kapotte handtekening wordt geweigerd", a);
  }
  {
    // alg:none-aanval: payload met role ADMIN, geen handtekening
    const kop = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const lading = Buffer.from(
      JSON.stringify({ id: f.leerlingA1.id, role: "ADMIN", schoolId: f.schoolA.id })
    ).toString("base64url");
    const a = await api("GET", "/api/gebruikers", { token: `${kop}.${lading}.` });
    verwachtGeweigerd("alg:none-token geeft geen adminrechten", a);
  }
  {
    // Payload aanpassen naar ADMIN met behoud van de originele handtekening
    const delen = c.leerlingA1.token.split(".");
    const lading = JSON.parse(Buffer.from(delen[1], "base64url").toString());
    lading.role = "ADMIN";
    const nieuw = Buffer.from(JSON.stringify(lading)).toString("base64url");
    const a = await api("GET", "/api/gebruikers", { token: `${delen[0]}.${nieuw}.${delen[2]}` });
    verwachtGeweigerd("rol opwaarderen in het token werkt niet", a);
  }
  {
    const a = await api("GET", "/api/leerling/huiswerk", {
      headers: { authorization: c.leerlingA1.token },
    });
    verwachtGeweigerd("token zonder 'Bearer '-prefix wordt niet geaccepteerd", a, "LAAG");
  }

  groep("Rate-limiting bij inloggen");

  {
    // 6 keer fout op hetzelfde adres; de limiet ligt op 5 per 15 minuten.
    const statussen: number[] = [];
    for (let i = 0; i < 7; i++) {
      const a = await api("POST", "/api/mobile/login", {
        body: { email: f.leerlingA2.email, password: `fout-${i}` },
      });
      statussen.push(a.status);
    }
    verwacht(
      "herhaald fout inloggen loopt tegen een 429",
      statussen.includes(429),
      "HOOG",
      "ergens een 429 (te veel pogingen)",
      `statussen: ${statussen.join(", ")}`
    );
    verwacht(
      "geen serverfout tijdens het bombarderen",
      !statussen.some((s) => s >= 500 || s === 0),
      "HOOG",
      "geen 5xx",
      `statussen: ${statussen.join(", ")}`
    );
  }

  // Tellers wissen, anders raakt de rest van de run geblokkeerd op het IP-plafond.
  await prisma.loginPoging.deleteMany({});

  {
    const s = await login(f.leerlingA2.email, WACHTWOORD);
    verwacht(
      "na het wissen van de tellers kan het echte account weer inloggen",
      !!s,
      "HOOG",
      "een geldige sessie",
      "inloggen mislukt"
    );
  }

  groep("Wachtwoord vergeten / opnieuw instellen");

  {
    const a = await api("POST", "/api/auth/forgot-password", {
      body: { email: "bestaatechtniet@stresstest.local" },
    });
    verwacht(
      "onbekend adres geeft hetzelfde antwoord als een bekend adres",
      a.status === 200,
      "MIDDEL",
      "200 (geen enumeratie)",
      kort(a)
    );
  }
  {
    const a = await api("POST", "/api/auth/forgot-password", { body: {} });
    verwachtValidatiefout("forgot-password zonder e-mail geeft nette fout", a);
  }
  {
    const a = await api("POST", "/api/auth/reset-password", {
      body: { token: "bestaatniet", nieuwWachtwoord: "NieuwGeheim123" },
    });
    verwachtValidatiefout("onbekend reset-token wordt geweigerd", a, "KRITIEK");
  }
  {
    const a = await api("POST", "/api/auth/reset-password", {
      body: { token: "x", nieuwWachtwoord: "kort" },
    });
    verwachtValidatiefout("te kort wachtwoord wordt geweigerd", a, "HOOG");
  }
  {
    // Een echt, geldig token aanmaken en twee keer inwisselen.
    const token = `stress-${Date.now()}`;
    await prisma.passwordResetToken.create({
      data: {
        token,
        gebruikerId: f.leerlingA2.id,
        verlooptOp: new Date(Date.now() + 3600_000),
      },
    });
    const eerste = await api("POST", "/api/auth/reset-password", {
      body: { token, nieuwWachtwoord: "TijdelijkGeheim1" },
    });
    verwachtStatus("geldig token laat het wachtwoord wijzigen", eerste, 200, "HOOG");

    const tweede = await api("POST", "/api/auth/reset-password", {
      body: { token, nieuwWachtwoord: "NogEenGeheim22" },
    });
    verwachtValidatiefout("hetzelfde token kan geen tweede keer worden gebruikt", tweede, "KRITIEK");

    const oud = await api("POST", "/api/mobile/login", {
      body: { email: f.leerlingA2.email, password: WACHTWOORD },
    });
    verwachtStatus("het oude wachtwoord werkt niet meer", oud, 401, "KRITIEK");

    const nieuw = await login(f.leerlingA2.email, "TijdelijkGeheim1");
    verwacht(
      "het nieuwe wachtwoord werkt wel",
      !!nieuw,
      "HOOG",
      "inloggen lukt",
      "inloggen mislukt"
    );
  }
  {
    // Verlopen token
    const token = `stress-verlopen-${Date.now()}`;
    await prisma.passwordResetToken.create({
      data: {
        token,
        gebruikerId: f.leerlingA4.id,
        verlooptOp: new Date(Date.now() - 1000),
      },
    });
    const a = await api("POST", "/api/auth/reset-password", {
      body: { token, nieuwWachtwoord: "MagNietLukken12" },
    });
    verwachtValidatiefout("verlopen token wordt geweigerd", a, "KRITIEK");
  }

  await prisma.loginPoging.deleteMany({});
}
