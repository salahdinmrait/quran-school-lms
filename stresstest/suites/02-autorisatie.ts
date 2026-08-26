import { api, groep, ok, verwacht, verwachtGeweigerd, kort, GEMENE_IDS, nooitServerfout } from "../lib";
import type { Ctx } from "../context";
import type { Sessie } from "../lib";

export const naam = "Rollen, schoolgrenzen en id-raden";

export async function draai(c: Ctx) {
  const f = c.f;

  groep("Rolgrenzen — wie mag welke route");

  // Per route: welke rollen horen erin te mogen. Alle andere rollen moeten
  // geweigerd worden (401/403/404) en zeker geen 200 krijgen.
  const matrix: { methode: string; pad: string; mag: string[]; body?: unknown }[] = [
    { methode: "GET", pad: "/api/gebruikers", mag: ["ADMIN"] },
    { methode: "GET", pad: "/api/admin/archief", mag: ["ADMIN"] },
    { methode: "GET", pad: "/api/admin/statistieken", mag: ["ADMIN"] },
    { methode: "GET", pad: "/api/admin/berichten-data", mag: ["ADMIN"] },
    { methode: "GET", pad: "/api/docent/klassen", mag: ["DOCENT"] },
    { methode: "GET", pad: "/api/docent/cijfers", mag: ["DOCENT"] },
    { methode: "GET", pad: "/api/docent/lessen", mag: ["DOCENT"] },
    { methode: "GET", pad: "/api/docent/statistieken", mag: ["DOCENT"] },
    { methode: "GET", pad: "/api/docent/huiswerk", mag: ["DOCENT"] },
    { methode: "GET", pad: "/api/leerling/huiswerk", mag: ["LEERLING"] },
    { methode: "GET", pad: "/api/leerling/cijfers", mag: ["LEERLING"] },
    { methode: "GET", pad: "/api/leerling/dashboard", mag: ["LEERLING"] },
    { methode: "GET", pad: "/api/leerling/absentie", mag: ["LEERLING"] },
    { methode: "GET", pad: "/api/leerling/contacten", mag: ["LEERLING"] },
    { methode: "GET", pad: "/api/ouder/huiswerk", mag: ["OUDER"] },
    { methode: "GET", pad: "/api/ouder/kind", mag: ["OUDER"] },
    { methode: "GET", pad: "/api/ouder/lessen", mag: ["OUDER"] },
    { methode: "GET", pad: "/api/ouder/contacten", mag: ["OUDER"] },
    { methode: "GET", pad: `/api/ouder/koppeling?ouderId=${f.ouderA1.id}`, mag: ["ADMIN"] },
  ];

  const rollen: { rol: string; s: Sessie }[] = [
    { rol: "ADMIN", s: c.adminA },
    { rol: "DOCENT", s: c.docentA1 },
    { rol: "LEERLING", s: c.leerlingA1 },
    { rol: "OUDER", s: c.ouderA1 },
  ];

  for (const r of matrix) {
    for (const { rol, s } of rollen) {
      const a = await api(r.methode, r.pad, { token: s.token, body: r.body });
      const kortPad = r.pad.split("?")[0];
      if (r.mag.includes(rol)) {
        verwacht(
          `${rol} mag ${r.methode} ${kortPad}`,
          a.status >= 200 && a.status < 300,
          "HOOG",
          "2xx",
          kort(a)
        );
      } else {
        verwachtGeweigerd(`${rol} mag NIET ${r.methode} ${kortPad}`, a);
      }
    }
  }

  groep("Schoolgrens — school B mag niets van school A zien");

  const overSchoolheen: { naam: string; methode: string; pad: string; token: string; body?: unknown }[] = [
    {
      naam: "admin B leest gebruiker van school A",
      methode: "GET",
      pad: `/api/gebruikers/${f.leerlingA1.id}`,
      token: c.adminB.token,
    },
    {
      naam: "admin B wijzigt gebruiker van school A",
      methode: "PUT",
      pad: `/api/gebruikers/${f.leerlingA1.id}`,
      token: c.adminB.token,
      body: { name: "Gekaapt", email: "gekaapt@stresstest.local", role: "ADMIN", actief: true },
    },
    {
      naam: "admin B verwijdert gebruiker van school A",
      methode: "DELETE",
      pad: `/api/gebruikers/${f.leerlingA1.id}`,
      token: c.adminB.token,
    },
    {
      naam: "admin B leest klas van school A",
      methode: "GET",
      pad: `/api/klassen/${f.klasA1}`,
      token: c.adminB.token,
    },
    {
      naam: "admin B verwijdert klas van school A",
      methode: "DELETE",
      pad: `/api/klassen/${f.klasA1}`,
      token: c.adminB.token,
    },
    {
      naam: "admin B leest vak van school A",
      methode: "GET",
      pad: `/api/vakken/${f.vakA1}`,
      token: c.adminB.token,
    },
    {
      naam: "admin B wijzigt les van school A niet",
      methode: "PATCH",
      pad: `/api/lessen/${f.lesA1Toekomst}`,
      token: c.adminB.token,
      body: { lokaal: "gekaapt" },
    },
    {
      naam: "admin B verwijdert les van school A",
      methode: "DELETE",
      pad: `/api/lessen/${f.lesA1Toekomst}`,
      token: c.adminB.token,
    },
    {
      naam: "docent B verwijdert huiswerk van school A",
      methode: "DELETE",
      pad: `/api/docent/huiswerk/${f.huiswerkKlas}`,
      token: c.docentB1.token,
    },
    {
      naam: "docent B leest absentie van een les van school A",
      methode: "GET",
      pad: `/api/docent/absentie?lesId=${f.lesA1Verleden}`,
      token: c.docentB1.token,
    },
    {
      naam: "docent B registreert absentie bij een les van school A",
      methode: "POST",
      pad: "/api/docent/absentie",
      token: c.docentB1.token,
      body: { lesId: f.lesA1Verleden, leerlingId: f.leerlingA1.id, status: "AFWEZIG" },
    },
    {
      naam: "docent B geeft een cijfer aan een leerling van school A",
      methode: "POST",
      pad: "/api/docent/cijfers",
      token: c.docentB1.token,
      body: { leerlingId: f.leerlingA1.id, vakId: f.vakA1, waarde: 1 },
    },
    {
      naam: "admin B koppelt een ouder van school A aan een kind",
      methode: "POST",
      pad: "/api/ouder/koppeling",
      token: c.adminB.token,
      body: { ouderId: f.ouderA1.id, leerlingId: f.leerlingA2.id },
    },
    {
      naam: "admin B verwijdert een archiefitem van school A",
      methode: "DELETE",
      pad: "/api/admin/archief",
      token: c.adminB.token,
      body: { type: "gebruiker", id: f.leerlingA1.id },
    },
    {
      naam: "leerling B zoekt leerlingen van school A",
      methode: "GET",
      pad: "/api/search/leerling?q=Omar",
      token: c.leerlingB1.token,
    },
  ];

  for (const t of overSchoolheen) {
    const a = await api(t.methode, t.pad, { token: t.token, body: t.body });
    verwachtGeweigerd(t.naam, a);
  }

  {
    // Zoeken hoort binnen de eigen school te blijven: admin B mag zoeken,
    // maar mag Omar (school A) niet in de uitslag krijgen.
    const a = await api("GET", "/api/search/leerling?q=Omar", { token: c.adminB.token });
    verwacht(
      "zoekresultaat van admin B bevat geen leerling van school A",
      !a.tekst.includes(f.leerlingA1.id),
      "KRITIEK",
      "geen id van school A in het antwoord",
      kort(a, 240)
    );
  }
  {
    const a = await api("GET", "/api/gebruikers", { token: c.adminB.token });
    verwacht(
      "gebruikerslijst van admin B bevat niemand van school A",
      !a.tekst.includes(f.leerlingA1.email) && !a.tekst.includes(f.leerlingA1.id),
      "KRITIEK",
      "geen e-mailadres van school A",
      kort(a, 240)
    );
  }

  groep("Eigen school, andere docent");

  {
    const a = await api("POST", "/api/docent/absentie", {
      token: c.docentA2.token,
      body: { lesId: f.lesA1Verleden, leerlingId: f.leerlingA1.id, status: "AFWEZIG" },
    });
    verwachtGeweigerd("docent A2 registreert geen absentie bij een les van docent A1", a);
  }
  {
    const a = await api("DELETE", `/api/docent/huiswerk/${f.huiswerkKlas}`, {
      token: c.docentA2.token,
    });
    verwachtGeweigerd("docent A2 verwijdert geen huiswerk van docent A1", a);
  }
  {
    const a = await api("GET", "/api/docent/cijfers", { token: c.docentA2.token });
    verwacht(
      "docent A2 ziet geen cijfers van klas A1",
      !a.tekst.includes(f.cijferA1),
      "HOOG",
      "cijfer van de andere klas niet zichtbaar",
      kort(a, 240)
    );
  }

  groep("Id's raden op bijlage-routes");

  const bijlageTypes = ["huiswerk", "bericht", "cijfer", "inlevering", "les", "studiemateriaal"];
  for (const type of bijlageTypes) {
    const a = await api("GET", `/api/attachment/${type}/${f.cijferA1}`, {
      token: c.leerlingB1.token,
    });
    verwachtGeweigerd(`leerling B krijgt geen bijlage via /attachment/${type}`, a);
  }
  {
    const a = await api("GET", `/api/attachment/onbekendtype/${f.cijferA1}`, {
      token: c.adminA.token,
    });
    nooitServerfout("onbekend bijlagetype geeft geen crash", a);
  }
  {
    const a = await api("GET", `/api/bijlage/${f.huiswerkKlas}`, { token: c.leerlingB1.token });
    verwachtGeweigerd("leerling B krijgt geen bijlage via /bijlage/[id]", a);
  }
  {
    const a = await api("GET", `/api/attachment/cijfer/${f.cijferA1}?token=ongeldig`);
    verwachtGeweigerd("?token=ongeldig geeft geen toegang tot een bijlage", a);
  }
  {
    const a = await api("GET", `/api/attachment/bericht/${f.berichtAanA1}`, { token: c.leerlingA2.token });
    verwachtGeweigerd("leerling A2 leest het bericht van leerling A1 niet", a);
  }
  {
    const a = await api("GET", `/api/attachment/bericht/${f.berichtAanA1}`, { token: c.adminA.token });
    verwachtGeweigerd("zelfs de admin leest andermans bericht niet", a, "MIDDEL");
  }

  groep("Onzin-id's mogen nooit een 500 geven");

  for (const id of GEMENE_IDS) {
    const label = id === "" ? "(leeg)" : id.slice(0, 24);
    const paden = [
      `/api/gebruikers/${encodeURIComponent(id)}`,
      `/api/klassen/${encodeURIComponent(id)}`,
      `/api/lessen/${encodeURIComponent(id)}`,
      `/api/vakken/${encodeURIComponent(id)}`,
      `/api/attachment/cijfer/${encodeURIComponent(id)}`,
    ];
    let schoon = true;
    let laatste = "";
    for (const p of paden) {
      const a = await api("GET", p, { token: c.adminA.token });
      if (a.status >= 500 || a.status === 0) {
        schoon = false;
        laatste = `${p} → ${kort(a)}`;
      }
    }
    if (schoon) ok(`id "${label}" geeft overal een nette fout`);
    else verwacht(`id "${label}" geeft overal een nette fout`, false, "HOOG", "4xx", laatste);
  }
}
