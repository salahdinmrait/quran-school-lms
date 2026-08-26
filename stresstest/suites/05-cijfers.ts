import { api, groep, verwacht, verwachtGeweigerd, verwachtStatus, verwachtValidatiefout, nooitServerfout, kort, GEMENE_GETALLEN } from "../lib";
import { prisma } from "../fixture";
import type { Ctx } from "../context";

export const naam = "Cijfers: geven, zien en corrigeren";

export async function draai(c: Ctx) {
  const f = c.f;

  groep("Cijfer geven — waardebereik");

  const geldig = [1, 5.5, 10, "7,5".replace(",", "."), "8"];
  for (const w of geldig) {
    const a = await api("POST", "/api/docent/cijfers", {
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingA1.id, vakId: f.vakA1, waarde: w, omschrijving: "Stress geldig" },
    });
    verwachtStatus(`waarde ${JSON.stringify(w)} wordt geaccepteerd`, a, [200, 201], "HOOG");
  }

  for (const g of GEMENE_GETALLEN) {
    const a = await api("POST", "/api/docent/cijfers", {
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingA1.id, vakId: f.vakA1, waarde: g.waarde, omschrijving: "Stress ongeldig" },
    });
    verwachtValidatiefout(`waarde "${g.label}" wordt geweigerd`, a, "HOOG");
  }
  {
    const a = await api("POST", "/api/docent/cijfers", {
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingA1.id, vakId: f.vakA1, waarde: 10.0001, omschrijving: "Stress ongeldig" },
    });
    verwachtValidatiefout("net boven de 10 wordt geweigerd", a, "MIDDEL");
  }
  {
    const a = await api("POST", "/api/docent/cijfers", {
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingA1.id, vakId: f.vakA1, waarde: 0.9999, omschrijving: "Stress ongeldig" },
    });
    verwachtValidatiefout("net onder de 1 wordt geweigerd", a, "MIDDEL");
  }
  {
    const a = await api("POST", "/api/docent/cijfers", {
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingA1.id, vakId: f.vakA1 },
    });
    verwachtValidatiefout("cijfer zonder waarde wordt geweigerd", a);
  }
  {
    const a = await api("POST", "/api/docent/cijfers", { token: c.docentA1.token, body: "{kapot" });
    verwachtValidatiefout("kapotte JSON bij cijfers geeft geen crash", a, "HOOG");
  }

  groep("Cijfer geven — aan wie, voor welk vak");

  const misbruik: { naam: string; body: unknown; token: string }[] = [
    {
      naam: "docent A1 geeft een cijfer aan een leerling uit klas A2",
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingA4.id, vakId: f.vakA1, waarde: 9 },
    },
    {
      naam: "docent A1 geeft een cijfer voor een vak dat hij niet geeft",
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingA1.id, vakId: f.vakA2, waarde: 9 },
    },
    {
      naam: "docent A1 geeft een cijfer aan een leerling van school B",
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingB1.id, vakId: f.vakA1, waarde: 9 },
    },
    {
      naam: "docent A1 geeft een cijfer voor een vak van school B",
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingA1.id, vakId: f.vakB1, waarde: 9 },
    },
    {
      naam: "docent geeft een cijfer aan een docent",
      token: c.docentA1.token,
      body: { leerlingId: f.docentA2.id, vakId: f.vakA1, waarde: 9 },
    },
    {
      naam: "docent geeft een cijfer aan een ouder",
      token: c.docentA1.token,
      body: { leerlingId: f.ouderA1.id, vakId: f.vakA1, waarde: 9 },
    },
    {
      naam: "cijfer met een onbekend leerling-id",
      token: c.docentA1.token,
      body: { leerlingId: "bestaatniet", vakId: f.vakA1, waarde: 9 },
    },
    {
      naam: "cijfer met een onbekend vak-id",
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingA1.id, vakId: "bestaatniet", waarde: 9 },
    },
  ];

  for (const m of misbruik) {
    const a = await api("POST", "/api/docent/cijfers", { token: m.token, body: m.body });
    verwacht(
      `${m.naam} wordt geweigerd`,
      a.status >= 400 && a.status < 500,
      "KRITIEK",
      "4xx",
      kort(a, 200)
    );
  }

  for (const [rol, s] of [
    ["leerling", c.leerlingA1],
    ["ouder", c.ouderA1],
    ["admin", c.adminA],
  ] as const) {
    const a = await api("POST", "/api/docent/cijfers", {
      token: s.token,
      body: { leerlingId: f.leerlingA1.id, vakId: f.vakA1, waarde: 10 },
    });
    verwachtGeweigerd(`${rol} geeft zelf geen cijfers`, a);
  }

  groep("Cijfers zien");

  {
    const a = await api("GET", "/api/leerling/cijfers", { token: c.leerlingA1.token });
    verwacht(
      "leerling A1 ziet zijn eigen cijfer",
      a.tekst.includes(f.cijferA1),
      "HOOG",
      "eigen cijfer zichtbaar",
      kort(a, 200)
    );
  }
  {
    const a = await api("GET", "/api/leerling/cijfers", { token: c.leerlingA2.token });
    verwacht(
      "leerling A2 ziet het cijfer van A1 niet",
      !a.tekst.includes(f.cijferA1),
      "KRITIEK",
      "cijfer van een ander niet zichtbaar",
      kort(a, 200)
    );
  }
  {
    const a = await api("GET", "/api/ouder/kind", { token: c.ouderA3.token });
    verwacht(
      "ouder van A3 ziet het cijfer van A1 niet",
      !a.tekst.includes(f.cijferA1),
      "KRITIEK",
      "cijfer van een ander kind niet zichtbaar",
      kort(a, 300)
    );
  }
  {
    const a = await api("GET", "/api/klassen/" + f.klasA1 + "/ranking", { token: c.leerlingB1.token });
    verwachtGeweigerd("leerling van school B ziet de ranking van klas A1 niet", a);
  }

  groep("Cijfer wijzigen en verwijderen");

  let eigenCijfer = "";
  {
    const a = await api("POST", "/api/docent/cijfers", {
      token: c.docentA1.token,
      body: { leerlingId: f.leerlingA1.id, vakId: f.vakA1, waarde: 6, omschrijving: "Stress wijzigbaar" },
    });
    eigenCijfer = (a.body as { id?: string })?.id ?? "";
  }
  if (eigenCijfer) {
    {
      const a = await api("PUT", `/api/docent/cijfers/${eigenCijfer}`, {
        token: c.docentB1.token,
        body: { waarde: 1 },
      });
      verwachtGeweigerd("docent van school B wijzigt het cijfer niet", a);
    }
    {
      const a = await api("PUT", `/api/docent/cijfers/${eigenCijfer}`, {
        token: c.docentA1.token,
        body: { waarde: 99 },
      });
      verwachtValidatiefout("een cijfer wijzigen naar 99 wordt geweigerd", a, "HOOG");
    }
    {
      const a = await api("DELETE", `/api/docent/cijfers/${eigenCijfer}`, { token: c.leerlingA1.token });
      verwachtGeweigerd("leerling verwijdert zijn eigen slechte cijfer niet", a);
    }
    {
      const a = await api("DELETE", `/api/docent/cijfers/${eigenCijfer}`, { token: c.docentA1.token });
      nooitServerfout("docent verwijdert het eigen cijfer", a, "MIDDEL");
    }
  }

  {
    await prisma.cijfer.deleteMany({ where: { omschrijving: { startsWith: "Stress" } } });
  }
}
