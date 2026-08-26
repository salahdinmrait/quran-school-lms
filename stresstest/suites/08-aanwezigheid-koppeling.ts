import { api, groep, verwacht, verwachtGeweigerd, verwachtStatus, verwachtValidatiefout, nooitServerfout, kort } from "../lib";
import { prisma } from "../fixture";
import type { Ctx } from "../context";

export const naam = "Aanwezigheid, ouderkoppeling, klassen en vakken";

export async function draai(c: Ctx) {
  const f = c.f;

  groep("Aanwezigheid registreren");

  for (const status of ["AANWEZIG", "AFWEZIG", "TE_LAAT", "GEOORLOOFD"]) {
    const a = await api("POST", "/api/docent/absentie", {
      token: c.docentA1.token,
      body: { lesId: f.lesA1Verleden, leerlingId: f.leerlingA2.id, status },
    });
    verwachtStatus(`status ${status} wordt geaccepteerd`, a, [200, 201], "HOOG");
  }

  const ongeldigeStatussen = ["ZIEK", "aanwezig", "", null, 1, ["AANWEZIG"], { s: "AANWEZIG" }];
  for (const s of ongeldigeStatussen) {
    const a = await api("POST", "/api/docent/absentie", {
      token: c.docentA1.token,
      body: { lesId: f.lesA1Verleden, leerlingId: f.leerlingA2.id, status: s },
    });
    verwachtValidatiefout(`status ${JSON.stringify(s)} wordt geweigerd`, a, "HOOG");
  }

  {
    const a = await api("POST", "/api/docent/absentie", {
      token: c.docentA1.token,
      body: { lesId: f.lesA1Verleden, leerlingId: f.leerlingA4.id, status: "AFWEZIG" },
    });
    verwachtValidatiefout("een leerling buiten de klas kan niet worden geregistreerd", a, "HOOG");
  }
  {
    const a = await api("POST", "/api/docent/absentie", {
      token: c.docentA1.token,
      body: { lesId: f.lesA1Verleden, leerlingId: f.docentA2.id, status: "AFWEZIG" },
    });
    verwachtValidatiefout("een docent kan niet aanwezig worden gemeld", a, "MIDDEL");
  }
  {
    const a = await api("POST", "/api/docent/absentie", { token: c.docentA1.token, body: {} });
    verwachtValidatiefout("aanwezigheid zonder velden geeft 400", a);
  }
  {
    const a = await api("POST", "/api/docent/absentie", { token: c.docentA1.token, body: "{kapot" });
    verwachtValidatiefout("kapotte JSON bij aanwezigheid geeft geen crash", a, "HOOG");
  }
  {
    const a = await api("POST", "/api/docent/absentie", {
      token: c.docentB1.token,
      body: { lesId: f.lesA1Verleden, leerlingId: f.leerlingA2.id, status: "AFWEZIG" },
    });
    verwachtGeweigerd("een docent van school B registreert niets in een les van school A", a);
  }
  {
    const a = await api("POST", "/api/docent/absentie", {
      token: c.docentA2.token,
      body: { lesId: f.lesA1Verleden, leerlingId: f.leerlingA2.id, status: "AFWEZIG" },
    });
    verwachtGeweigerd("een andere docent van dezelfde school registreert niet in deze les", a);
  }
  {
    const a = await api("POST", "/api/docent/absentie", {
      token: c.leerlingA2.token,
      body: { lesId: f.lesA1Verleden, leerlingId: f.leerlingA2.id, status: "AANWEZIG" },
    });
    verwachtGeweigerd("een leerling meldt zichzelf niet aanwezig", a);
  }
  {
    await api("POST", "/api/docent/absentie", {
      token: c.docentA1.token,
      body: { lesId: f.lesA1Verleden, leerlingId: f.leerlingA2.id, status: "AANWEZIG" },
    });
    await api("POST", "/api/docent/absentie", {
      token: c.docentA1.token,
      body: { lesId: f.lesA1Verleden, leerlingId: f.leerlingA2.id, status: "TE_LAAT" },
    });
    const rijen = await prisma.aanwezigheid.findMany({
      where: { lesId: f.lesA1Verleden, leerlingId: f.leerlingA2.id },
    });
    verwacht("twee keer registreren geeft een rij, niet twee", rijen.length === 1, "HOOG", "1 rij", String(rijen.length));
    verwacht("de laatste status wint", rijen[0]?.status === "TE_LAAT", "HOOG", "TE_LAAT", String(rijen[0]?.status));
  }
  {
    const a = await api("GET", "/api/leerling/absentie", { token: c.leerlingA2.token });
    nooitServerfout("de leerling haalt zijn eigen absentie op", a, "HOOG");
  }
  {
    const a = await api("GET", "/api/leerling/absentie", { token: c.leerlingB1.token });
    verwacht(
      "een leerling van school B ziet niets van school A",
      !a.tekst.includes(f.lesA1Verleden),
      "KRITIEK",
      "niets van de andere school",
      kort(a, 200)
    );
  }

  groep("Ouder aan kind koppelen - hoogstens een ouder per kind");

  {
    const a = await api("POST", "/api/ouder/koppeling", {
      token: c.adminA.token,
      body: { ouderId: f.ouderA3.id, leerlingId: f.leerlingA1.id },
    });
    verwachtStatus("een tweede ouder op hetzelfde kind geeft 409", a, 409, "KRITIEK");
  }
  {
    const a = await api("POST", "/api/ouder/koppeling", {
      token: c.adminA.token,
      body: { ouderId: f.ouderA1.id, leerlingId: f.leerlingA1.id },
    });
    verwachtStatus("dezelfde koppeling nogmaals is gewoon goed", a, [200, 201], "MIDDEL");
    const aantal = await prisma.ouderLeerling.count({ where: { leerlingId: f.leerlingA1.id } });
    verwacht("er blijft een koppeling bestaan", aantal === 1, "KRITIEK", "1", String(aantal));
  }
  {
    const a = await api("POST", "/api/ouder/koppeling", {
      token: c.adminA.token,
      body: { ouderId: f.ouderA1.id, leerlingId: f.leerlingB1.id },
    });
    verwachtGeweigerd("een kind van school B koppelen lukt niet", a);
  }
  {
    const a = await api("POST", "/api/ouder/koppeling", {
      token: c.adminA.token,
      body: { ouderId: f.ouderA1.id, leerlingId: f.ouderA1.id },
    });
    verwacht("een ouder aan zichzelf koppelen wordt geweigerd", a.status >= 400, "MIDDEL", "4xx", kort(a, 200));
    if (a.status < 400) await prisma.ouderLeerling.deleteMany({ where: { leerlingId: f.ouderA1.id } });
  }
  {
    const a = await api("POST", "/api/ouder/koppeling", {
      token: c.adminA.token,
      body: { ouderId: f.docentA1.id, leerlingId: f.leerlingA2.id },
    });
    verwacht("een docent als ouder koppelen wordt geweigerd", a.status >= 400, "MIDDEL", "4xx (rol wordt gecontroleerd)", kort(a, 200));
    if (a.status < 400) await prisma.ouderLeerling.deleteMany({ where: { ouderId: f.docentA1.id } });
  }
  {
    const a = await api("POST", "/api/ouder/koppeling", { token: c.adminA.token, body: {} });
    verwachtValidatiefout("koppeling zonder ids geeft 400", a);
  }
  {
    const a = await api("POST", "/api/ouder/koppeling", {
      token: c.docentA1.token,
      body: { ouderId: f.ouderA1.id, leerlingId: f.leerlingA2.id },
    });
    verwachtGeweigerd("een docent koppelt geen ouders", a);
  }
  {
    const los = await api("DELETE", "/api/ouder/koppeling", {
      token: c.adminA.token,
      body: { ouderId: f.ouderA1.id, leerlingId: f.leerlingA1.id },
    });
    nooitServerfout("koppeling losmaken geeft geen serverfout", los, "MIDDEL");
    await prisma.ouderLeerling.deleteMany({ where: { leerlingId: f.leerlingA1.id } });
    const nieuw = await api("POST", "/api/ouder/koppeling", {
      token: c.adminA.token,
      body: { ouderId: f.ouderA3.id, leerlingId: f.leerlingA1.id },
    });
    verwachtStatus("na losmaken een andere ouder koppelen lukt", nieuw, [200, 201], "MIDDEL");
    await prisma.ouderLeerling.deleteMany({ where: { leerlingId: f.leerlingA1.id } });
    await prisma.ouderLeerling.create({ data: { ouderId: f.ouderA1.id, leerlingId: f.leerlingA1.id } });
  }

  groep("Klassen");

  let nieuweKlas = "";
  {
    const a = await api("POST", "/api/klassen", { token: c.adminA.token, body: { naam: "Stress Klas" } });
    verwachtStatus("admin maakt een klas aan", a, [200, 201], "HOOG");
    nieuweKlas = (a.body as { id?: string })?.id ?? "";
  }
  {
    const a = await api("POST", "/api/klassen", { token: c.adminA.token, body: {} });
    verwachtValidatiefout("klas zonder naam wordt geweigerd", a);
  }
  {
    const a = await api("POST", "/api/klassen", { token: c.adminA.token, body: { naam: "A" } });
    verwachtValidatiefout("klasnaam van een teken wordt geweigerd", a, "LAAG");
  }
  {
    const a = await api("POST", "/api/klassen", { token: c.docentA1.token, body: { naam: "Stress Docentklas" } });
    verwachtGeweigerd("een docent maakt geen klassen aan", a);
  }
  {
    const a = await api("POST", "/api/klassen", { token: c.adminA.token, body: "{kapot" });
    verwachtValidatiefout("kapotte JSON bij klas aanmaken geeft geen crash", a, "HOOG");
  }

  if (nieuweKlas) {
    {
      const a = await api("POST", `/api/klassen/${nieuweKlas}/leerlingen`, {
        token: c.adminA.token,
        body: { leerlingIds: [f.leerlingB1.id] },
      });
      nooitServerfout("leerling van school B toevoegen geeft geen crash", a, "HOOG");
      const rij = await prisma.klasLeerling.count({ where: { klasId: nieuweKlas, leerlingId: f.leerlingB1.id } });
      verwacht("een leerling van school B belandt niet in een klas van school A", rij === 0, "KRITIEK", "0", String(rij));
    }
    {
      const a = await api("POST", `/api/klassen/${nieuweKlas}/docenten`, {
        token: c.adminA.token,
        body: { docentIds: [f.docentB1.id] },
      });
      nooitServerfout("docent van school B koppelen geeft geen crash", a, "HOOG");
      const rij = await prisma.klasDocent.count({ where: { klasId: nieuweKlas, docentId: f.docentB1.id } });
      verwacht("een docent van school B komt niet voor een klas van school A", rij === 0, "KRITIEK", "0", String(rij));
    }
    {
      await api("POST", `/api/klassen/${nieuweKlas}/leerlingen`, {
        token: c.adminA.token,
        body: { leerlingIds: [f.docentA1.id] },
      });
      const rij = await prisma.klasLeerling.count({ where: { klasId: nieuweKlas, leerlingId: f.docentA1.id } });
      verwacht("een docent wordt geen leerling in een klas", rij === 0, "HOOG", "0", String(rij));
    }
    {
      const a = await api("POST", `/api/klassen/${nieuweKlas}/leerlingen`, {
        token: c.adminA.token,
        body: { leerlingIds: [f.leerlingA1.id, f.leerlingA1.id] },
      });
      nooitServerfout("dezelfde leerling dubbel toevoegen geeft geen crash", a, "HOOG");
      const aantal = await prisma.klasLeerling.count({ where: { klasId: nieuweKlas, leerlingId: f.leerlingA1.id } });
      verwacht("de leerling zit er hoogstens een keer in", aantal <= 1, "HOOG", "hoogstens 1", String(aantal));
    }
    {
      const a = await api("POST", `/api/klassen/${nieuweKlas}/leerlingen`, { token: c.adminA.token, body: "{kapot" });
      verwachtValidatiefout("kapotte JSON bij leerlingen toevoegen geeft geen crash", a, "HOOG");
    }
    {
      const a = await api("POST", `/api/klassen/${nieuweKlas}/leerlingen`, {
        token: c.docentA1.token,
        body: { leerlingIds: [f.leerlingA1.id] },
      });
      verwachtGeweigerd("een docent voegt zelf geen leerlingen toe", a);
    }
    {
      const a = await api("PATCH", `/api/klassen/${nieuweKlas}`, { token: c.adminB.token, body: { naam: "Gekaapt" } });
      verwachtGeweigerd("admin B hernoemt geen klas van school A", a);
    }
    {
      const a = await api("DELETE", `/api/klassen/${nieuweKlas}`, { token: c.adminA.token });
      verwachtStatus("klas archiveren lukt", a, 200, "MIDDEL");
      const rij = await prisma.klas.findUnique({ where: { id: nieuweKlas }, select: { verwijderdOp: true } });
      verwacht("de klas is zacht verwijderd", rij?.verwijderdOp != null, "HOOG", "verwijderdOp gezet", JSON.stringify(rij));
    }
    {
      const a = await api("GET", "/api/klassen", { token: c.adminA.token });
      verwacht("een gearchiveerde klas staat niet meer in de lijst", !a.tekst.includes(nieuweKlas), "MIDDEL", "niet in de lijst", "staat er nog in");
    }
    {
      const a = await api("DELETE", "/api/admin/archief", {
        token: c.adminB.token,
        body: { type: "klas", id: nieuweKlas },
      });
      verwachtGeweigerd("admin B verwijdert geen klas van school A definitief", a);
    }
    {
      const a = await api("DELETE", "/api/admin/archief", {
        token: c.adminA.token,
        body: { type: "klas", id: nieuweKlas },
      });
      verwachtStatus("klas definitief verwijderen lukt", a, 200, "MIDDEL");
      const rest = {
        klas: await prisma.klas.count({ where: { id: nieuweKlas } }),
        klasLeerling: await prisma.klasLeerling.count({ where: { klasId: nieuweKlas } }),
        klasDocent: await prisma.klasDocent.count({ where: { klasId: nieuweKlas } }),
        les: await prisma.les.count({ where: { klasId: nieuweKlas } }),
      };
      const wezen = Object.entries(rest).filter(([, n]) => n > 0);
      verwacht(
        "na het verwijderen van een klas blijft er niets achter",
        wezen.length === 0,
        "HOOG",
        "overal 0",
        wezen.map(([k, n]) => `${k}=${n}`).join(", ") || "0"
      );
    }
  }

  groep("Vakken");

  {
    const a = await api("POST", "/api/vakken", {
      token: c.adminA.token,
      body: { naam: "Stress Vak", categorie: "ONBEKENDE_CATEGORIE" },
    });
    verwachtValidatiefout("onbekende vakcategorie wordt geweigerd", a, "MIDDEL");
  }
  {
    const a = await api("POST", "/api/vakken", { token: c.adminA.token, body: { naam: "Stress Vak" } });
    verwachtValidatiefout("vak zonder categorie wordt geweigerd", a, "MIDDEL");
  }
  {
    const a = await api("POST", "/api/vakken", { token: c.leerlingA1.token, body: { naam: "Stress Vak", categorie: "OVERIG" } });
    verwachtGeweigerd("een leerling maakt geen vakken aan", a);
  }
  {
    const a = await api("POST", "/api/vakken", { token: c.adminA.token, body: "{kapot" });
    verwachtValidatiefout("kapotte JSON bij vak aanmaken geeft geen crash", a, "HOOG");
  }
  {
    const a = await api("PUT", `/api/vakken/${f.vakB1}`, {
      token: c.adminA.token,
      body: { naam: "Gekaapt", categorie: "OVERIG" },
    });
    verwachtGeweigerd("admin A wijzigt geen vak van school B", a);
    const vak = await prisma.vak.findUnique({ where: { id: f.vakB1 }, select: { naam: true } });
    verwacht("het vak van school B heet nog steeds hetzelfde", vak?.naam !== "Gekaapt", "KRITIEK", "onveranderd", String(vak?.naam));
  }
  {
    const a = await api("DELETE", `/api/vakken/${f.vakB1}`, { token: c.adminA.token });
    verwachtGeweigerd("admin A verwijdert geen vak van school B", a);
    const vak = await prisma.vak.findUnique({ where: { id: f.vakB1 }, select: { verwijderdOp: true } });
    verwacht("het vak van school B staat niet in het archief", vak?.verwijderdOp == null, "KRITIEK", "niet verwijderd", JSON.stringify(vak));
  }

  groep("Lessen inplannen");

  {
    const a = await api("POST", "/api/lessen", {
      token: c.adminA.token,
      body: { klasId: f.klasB1, vakId: f.vakB1, datum: new Date().toISOString(), begintijd: "09:00", eindtijd: "10:00" },
    });
    verwachtGeweigerd("admin A plant geen les in een klas van school B", a);
  }
  {
    const a = await api("POST", "/api/lessen", {
      token: c.docentA1.token,
      body: { klasId: f.klasA2, vakId: f.vakA2, datum: new Date().toISOString(), begintijd: "09:00", eindtijd: "10:00" },
    });
    verwachtGeweigerd("docent A1 plant geen les in de klas van docent A2", a);
  }
  {
    const a = await api("POST", "/api/lessen", { token: c.adminA.token, body: { klasId: f.klasA1 } });
    verwachtValidatiefout("les zonder datum en tijden wordt geweigerd", a);
  }
  {
    const a = await api("POST", "/api/lessen", { token: c.adminA.token, body: "{kapot" });
    verwachtValidatiefout("kapotte JSON bij les aanmaken geeft geen crash", a, "HOOG");
  }
  {
    const a = await api("POST", "/api/lessen", {
      token: c.adminA.token,
      body: { klasId: f.klasA1, vakId: f.vakA1, datum: "geen datum", begintijd: "09:00", eindtijd: "10:00" },
    });
    verwachtValidatiefout("een onleesbare datum geeft een nette 400, geen serverfout", a, "HOOG");
  }
  {
    const a = await api("POST", "/api/lessen", {
      token: c.adminA.token,
      body: { klasId: f.klasA1, vakId: f.vakA1, datum: new Date().toISOString(), begintijd: "18:00", eindtijd: "09:00" },
    });
    verwacht("een eindtijd voor de begintijd wordt geweigerd", a.status >= 400 && a.status < 500, "MIDDEL", "4xx", kort(a, 200));
  }
  {
    const a = await api("POST", "/api/lessen", {
      token: c.adminA.token,
      body: { klasId: f.klasA1, vakId: f.vakA1, datum: new Date().toISOString(), begintijd: "25:99", eindtijd: "99:99" },
    });
    verwacht("een onmogelijke tijd wordt geweigerd", a.status >= 400 && a.status < 500, "MIDDEL", "4xx", kort(a, 200));
  }
  {
    // Herhalen tot ver in de toekomst: een enkel verzoek mag niet duizenden rijen maken.
    const start = new Date();
    const tot = new Date(start.getFullYear() + 20, start.getMonth(), start.getDate());
    const a = await api("POST", "/api/lessen", {
      token: c.adminA.token,
      body: {
        klasId: f.klasA1,
        vakId: f.vakA1,
        datum: start.toISOString(),
        begintijd: "09:00",
        eindtijd: "10:00",
        beschrijving: "Stress herhaal",
        herhalen: { totDatum: tot.toISOString() },
      },
    });
    const aantal = (a.body as { count?: number })?.count ?? 0;
    verwacht(
      "20 jaar herhalen wordt begrensd of geweigerd",
      a.status >= 400 || aantal <= 60,
      "HOOG",
      "4xx of hoogstens 60 lessen",
      `status ${a.status}, ${aantal} lessen aangemaakt`
    );
  }

  {
    await prisma.les.deleteMany({ where: { beschrijving: { startsWith: "Stress" } } });
    await prisma.klas.deleteMany({ where: { naam: { startsWith: "Stress" } } });
    await prisma.vak.deleteMany({ where: { naam: { startsWith: "Stress" } } });
  }
}
