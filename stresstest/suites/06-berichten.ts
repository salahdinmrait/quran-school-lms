import { api, groep, verwacht, verwachtGeweigerd, verwachtStatus, verwachtValidatiefout, nooitServerfout, kort, GEMENE_STRINGS } from "../lib";
import { prisma } from "../fixture";
import type { Ctx } from "../context";

export const naam = "Berichten sturen en lezen";

export async function draai(c: Ctx) {
  const f = c.f;

  groep("Bericht sturen — verplichte velden");

  const kapot: { naam: string; body: unknown }[] = [
    { naam: "zonder onderwerp", body: { inhoud: "hoi", doelType: "GEBRUIKERS", doelIds: [f.leerlingA1.id] } },
    { naam: "zonder inhoud", body: { onderwerp: "hoi", doelType: "GEBRUIKERS", doelIds: [f.leerlingA1.id] } },
    { naam: "zonder doelType", body: { onderwerp: "hoi", inhoud: "hoi", doelIds: [f.leerlingA1.id] } },
    { naam: "met onbekend doelType", body: { onderwerp: "hoi", inhoud: "hoi", doelType: "IEDEREEN" } },
    { naam: "met een lege ontvangerslijst", body: { onderwerp: "hoi", inhoud: "hoi", doelType: "GEBRUIKERS", doelIds: [] } },
    { naam: "met alleen onbekende ontvangers", body: { onderwerp: "hoi", inhoud: "hoi", doelType: "GEBRUIKERS", doelIds: ["bestaatniet"] } },
    { naam: "met een string in plaats van een lijst", body: { onderwerp: "hoi", inhoud: "hoi", doelType: "GEBRUIKERS", doelIds: "bestaatniet" } },
    { naam: "naar een klas die niet bestaat", body: { onderwerp: "hoi", inhoud: "hoi", doelType: "KLAS_LEERLINGEN", doelId: "bestaatniet" } },
    { naam: "naar een klas zonder doelId", body: { onderwerp: "hoi", inhoud: "hoi", doelType: "KLAS_LEERLINGEN" } },
  ];
  for (const k of kapot) {
    const a = await api("POST", "/api/berichten", { token: c.docentA1.token, body: k.body });
    verwachtValidatiefout(`bericht ${k.naam} wordt geweigerd`, a, "HOOG");
  }
  {
    const a = await api("POST", "/api/berichten", { token: c.docentA1.token, body: "{kapot" });
    verwachtValidatiefout("kapotte JSON bij berichten geeft geen crash", a, "HOOG");
  }

  groep("Bericht sturen — over de schoolgrens");

  {
    const a = await api("POST", "/api/berichten", {
      token: c.docentA1.token,
      body: { onderwerp: "Stress", inhoud: "over de grens", doelType: "GEBRUIKERS", doelIds: [f.leerlingB1.id] },
    });
    verwacht(
      "docent A1 stuurt niets naar een leerling van school B",
      a.status >= 400,
      "KRITIEK",
      "4xx",
      kort(a, 200)
    );
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.docentA1.token,
      body: { onderwerp: "Stress", inhoud: "over de grens", doelType: "KLAS_LEERLINGEN", doelId: f.klasB1 },
    });
    verwachtGeweigerd("docent A1 mailt klas B1 niet", a);
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.docentA2.token,
      body: { onderwerp: "Stress", inhoud: "andermans klas", doelType: "KLAS_LEERLINGEN", doelId: f.klasA1 },
    });
    verwachtGeweigerd("docent A2 mailt klas A1 niet (niet zijn klas)", a);
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.docentA1.token,
      body: { onderwerp: "Stress", inhoud: "mengsel", doelType: "GEBRUIKERS", doelIds: [f.leerlingA1.id, f.leerlingB1.id] },
    });
    if (a.status < 300) {
      const naarB = await prisma.bericht.count({
        where: { verzenderId: f.docentA1.id, ontvangerId: f.leerlingB1.id },
      });
      verwacht(
        "een gemengde lijst levert geen bericht bij school B",
        naarB === 0,
        "KRITIEK",
        "0 berichten naar school B",
        String(naarB)
      );
    } else {
      verwacht("een gemengde lijst wordt geweigerd of gefilterd", true, "LAAG", "4xx of gefilterd", kort(a));
    }
  }

  groep("Bericht sturen — wat een leerling en ouder mogen");

  {
    const a = await api("POST", "/api/berichten", {
      token: c.leerlingA1.token,
      body: { onderwerp: "Stress", inhoud: "vraag", doelType: "GEBRUIKERS", doelIds: [f.docentA1.id] },
    });
    verwachtStatus("leerling mag zijn eigen docent aanschrijven", a, [200, 201], "HOOG");
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.leerlingA1.token,
      body: { onderwerp: "Stress", inhoud: "vraag", doelType: "ADMINS" },
    });
    verwachtStatus("leerling mag het beheer aanschrijven", a, [200, 201], "MIDDEL");
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.leerlingA1.token,
      body: { onderwerp: "Stress", inhoud: "hoi", doelType: "GEBRUIKERS", doelIds: [f.leerlingA2.id] },
    });
    verwachtGeweigerd("leerling schrijft geen medeleerling aan", a);
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.leerlingA1.token,
      body: { onderwerp: "Stress", inhoud: "hoi", doelType: "GEBRUIKERS", doelIds: [f.docentA2.id] },
    });
    verwachtGeweigerd("leerling schrijft geen docent van een andere klas aan", a);
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.leerlingA1.token,
      body: { onderwerp: "Stress", inhoud: "hoi", doelType: "GEBRUIKERS", doelIds: [f.ouderA3.id] },
    });
    verwachtGeweigerd("leerling schrijft geen andere ouder aan", a);
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.leerlingA1.token,
      body: { onderwerp: "Stress", inhoud: "hoi", doelType: "KLAS_LEERLINGEN", doelId: f.klasA1 },
    });
    verwachtGeweigerd("leerling stuurt geen groepsbericht naar de klas", a);
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.leerlingA1.token,
      body: { onderwerp: "Stress", inhoud: "hoi", doelType: "KLAS_OUDERS", doelId: f.klasA1 },
    });
    verwachtGeweigerd("leerling stuurt geen groepsbericht naar de ouders", a);
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.ouderA1.token,
      body: { onderwerp: "Stress", inhoud: "hoi", doelType: "GEBRUIKERS", doelIds: [f.docentA1.id] },
    });
    verwacht(
      "ouder gebruikt zijn eigen route, niet /api/berichten",
      a.status === 403 || (a.status >= 200 && a.status < 300),
      "MIDDEL",
      "403 (eigen route) of 2xx",
      kort(a, 200)
    );
  }
  {
    const a = await api("POST", "/api/ouder/berichten", {
      token: c.ouderA1.token,
      body: { onderwerp: "Stress", inhoud: "hoi", ontvangerIds: [f.docentA2.id] },
    });
    verwachtGeweigerd("ouder schrijft geen docent aan die zijn kind niet lesgeeft", a);
  }
  {
    const a = await api("POST", "/api/ouder/berichten", {
      token: c.ouderA1.token,
      body: { onderwerp: "Stress", inhoud: "hoi", ontvangerIds: [f.ouderA3.id] },
    });
    verwachtGeweigerd("ouder schrijft geen andere ouder aan", a);
  }

  groep("Bericht sturen — naar jezelf en naar niemand");

  {
    const a = await api("POST", "/api/berichten", {
      token: c.docentA1.token,
      body: { onderwerp: "Stress", inhoud: "aan mezelf", doelType: "GEBRUIKERS", doelIds: [f.docentA1.id] },
    });
    verwachtValidatiefout("een bericht aan jezelf wordt geweigerd", a, "LAAG");
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.adminA.token,
      body: { onderwerp: "Stress", inhoud: "leeg", doelType: "KLAS_LEERLINGEN", doelId: f.klasA2 },
    });
    // Klas A2 heeft één leerling; dit hoort gewoon te lukken.
    verwachtStatus("groepsbericht naar een kleine klas lukt", a, [200, 201], "MIDDEL");
  }

  groep("Groepsberichten — één per ontvanger");

  {
    const voor = await prisma.bericht.count({ where: { onderwerp: "Stress groep" } });
    const a = await api("POST", "/api/berichten", {
      token: c.docentA1.token,
      body: { onderwerp: "Stress groep", inhoud: "aan de klas", doelType: "KLAS_LEERLINGEN", doelId: f.klasA1 },
    });
    const na = await prisma.bericht.count({ where: { onderwerp: "Stress groep" } });
    verwacht(
      "klasbericht komt bij alle drie de leerlingen aan",
      a.status < 300 && na - voor === 3,
      "HOOG",
      "3 nieuwe berichten",
      `${na - voor} nieuw, antwoord: ${kort(a, 120)}`
    );
    const metGroep = await prisma.bericht.findMany({ where: { onderwerp: "Stress groep" }, select: { groepId: true } });
    verwacht(
      "alle drie krijgen hetzelfde groepId",
      new Set(metGroep.map((b) => b.groepId)).size === 1 && metGroep[0]?.groepId !== null,
      "MIDDEL",
      "één gedeeld groepId",
      JSON.stringify(Array.from(new Set(metGroep.map((b) => b.groepId))))
    );
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.docentA1.token,
      body: { onderwerp: "Stress ouders", inhoud: "aan de ouders", doelType: "KLAS_OUDERS", doelId: f.klasA1 },
    });
    const naarOuders = await prisma.bericht.count({ where: { onderwerp: "Stress ouders" } });
    verwacht(
      "oudersbericht gaat alleen naar de twee gekoppelde ouders",
      a.status < 300 && naarOuders === 2,
      "HOOG",
      "2 berichten",
      `${naarOuders}, antwoord: ${kort(a, 120)}`
    );
  }

  groep("Inhoud van een bericht");

  for (const g of GEMENE_STRINGS) {
    const a = await api("POST", "/api/berichten", {
      token: c.docentA1.token,
      body: {
        onderwerp: `Stress fuzz ${g.label}`,
        inhoud: g.waarde,
        doelType: "GEBRUIKERS",
        doelIds: [f.leerlingA1.id],
      },
    });
    nooitServerfout(`inhoud "${g.label}" laat de server niet vallen`, a);
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.docentA1.token,
      body: {
        onderwerp: "Stress groot",
        inhoud: "X".repeat(2_000_000),
        doelType: "GEBRUIKERS",
        doelIds: [f.leerlingA1.id],
      },
    });
    nooitServerfout("een bericht van 2 MB laat de server niet vallen", a, "MIDDEL");
  }
  {
    const a = await api("POST", "/api/berichten", {
      token: c.docentA1.token,
      body: {
        onderwerp: "Stress bijlage",
        inhoud: "met bijlage",
        doelType: "GEBRUIKERS",
        doelIds: [f.leerlingA1.id],
        bijlageNaam: "../../etc/passwd",
        bijlageData: Buffer.from("hallo").toString("base64"),
        bijlageType: "text/plain",
      },
    });
    nooitServerfout("pad-traversal in een bijlagenaam geeft geen crash", a);
  }

  groep("Berichten lezen");

  {
    const a = await api("GET", "/api/berichten", { token: c.leerlingA2.token });
    verwacht(
      "leerling A2 ziet het bericht aan A1 niet in zijn inbox",
      !a.tekst.includes(f.berichtAanA1),
      "KRITIEK",
      "andermans bericht niet zichtbaar",
      kort(a, 200)
    );
  }
  {
    const a = await api("GET", "/api/berichten", { token: c.leerlingB1.token });
    verwacht(
      "leerling van school B ziet niets van school A",
      !a.tekst.includes(f.berichtAanA1),
      "KRITIEK",
      "niets van de andere school",
      kort(a, 200)
    );
  }
  {
    const a = await api("PUT", `/api/berichten/${f.berichtAanA1}`, {
      token: c.leerlingA2.token,
      body: { gelezen: true },
    });
    verwachtGeweigerd("leerling A2 markeert andermans bericht niet als gelezen", a);
  }
  {
    const a = await api("DELETE", `/api/berichten/${f.berichtAanA1}`, { token: c.leerlingA2.token });
    verwachtGeweigerd("leerling A2 verwijdert andermans bericht niet", a);
  }
  {
    // Reageren op een gesprek waar je niet bij hoort
    const a = await api("POST", "/api/berichten", {
      token: c.leerlingA2.token,
      body: {
        onderwerp: "Stress inbraak",
        inhoud: "ik reageer op andermans gesprek",
        doelType: "GEBRUIKERS",
        doelIds: [f.docentA1.id],
        replyToId: f.berichtAanA1,
      },
    });
    if (a.status < 300) {
      const bericht = await prisma.bericht.findFirst({
        where: { onderwerp: "Stress inbraak" },
        select: { replyToId: true },
      });
      verwacht(
        "reageren op een gesprek van een ander koppelt niet aan dat gesprek",
        bericht?.replyToId !== f.berichtAanA1,
        "HOOG",
        "geen koppeling aan andermans bericht",
        `replyToId = ${bericht?.replyToId}`
      );
    } else {
      verwacht("reageren op andermans gesprek wordt geweigerd", true, "LAAG", "4xx", kort(a));
    }
  }

  {
    // Replies eerst losmaken, anders blokkeert de self-relatie het opruimen.
    await prisma.bericht.updateMany({
      where: { replyTo: { onderwerp: { startsWith: "Stress" } } },
      data: { replyToId: null },
    });
    await prisma.bericht.deleteMany({ where: { onderwerp: { startsWith: "Stress" } } });
  }
}
