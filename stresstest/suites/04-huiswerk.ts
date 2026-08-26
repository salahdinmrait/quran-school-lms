import { api, groep, verwacht, verwachtGeweigerd, verwachtStatus, verwachtValidatiefout, nooitServerfout, kort, GEMENE_STRINGS } from "../lib";
import { prisma } from "../fixture";
import type { Ctx } from "../context";

export const naam = "Huiswerk: aanmaken, richten, zien en verwijderen";

interface HuiswerkItem {
  id: string;
  titel: string;
}

export async function draai(c: Ctx) {
  const f = c.f;

  groep("Huiswerk aanmaken — verplichte velden");

  const gevallen: { naam: string; body: unknown }[] = [
    { naam: "zonder titel", body: { vakId: f.vakA1, lesId: f.lesA1Toekomst } },
    { naam: "met lege titel", body: { titel: "", vakId: f.vakA1, lesId: f.lesA1Toekomst } },
    { naam: "zonder vakId", body: { titel: "Test", lesId: f.lesA1Toekomst } },
    { naam: "zonder lesId", body: { titel: "Test", vakId: f.vakA1 } },
    { naam: "met lesId van een andere klas", body: { titel: "Test", vakId: f.vakA1, lesId: f.lesA2 } },
    { naam: "met lesId van een andere school", body: { titel: "Test", vakId: f.vakA1, lesId: f.lesB1 } },
    { naam: "met een vak dat niet bij de klas hoort", body: { titel: "Test", vakId: f.vakA2, lesId: f.lesA1Toekomst } },
    { naam: "met een vak van een andere school", body: { titel: "Test", vakId: f.vakB1, lesId: f.lesA1Toekomst } },
    { naam: "met onzin-id's", body: { titel: "Test", vakId: "bestaatniet", lesId: "bestaatookniet" } },
    { naam: "met null-waarden", body: { titel: null, vakId: null, lesId: null } },
    { naam: "met arrays in plaats van id's", body: { titel: ["a"], vakId: [f.vakA1], lesId: [f.lesA1Toekomst] } },
    {
      naam: "gericht op een leerling uit een andere klas",
      body: { titel: "Test", vakId: f.vakA1, lesId: f.lesA1Toekomst, leerlingIds: [f.leerlingA4.id] },
    },
    {
      naam: "gericht op een leerling van een andere school",
      body: { titel: "Test", vakId: f.vakA1, lesId: f.lesA1Toekomst, leerlingIds: [f.leerlingB1.id] },
    },
    {
      naam: "gericht op een docent in plaats van een leerling",
      body: { titel: "Test", vakId: f.vakA1, lesId: f.lesA1Toekomst, leerlingIds: [f.docentA2.id] },
    },
  ];

  for (const g of gevallen) {
    const a = await api("POST", "/api/docent/huiswerk", { token: c.docentA1.token, body: g.body });
    verwachtValidatiefout(`huiswerk ${g.naam} wordt geweigerd`, a, "HOOG");
  }

  {
    const a = await api("POST", "/api/docent/huiswerk", { token: c.docentA1.token, body: "{kapot" });
    verwachtValidatiefout("kapotte JSON bij huiswerk geeft geen crash", a, "HOOG");
  }

  groep("Huiswerk aanmaken — wie mag het");

  for (const [rol, s] of [
    ["leerling", c.leerlingA1],
    ["ouder", c.ouderA1],
    ["admin", c.adminA],
  ] as const) {
    const a = await api("POST", "/api/docent/huiswerk", {
      token: s.token,
      body: { titel: "Mag niet", vakId: f.vakA1, lesId: f.lesA1Toekomst },
    });
    verwachtGeweigerd(`${rol} maakt geen huiswerk aan`, a);
  }
  {
    const a = await api("POST", "/api/docent/huiswerk", {
      token: c.docentA2.token,
      body: { titel: "Andermans les", vakId: f.vakA1, lesId: f.lesA1Toekomst },
    });
    verwachtGeweigerd("docent A2 maakt geen huiswerk bij de les van docent A1", a);
  }

  groep("Huiswerk aanmaken — geldig");

  let nieuwKlasBreed = "";
  let nieuwGericht = "";
  {
    const a = await api("POST", "/api/docent/huiswerk", {
      token: c.docentA1.token,
      body: { titel: "Stress klasbreed", beschrijving: "Voor iedereen", vakId: f.vakA1, lesId: f.lesA1Toekomst },
    });
    verwachtStatus("klasbreed huiswerk aanmaken lukt", a, [200, 201], "KRITIEK");
    nieuwKlasBreed = (a.body as { id?: string })?.id ?? "";
  }
  {
    const a = await api("POST", "/api/docent/huiswerk", {
      token: c.docentA1.token,
      body: {
        titel: "Stress gericht op A2",
        vakId: f.vakA1,
        lesId: f.lesA1Toekomst,
        leerlingIds: [f.leerlingA2.id],
      },
    });
    verwachtStatus("gericht huiswerk aanmaken lukt", a, [200, 201], "KRITIEK");
    nieuwGericht = (a.body as { id?: string })?.id ?? "";
  }
  {
    const aantal = await prisma.huiswerkLeerling.count({ where: { huiswerkId: nieuwGericht } });
    verwacht(
      "gericht huiswerk krijgt precies één koppeling",
      aantal === 1,
      "HOOG",
      "1 koppeling",
      String(aantal)
    );
  }
  {
    // Dezelfde leerling twee keer in de lijst mag geen unique-fout geven
    const a = await api("POST", "/api/docent/huiswerk", {
      token: c.docentA1.token,
      body: {
        titel: "Stress dubbele doelleerling",
        vakId: f.vakA1,
        lesId: f.lesA1Toekomst,
        leerlingIds: [f.leerlingA2.id, f.leerlingA2.id],
      },
    });
    nooitServerfout("dezelfde leerling dubbel in de doellijst geeft geen crash", a);
  }

  groep("Zichtbaarheid van gericht huiswerk");

  {
    const a = await api("GET", "/api/leerling/huiswerk", { token: c.leerlingA1.token });
    verwacht(
      "leerling A1 ziet het huiswerk dat op hem gericht is",
      a.tekst.includes(f.huiswerkGericht),
      "HOOG",
      "gericht huiswerk zichtbaar",
      kort(a, 200)
    );
    verwacht(
      "leerling A1 ziet klasbreed huiswerk",
      a.tekst.includes(f.huiswerkKlas),
      "HOOG",
      "klasbreed huiswerk zichtbaar",
      kort(a, 200)
    );
    verwacht(
      "leerling A1 ziet NIET het huiswerk dat op A2 gericht is",
      !a.tekst.includes(nieuwGericht),
      "KRITIEK",
      "huiswerk van een ander niet zichtbaar",
      kort(a, 200)
    );
    verwacht(
      "leerling A1 ziet geen huiswerk van klas A2",
      !a.tekst.includes(f.huiswerkA2),
      "KRITIEK",
      "huiswerk van een andere klas niet zichtbaar",
      kort(a, 200)
    );
  }
  {
    const a = await api("GET", "/api/leerling/huiswerk", { token: c.leerlingA2.token });
    verwacht(
      "leerling A2 ziet NIET het huiswerk dat op A1 gericht is",
      !a.tekst.includes(f.huiswerkGericht),
      "KRITIEK",
      "huiswerk van een ander niet zichtbaar",
      kort(a, 200)
    );
  }
  {
    const a = await api("GET", "/api/leerling/huiswerk", { token: c.leerlingB1.token });
    verwacht(
      "leerling van school B ziet niets van school A",
      !a.tekst.includes(f.huiswerkKlas) && !a.tekst.includes(f.huiswerkGericht),
      "KRITIEK",
      "geen huiswerk van de andere school",
      kort(a, 200)
    );
  }
  {
    // Dit is precies de bug uit het plan: ouder A3 mag het gerichte huiswerk
    // van leerling A1 niet zien.
    const a = await api("GET", "/api/ouder/huiswerk", { token: c.ouderA3.token });
    verwacht(
      "ouder van A3 ziet niet het huiswerk dat op A1 gericht is",
      !a.tekst.includes(f.huiswerkGericht),
      "KRITIEK",
      "gericht huiswerk van een ander kind niet zichtbaar",
      kort(a, 300)
    );
    verwacht(
      "ouder van A3 ziet wel het klasbrede huiswerk van zijn eigen kind",
      a.tekst.includes(f.huiswerkKlas),
      "HOOG",
      "klasbreed huiswerk zichtbaar",
      kort(a, 300)
    );
  }
  {
    const a = await api("GET", "/api/ouder/huiswerk", { token: c.ouderA1.token });
    verwacht(
      "ouder van A1 ziet wél het gerichte huiswerk van zijn eigen kind",
      a.tekst.includes(f.huiswerkGericht),
      "HOOG",
      "gericht huiswerk zichtbaar",
      kort(a, 300)
    );
  }

  groep("Afvinken door de docent");

  {
    const a = await api("POST", "/api/docent/huiswerk/afvinken", {
      token: c.docentA1.token,
      body: { huiswerkId: nieuwKlasBreed, leerlingId: f.leerlingA1.id },
    });
    verwachtStatus("docent vinkt huiswerk af", a, [200, 201], "HOOG");
  }
  {
    const a = await api("POST", "/api/docent/huiswerk/afvinken", {
      token: c.docentA1.token,
      body: { huiswerkId: nieuwKlasBreed, leerlingId: f.leerlingA1.id },
    });
    nooitServerfout("twee keer afvinken geeft geen unique-fout", a, "HOOG");
  }
  {
    const aantal = await prisma.inlevering.count({
      where: { huiswerkId: nieuwKlasBreed, leerlingId: f.leerlingA1.id },
    });
    verwacht(
      "twee keer afvinken levert één inlevering op",
      aantal === 1,
      "HOOG",
      "1 inlevering",
      String(aantal)
    );
  }
  {
    const a = await api("POST", "/api/docent/huiswerk/afvinken", {
      token: c.docentB1.token,
      body: { huiswerkId: nieuwKlasBreed, leerlingId: f.leerlingA1.id },
    });
    verwachtGeweigerd("docent van school B vinkt niets af bij school A", a);
  }
  {
    const a = await api("POST", "/api/docent/huiswerk/afvinken", {
      token: c.docentA1.token,
      body: { huiswerkId: nieuwKlasBreed, leerlingId: f.leerlingA4.id },
    });
    verwachtGeweigerd("docent vinkt geen leerling af die niet in de klas zit", a, "HOOG");
  }
  {
    const a = await api("POST", "/api/docent/huiswerk/afvinken", {
      token: c.leerlingA1.token,
      body: { huiswerkId: nieuwKlasBreed, leerlingId: f.leerlingA1.id },
    });
    verwachtGeweigerd("leerling vinkt zichzelf niet af", a);
  }
  {
    const a = await api("DELETE", "/api/docent/huiswerk/afvinken", {
      token: c.docentA1.token,
      body: { huiswerkId: nieuwKlasBreed, leerlingId: f.leerlingA1.id },
    });
    nooitServerfout("afvinken ongedaan maken werkt", a, "MIDDEL");
    const a2 = await api("DELETE", "/api/docent/huiswerk/afvinken", {
      token: c.docentA1.token,
      body: { huiswerkId: nieuwKlasBreed, leerlingId: f.leerlingA1.id },
    });
    nooitServerfout("twee keer ontvinken geeft geen crash", a2, "MIDDEL");
  }

  groep("Huiswerk verwijderen — geen wezen achterlaten");

  {
    // Eerst nog wat afhankelijke records eraan hangen
    await api("POST", "/api/docent/huiswerk/afvinken", {
      token: c.docentA1.token,
      body: { huiswerkId: nieuwGericht, leerlingId: f.leerlingA2.id },
    });

    const a = await api("DELETE", `/api/docent/huiswerk/${nieuwGericht}`, { token: c.docentA1.token });
    verwachtStatus("docent verwijdert eigen huiswerk", a, [200, 204], "HOOG");

    const [hw, koppel, inlev] = await Promise.all([
      prisma.huiswerk.count({ where: { id: nieuwGericht } }),
      prisma.huiswerkLeerling.count({ where: { huiswerkId: nieuwGericht } }),
      prisma.inlevering.count({ where: { huiswerkId: nieuwGericht } }),
    ]);
    verwacht("het huiswerk is weg", hw === 0, "HOOG", "0", String(hw));
    verwacht(
      "geen HuiswerkLeerling-wezen achtergebleven",
      koppel === 0,
      "HOOG",
      "0 koppelingen",
      String(koppel)
    );
    verwacht(
      "geen Inlevering-wezen achtergebleven",
      inlev === 0,
      "HOOG",
      "0 inleveringen",
      String(inlev)
    );
  }
  {
    const a = await api("DELETE", `/api/docent/huiswerk/${nieuwGericht}`, { token: c.docentA1.token });
    verwacht(
      "hetzelfde huiswerk nog eens verwijderen geeft een nette fout",
      a.status >= 400 && a.status < 500,
      "MIDDEL",
      "404",
      kort(a)
    );
  }
  {
    const a = await api("DELETE", "/api/docent/huiswerk/bestaatniet", { token: c.docentA1.token });
    nooitServerfout("onbekend huiswerk-id verwijderen geeft geen crash", a);
  }
  {
    const a = await api("GET", "/api/leerling/huiswerk", { token: c.leerlingA2.token });
    verwacht(
      "verwijderd huiswerk is meteen weg bij de leerling",
      !a.tekst.includes(nieuwGericht),
      "HOOG",
      "niet meer zichtbaar",
      kort(a, 200)
    );
  }

  groep("Gemene tekst in een huiswerktitel");

  for (const g of GEMENE_STRINGS) {
    const a = await api("POST", "/api/docent/huiswerk", {
      token: c.docentA1.token,
      body: {
        titel: g.waarde,
        beschrijving: g.waarde,
        vakId: f.vakA1,
        lesId: f.lesA1Toekomst,
      },
    });
    // Leeg of alleen spaties hoort geweigerd te worden; de rest mag of moet,
    // als er maar geen 5xx uitkomt.
    nooitServerfout(`titel "${g.label}" laat de server niet vallen`, a);
  }
  {
    // Alles wat we zojuist gemaakt hebben weer weg
    const rommel = await prisma.huiswerk.findMany({
      where: { lesId: f.lesA1Toekomst, titel: { startsWith: "Stress" } },
      select: { id: true },
    });
    const ids = rommel.map((r) => r.id);
    await prisma.inlevering.deleteMany({ where: { huiswerkId: { in: ids } } });
    await prisma.huiswerkLeerling.deleteMany({ where: { huiswerkId: { in: ids } } });
    await prisma.huiswerk.deleteMany({ where: { id: { in: ids } } });
  }

  void ((): HuiswerkItem[] => [])();
}
