import { api, groep, verwacht, verwachtGeweigerd, verwachtValidatiefout, nooitServerfout, kort, sla_over, GEMENE_IDS, GEMENE_STRINGS } from "../lib";
import { prisma } from "../fixture";
import type { Ctx } from "../context";

export const naam = "Fuzz: rommel-ids, rommel-tekst en de resterende routes";

export async function draai(c: Ctx) {
  const f = c.f;

  groep("Rommel-ids op elke route die een id in het pad neemt");

  const padden = [
    (id: string) => `/api/klassen/${id}`,
    (id: string) => `/api/vakken/${id}`,
    (id: string) => `/api/lessen/${id}`,
    (id: string) => `/api/berichten/${id}`,
    (id: string) => `/api/bijlage/${id}`,
    (id: string) => `/api/docent/cijfers/${id}`,
    (id: string) => `/api/docent/huiswerk/${id}`,
    (id: string) => `/api/docent/huiswerk/inleveringen/${id}`,
    (id: string) => `/api/attachment/huiswerk/${id}`,
    (id: string) => `/api/klassen/${id}/ranking`,
    (id: string) => `/api/klassen/${id}/leerlingen`,
  ];

  for (const maakPad of padden) {
    for (const id of GEMENE_IDS) {
      const pad = maakPad(encodeURIComponent(id));
      const a = await api("GET", pad, { token: c.adminA.token });
      nooitServerfout(`GET ${pad.slice(0, 70)} geeft geen serverfout`, a, "HOOG");
    }
  }

  groep("Rommel-ids in querystrings");

  for (const id of GEMENE_IDS) {
    const q = encodeURIComponent(id);
    for (const pad of [
      `/api/leerling-dossier?leerlingId=${q}`,
      `/api/studiemateriaal?klasId=${q}`,
      `/api/ouder/kind?leerlingId=${q}`,
    ]) {
      const a = await api("GET", pad, { token: c.adminA.token });
      if (a.status >= 500 && /insensitive|mode/i.test(a.tekst)) {
        sla_over(`${pad.slice(0, 50)} — SQLite kent geen case-insensitive zoeken (alleen lokaal)`);
        continue;
      }
      nooitServerfout(`GET ${pad.slice(0, 70)} geeft geen serverfout`, a, "HOOG");
    }
  }

  groep("Onbekende methodes en paden");

  for (const [methode, pad] of [
    ["DELETE", "/api/klassen"],
    ["PUT", "/api/berichten"],
    ["PATCH", "/api/gebruikers"],
    ["POST", "/api/leerling/cijfers"],
    ["GET", "/api/bestaatniet"],
  ] as const) {
    const a = await api(methode, pad, { token: c.adminA.token });
    verwacht(
      `${methode} ${pad} geeft 404/405, geen serverfout`,
      a.status < 500,
      "MIDDEL",
      "geen 5xx",
      kort(a, 120)
    );
  }

  groep("Bijlagen: mag iedereen alles downloaden?");

  {
    await prisma.huiswerk.update({
      where: { id: f.huiswerkKlas },
      data: {
        bijlageNaam: "geheim.txt",
        bijlageType: "text/plain",
        bijlageData: Buffer.from("GEHEIME INHOUD VAN SCHOOL A").toString("base64"),
        bijlageUrl: null,
      },
    });

    const eigen = await api("GET", `/api/bijlage/${f.huiswerkKlas}`, { token: c.leerlingA1.token });
    verwacht(
      "een leerling uit de klas kan de bijlage van zijn eigen huiswerk ophalen",
      eigen.status === 200,
      "HOOG",
      "200",
      kort(eigen, 120)
    );

    const vreemd = await api("GET", `/api/bijlage/${f.huiswerkKlas}`, { token: c.leerlingB1.token });
    verwacht(
      "een leerling van school B kan de bijlage NIET ophalen",
      vreemd.status >= 400,
      "KRITIEK",
      "403/404",
      kort(vreemd, 120)
    );

    const ouderVreemd = await api("GET", `/api/bijlage/${f.huiswerkKlas}`, { token: c.ouderA3.token });
    nooitServerfout("een ouder die de bijlage opvraagt krijgt geen serverfout", ouderVreemd, "MIDDEL");

    const zonder = await api("GET", `/api/bijlage/${f.huiswerkKlas}`);
    verwacht("zonder inloggen geen bijlage", zonder.status === 401, "KRITIEK", "401", kort(zonder, 120));

    const metRommelToken = await api("GET", `/api/bijlage/${f.huiswerkKlas}?token=onzin`);
    verwacht("met een onzin-token geen bijlage", metRommelToken.status === 401, "KRITIEK", "401", kort(metRommelToken, 120));

    await prisma.huiswerk.update({
      where: { id: f.huiswerkKlas },
      data: { bijlageNaam: null, bijlageType: null, bijlageData: null },
    });
  }

  groep("Studiemateriaal");

  let materiaal = "";
  {
    const a = await api("POST", "/api/studiemateriaal", {
      token: c.docentA1.token,
      body: { titel: "Stress materiaal", klasId: f.klasA1, vakId: f.vakA1 },
    });
    nooitServerfout("docent voegt studiemateriaal toe", a, "HOOG");
    materiaal = (a.body as { id?: string })?.id ?? "";
  }
  {
    const a = await api("POST", "/api/studiemateriaal", {
      token: c.docentA1.token,
      body: { titel: "Stress inbraak", klasId: f.klasB1 },
    });
    verwachtGeweigerd("docent A1 hangt geen materiaal aan een klas van school B", a);
  }
  {
    const a = await api("POST", "/api/studiemateriaal", {
      token: c.docentA1.token,
      body: { titel: "Stress inbraak", klasId: f.klasA2 },
    });
    verwachtGeweigerd("docent A1 hangt geen materiaal aan de klas van docent A2", a);
  }
  {
    const a = await api("POST", "/api/studiemateriaal", { token: c.docentA1.token, body: {} });
    verwachtValidatiefout("studiemateriaal zonder titel wordt geweigerd", a);
  }
  {
    const a = await api("POST", "/api/studiemateriaal", { token: c.docentA1.token, body: "{kapot" });
    verwachtValidatiefout("kapotte JSON bij studiemateriaal geeft geen crash", a, "HOOG");
  }
  for (const [rol, s] of [["leerling", c.leerlingA1], ["ouder", c.ouderA1], ["admin", c.adminA]] as const) {
    const a = await api("POST", "/api/studiemateriaal", { token: s.token, body: { titel: "Stress" } });
    verwachtGeweigerd(`${rol} voegt geen studiemateriaal toe`, a);
  }
  if (materiaal) {
    {
      const a = await api("DELETE", `/api/studiemateriaal?id=${materiaal}`, { token: c.docentA2.token });
      verwachtGeweigerd("een andere docent verwijdert dit materiaal niet", a);
    }
    {
      const a = await api("DELETE", `/api/studiemateriaal?id=${materiaal}`, { token: c.adminB.token });
      verwachtGeweigerd("een admin van school B verwijdert dit materiaal niet", a);
    }
    {
      const a = await api("DELETE", `/api/studiemateriaal?id=${materiaal}`, { token: c.docentA1.token });
      nooitServerfout("de eigen docent verwijdert het materiaal", a, "MIDDEL");
    }
  }
  {
    const a = await api("GET", "/api/studiemateriaal", { token: c.leerlingB1.token });
    verwacht(
      "een leerling van school B ziet geen materiaal van school A",
      !a.tekst.includes(f.klasA1),
      "KRITIEK",
      "niets van school A",
      kort(a, 200)
    );
  }

  groep("Leerlingdossier — gevoelige notities");

  let notitie = "";
  {
    const a = await api("POST", "/api/leerling-dossier", {
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingA1.id, titel: "Stress notitie", inhoud: "Vertrouwelijke observatie" },
    });
    nooitServerfout("docent maakt een dossiernotitie", a, "HOOG");
    notitie = (a.body as { id?: string })?.id ?? "";
  }
  {
    const a = await api("POST", "/api/leerling-dossier", {
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingB1.id, inhoud: "Stress inbraak" },
    });
    verwachtGeweigerd("docent A1 schrijft geen dossier over een leerling van school B", a);
  }
  {
    const a = await api("POST", "/api/leerling-dossier", {
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingA4.id, inhoud: "Stress inbraak" },
    });
    verwachtGeweigerd("docent A1 schrijft geen dossier over een leerling van een andere klas", a);
  }
  {
    const a = await api("POST", "/api/leerling-dossier", {
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingA1.id, inhoud: "   " },
    });
    verwachtValidatiefout("een lege notitie wordt geweigerd", a);
  }
  {
    const a = await api("POST", "/api/leerling-dossier", { token: c.docentA1.token, body: "{kapot" });
    verwachtValidatiefout("kapotte JSON bij dossier geeft geen crash", a, "HOOG");
  }
  for (const [rol, s] of [["leerling zelf", c.leerlingA1], ["ouder", c.ouderA1]] as const) {
    const a = await api("GET", `/api/leerling-dossier?leerlingId=${f.leerlingA1.id}`, { token: s.token });
    verwachtGeweigerd(`${rol} leest het dossier niet`, a);
  }
  {
    const a = await api("GET", `/api/leerling-dossier?leerlingId=${f.leerlingA1.id}`, { token: c.adminB.token });
    verwachtGeweigerd("een admin van school B leest het dossier niet", a);
  }
  if (notitie) {
    const a = await api("DELETE", `/api/leerling-dossier?id=${notitie}`, { token: c.docentA2.token });
    verwachtGeweigerd("een andere docent wist de notitie niet", a);
    await api("DELETE", `/api/leerling-dossier?id=${notitie}`, { token: c.docentA1.token });
  }

  groep("Zoeken naar leerlingen");

  const proef = await api("GET", "/api/search/leerling?q=aa", { token: c.adminA.token });
  const zoekenKan = proef.status < 500;
  if (!zoekenKan) {
    sla_over("zoeken naar leerlingen — de route zoekt case-insensitive; dat kan SQLite lokaal niet (op Postgres werkt het wel)");
  }

  if (zoekenKan) {
    const a = await api("GET", `/api/search/leerling?q=${encodeURIComponent(f.leerlingB1.naam.slice(0, 4))}`, {
      token: c.adminA.token,
    });
    verwacht(
      "admin A vindt geen leerlingen van school B",
      !a.tekst.includes(f.leerlingB1.id),
      "KRITIEK",
      "niets van school B",
      kort(a, 200)
    );
  }
  {
    const a = await api("GET", `/api/search/leerling?q=${encodeURIComponent(f.leerlingA4.naam.slice(0, 4))}`, {
      token: c.docentA1.token,
    });
    if (a.status < 500) {
      verwacht(
        "docent A1 vindt geen leerling uit de klas van docent A2",
        !a.tekst.includes(f.leerlingA4.id),
        "KRITIEK",
        "niet gevonden",
        kort(a, 200)
      );
    }
  }
  for (const [rol, se] of [["leerling", c.leerlingA1], ["ouder", c.ouderA1]] as const) {
    const a = await api("GET", "/api/search/leerling?q=aa", { token: se.token });
    verwachtGeweigerd(`${rol} mag niet zoeken in de leerlingenlijst`, a);
  }
  if (zoekenKan) {
    for (const g of GEMENE_STRINGS) {
      const a = await api("GET", `/api/search/leerling?q=${encodeURIComponent(g.waarde.slice(0, 500))}`, {
        token: c.adminA.token,
      });
      nooitServerfout(`zoeken op "${g.label}" geeft geen serverfout`, a, "HOOG");
    }
  }

  groep("Statistieken en dashboards");

  for (const pad of [
    "/api/admin/statistieken",
    "/api/docent/statistieken",
    "/api/leerling/dashboard",
    "/api/leerling/ranking",
    "/api/admin/berichten-data",
    "/api/leerling/contacten",
    "/api/ouder/contacten",
  ]) {
    for (const [rol, s] of [
      ["admin", c.adminA],
      ["docent", c.docentA1],
      ["leerling", c.leerlingA1],
      ["ouder", c.ouderA1],
    ] as const) {
      const a = await api("GET", pad, { token: s.token });
      nooitServerfout(`${rol} op ${pad} geeft geen serverfout`, a, "HOOG");
      if (a.status === 200) {
        verwacht(
          `${rol} ziet op ${pad} niets van school B`,
          !a.tekst.includes(f.leerlingB1.id) && !a.tekst.includes(f.klasB1),
          "KRITIEK",
          "niets van school B",
          kort(a, 200)
        );
      }
    }
    const zonder = await api("GET", pad);
    verwacht(`${pad} weigert zonder inloggen`, zonder.status === 401 || zonder.status === 403, "KRITIEK", "401/403", kort(zonder, 120));
  }

  groep("Dev-console zonder sleutel");

  for (const [methode, pad] of [
    ["GET", "/api/dev/scholen"],
    ["POST", "/api/dev/scholen"],
    ["GET", `/api/dev/scholen/${f.schoolA.id}`],
    ["POST", `/api/dev/scholen/${f.schoolA.id}/accounts`],
    ["GET", `/api/dev/scholen/${f.schoolA.id}/inloggegevens`],
    ["POST", `/api/dev/scholen/${f.schoolA.id}/inloggegevens`],
    ["POST", `/api/dev/scholen/${f.schoolA.id}/import`],
    ["DELETE", `/api/dev/scholen/${f.schoolA.id}`],
  ] as const) {
    const zonder = await api(methode, pad, { body: methode === "GET" ? undefined : {} });
    verwacht(`${methode} ${pad} weigert zonder dev-cookie`, zonder.status === 401 || zonder.status === 403, "KRITIEK", "401/403", kort(zonder, 120));
    const metAdmin = await api(methode, pad, { token: c.adminA.token, body: methode === "GET" ? undefined : {} });
    verwacht(`${methode} ${pad} weigert een gewone schoolbeheerder`, metAdmin.status === 401 || metAdmin.status === 403, "KRITIEK", "401/403", kort(metAdmin, 120));
  }

  {
    await prisma.studieMateriaal.deleteMany({ where: { titel: { startsWith: "Stress" } } });
    await prisma.leerlingDossier.deleteMany({ where: { inhoud: { contains: "Stress" } } });
    await prisma.leerlingDossier.deleteMany({ where: { titel: { startsWith: "Stress" } } });
  }
}
