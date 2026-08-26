import ExcelJS from "exceljs";
import { api, groep, verwacht, verwachtGeweigerd, verwachtStatus, verwachtValidatiefout, nooitServerfout, sla_over, kort, BASIS } from "../lib";
import { prisma } from "../fixture";
import type { Ctx } from "../context";

export const naam = "Dev-console: import en inloggegevens";

interface Rij {
  voornaam: string;
  achternaam?: string;
  email: string;
  telefoon?: string;
  rol: string;
}

/** Bouwt een xlsx zoals de school hem aanlevert. */
async function maakBestand(rijen: Rij[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Gebruikers");
  sheet.addRow(["Voornaam", "Achternaam", "E-mail", "Telefoon", "Rol"]);
  for (const r of rijen) {
    sheet.addRow([r.voornaam, r.achternaam ?? "", r.email, r.telefoon ?? "", r.rol]);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

interface ImportUitslag {
  totaal: number;
  aangemaakt: number;
  overgeslagen: number;
  fouten: number;
  resultaten: { rij: number; email: string; status: string; reden?: string }[];
}

async function importeer(cookie: string, schoolId: string, inhoud: Buffer | string, bestandsnaam = "import.xlsx") {
  const fd = new FormData();
  const blob = new Blob([inhoud as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  fd.append("bestand", blob, bestandsnaam);
  return api("POST", `/api/dev/scholen/${schoolId}/import`, { cookie, formData: fd });
}

export async function draai(c: Ctx) {
  groep("Dev-console — toegang");

  {
    const a = await api("GET", "/api/dev/scholen");
    verwachtGeweigerd("dev-console zonder cookie is dicht", a);
  }
  {
    const a = await api("GET", "/api/dev/scholen", { cookie: "dev_session=verzonnen" });
    verwachtGeweigerd("verzonnen dev-cookie werkt niet", a);
  }
  {
    const a = await api("POST", "/api/dev/login", { body: { secret: "fout-geheim" } });
    verwachtValidatiefout("verkeerd dev-geheim wordt geweigerd", a, "KRITIEK");
  }
  {
    const a = await api("GET", `/api/dev/scholen/${c.f.schoolA.id}/import`, { cookie: c.dev ?? "" });
    nooitServerfout("GET op de import-route geeft geen crash", a, "LAAG");
  }
  {
    // Een gewone admin met een geldig LMS-token mag niet in de dev-console.
    const a = await api("GET", "/api/dev/scholen", { token: c.adminA.token });
    verwachtGeweigerd("schooladmin komt niet in de dev-console", a);
  }

  if (!c.dev) {
    sla_over("geen dev-cookie (DEVELOPER_SECRET klopt niet) — importtests overgeslagen");
    return;
  }
  const cookie = c.dev;

  groep("School aanmaken");

  const slug = `stress-import-${Date.now().toString(36)}`;
  let importSchoolId = "";
  {
    const a = await api("POST", "/api/dev/scholen", {
      cookie,
      body: { naam: "Stress Importschool", slug, plaats: "Utrecht" },
    });
    verwachtStatus("school aanmaken lukt", a, [200, 201], "HOOG");
    // De route antwoordt met { school, adminAccount }, niet met de school zelf.
    importSchoolId = ((a.body as { school?: { id?: string } })?.school?.id) ?? "";
  }
  {
    const a = await api("POST", "/api/dev/scholen", {
      cookie,
      body: { naam: "Zelfde slug", slug, plaats: "Utrecht" },
    });
    verwachtStatus("dezelfde slug een tweede keer geeft 409", a, 409, "HOOG");
  }
  {
    const a = await api("POST", "/api/dev/scholen", {
      cookie,
      body: { naam: "Foute slug", slug: "Met Spaties EN Hoofdletters", plaats: "Utrecht" },
    });
    verwachtValidatiefout("ongeldige slug wordt geweigerd", a);
  }
  {
    const a = await api("POST", "/api/dev/scholen", { cookie, body: {} });
    verwachtValidatiefout("school zonder naam wordt geweigerd", a);
  }

  if (!importSchoolId) {
    sla_over("geen importschool aangemaakt — rest overgeslagen");
    return;
  }

  groep("Excel-import — geldige rijen");

  const stempel = Date.now().toString(36);
  const e = (n: string) => `${n}.${stempel}@stresstest.local`;

  {
    const bestand = await maakBestand([
      { voornaam: "Amina", achternaam: "Yusuf", email: e("amina"), telefoon: "0612345678", rol: "LEERLING" },
      { voornaam: "Karim", achternaam: "Yusuf", email: e("karim"), telefoon: "0612345678", rol: "OUDER" },
      { voornaam: "Salma", achternaam: "Idrissi", email: e("salma"), rol: "DOCENT" },
    ]);
    const a = await importeer(cookie, importSchoolId, bestand);
    const u = a.body as ImportUitslag;
    verwacht(
      "drie geldige rijen worden aangemaakt",
      a.status === 200 && u?.aangemaakt === 3 && u?.fouten === 0,
      "KRITIEK",
      "3 aangemaakt, 0 fouten",
      kort(a, 300)
    );
  }

  groep("Excel-import — alles wat er mis kan gaan in één bestand");

  {
    const bestand = await maakBestand([
      // dubbel in het bestand zelf
      { voornaam: "Dubbel", achternaam: "Een", email: e("dubbel"), rol: "LEERLING" },
      { voornaam: "Dubbel", achternaam: "Twee", email: e("dubbel"), rol: "LEERLING" },
      // bestaat al uit de vorige import
      { voornaam: "Amina", achternaam: "Yusuf", email: e("amina"), rol: "LEERLING" },
      // zelfde naam, ander adres — dit MOET gewoon mogen
      { voornaam: "Amina", achternaam: "Yusuf", email: e("amina2"), rol: "LEERLING" },
      // ongeldig e-mailadres
      { voornaam: "Geen", achternaam: "At", email: "zonder-at-teken", rol: "LEERLING" },
      { voornaam: "Spatie", achternaam: "In", email: "spatie in@adres.nl", rol: "LEERLING" },
      { voornaam: "Leeg", achternaam: "Adres", email: "", rol: "LEERLING" },
      // ontbrekende voornaam
      { voornaam: "", achternaam: "Zondervoornaam", email: e("zondervoornaam"), rol: "LEERLING" },
      // onbekende rol
      { voornaam: "Foute", achternaam: "Rol", email: e("fouterol"), rol: "DIRECTEUR" },
      { voornaam: "Lege", achternaam: "Rol", email: e("legerol"), rol: "" },
      // kleine letters in de rol moeten wél werken
      { voornaam: "Kleine", achternaam: "Letters", email: e("kleineletters"), rol: "leerling" },
      // hoofdletters in het adres moeten genormaliseerd worden
      { voornaam: "Hoofd", achternaam: "Letters", email: e("HOOFDLETTERS").toUpperCase(), rol: "LEERLING" },
      // injectie-achtige naam
      { voornaam: "<script>alert(1)</script>", achternaam: "'; DROP TABLE \"User\"; --", email: e("gemeen"), rol: "LEERLING" },
      // Arabische naam
      { voornaam: "محمد", achternaam: "عبد الله", email: e("arabisch"), rol: "LEERLING" },
      // heel lange naam
      { voornaam: "A".repeat(500), achternaam: "B".repeat(500), email: e("lang"), rol: "LEERLING" },
    ]);
    const a = await importeer(cookie, importSchoolId, bestand);
    const u = a.body as ImportUitslag;

    verwachtStatus("gemengd bestand wordt verwerkt zonder crash", a, 200, "KRITIEK");
    if (a.status !== 200 || !u?.resultaten) return;

    const zoek = (email: string) => u.resultaten.find((r) => r.email.toLowerCase() === email.toLowerCase());
    const status = (email: string) => zoek(email)?.status ?? "(niet in de uitslag)";

    verwacht(
      "dubbel adres in hetzelfde bestand wordt als fout gemeld",
      u.resultaten.filter((r) => r.email === e("dubbel")).some((r) => r.status === "fout"),
      "HOOG",
      "één fout-regel voor het dubbele adres",
      JSON.stringify(u.resultaten.filter((r) => r.email === e("dubbel")))
    );
    verwacht(
      "dubbel adres wordt maar één keer aangemaakt",
      await prisma.user.count({ where: { email: e("dubbel") } }) === 1,
      "KRITIEK",
      "1 account",
      String(await prisma.user.count({ where: { email: e("dubbel") } }))
    );
    verwacht(
      "bestaand adres wordt overgeslagen, niet overschreven",
      status(e("amina")) === "overgeslagen",
      "KRITIEK",
      "overgeslagen",
      status(e("amina"))
    );
    verwacht(
      "dezelfde naam met een ander adres mag gewoon",
      status(e("amina2")) === "aangemaakt",
      "HOOG",
      "aangemaakt",
      status(e("amina2"))
    );
    verwacht(
      "adres zonder @ wordt geweigerd",
      status("zonder-at-teken") === "fout",
      "HOOG",
      "fout",
      status("zonder-at-teken")
    );
    verwacht(
      "adres met een spatie wordt geweigerd",
      status("spatie in@adres.nl") === "fout",
      "HOOG",
      "fout",
      status("spatie in@adres.nl")
    );
    verwacht(
      "rij zonder voornaam wordt geweigerd",
      status(e("zondervoornaam")) === "fout",
      "MIDDEL",
      "fout",
      status(e("zondervoornaam"))
    );
    verwacht(
      "onbekende rol wordt geweigerd",
      status(e("fouterol")) === "fout",
      "HOOG",
      "fout",
      status(e("fouterol"))
    );
    verwacht(
      "lege rol wordt geweigerd",
      status(e("legerol")) === "fout",
      "HOOG",
      "fout",
      status(e("legerol"))
    );
    verwacht(
      "rol in kleine letters wordt geaccepteerd",
      status(e("kleineletters")) === "aangemaakt",
      "MIDDEL",
      "aangemaakt",
      status(e("kleineletters"))
    );
    {
      const rij = await prisma.user.findUnique({ where: { email: e("hoofdletters") } });
      verwacht(
        "adres met hoofdletters wordt kleingeschreven opgeslagen",
        !!rij,
        "HOOG",
        `account op ${e("hoofdletters")}`,
        rij ? "gevonden" : "niet gevonden — mogelijk als HOOFDLETTERS opgeslagen"
      );
    }
    {
      const rij = await prisma.user.findUnique({ where: { email: e("gemeen") } });
      verwacht(
        "script-tags in een naam worden letterlijk opgeslagen, niet uitgevoerd of gestript",
        rij?.name?.includes("<script>") === true,
        "LAAG",
        "naam onaangetast in de database",
        rij?.name?.slice(0, 60) ?? "niet aangemaakt"
      );
    }
    verwacht(
      "Arabische naam wordt aangemaakt",
      status(e("arabisch")) === "aangemaakt",
      "HOOG",
      "aangemaakt",
      status(e("arabisch"))
    );
    verwacht(
      "extreem lange naam laat de import niet vallen",
      zoek(e("lang")) !== undefined,
      "MIDDEL",
      "een resultaatregel",
      "geen resultaatregel"
    );
  }

  groep("Excel-import — kapotte invoer");

  {
    const a = await importeer(cookie, importSchoolId, "dit is geen xlsx maar platte tekst", "nep.xlsx");
    verwacht(
      "een niet-xlsx-bestand geeft een nette melding",
      a.status >= 400 && a.status < 500,
      "MIDDEL",
      "4xx met uitleg",
      kort(a)
    );
  }
  {
    const fd = new FormData();
    const a = await api("POST", `/api/dev/scholen/${importSchoolId}/import`, { cookie, formData: fd });
    verwachtValidatiefout("import zonder bestand geeft 400", a);
  }
  {
    const bestand = await maakBestand([]);
    const a = await importeer(cookie, importSchoolId, bestand);
    verwachtValidatiefout("bestand met alleen een kopregel geeft 400", a);
  }
  {
    const bestand = await maakBestand([{ voornaam: "X", email: e("x"), rol: "LEERLING" }]);
    const a = await importeer(cookie, "bestaatnietschool", bestand);
    verwachtStatus("import naar een onbekende school geeft 404", a, 404, "MIDDEL");
  }
  {
    // 250 rijen — kijken of de route het volhoudt en geen dubbelen maakt
    const veel: Rij[] = Array.from({ length: 250 }, (_, i) => ({
      voornaam: `Massa${i}`,
      achternaam: "Test",
      email: `massa${i}.${stempel}@stresstest.local`,
      rol: i % 4 === 0 ? "OUDER" : "LEERLING",
    }));
    const bestand = await maakBestand(veel);
    const begin = Date.now();
    const a = await importeer(cookie, importSchoolId, bestand);
    const duur = Date.now() - begin;
    const u = a.body as ImportUitslag;
    verwacht(
      "250 rijen in één keer importeren lukt",
      a.status === 200 && u?.aangemaakt === 250,
      "HOOG",
      "250 aangemaakt",
      `${kort(a, 200)} (${(duur / 1000).toFixed(1)}s)`
    );
    console.log(`      duur: ${(duur / 1000).toFixed(1)}s voor 250 accounts`);

    // meteen nogmaals: alles moet worden overgeslagen
    const b = await importeer(cookie, importSchoolId, bestand);
    const v = b.body as ImportUitslag;
    verwacht(
      "hetzelfde bestand opnieuw importeren maakt niets nieuws aan",
      b.status === 200 && v?.aangemaakt === 0 && v?.overgeslagen === 250,
      "KRITIEK",
      "0 aangemaakt, 250 overgeslagen",
      kort(b, 200)
    );
  }

  groep("Inloggegevens versturen — precies één keer");

  {
    const a = await api("GET", `/api/dev/scholen/${importSchoolId}/inloggegevens`, { cookie });
    const s = a.body as { klaar: number; alVerstuurd: number; nietVerstuurd: number };
    verwacht(
      "vóór het versturen staat iedereen op 'niet verstuurd'",
      a.status === 200 && s?.alVerstuurd === 0 && s?.nietVerstuurd === s?.klaar && s.klaar > 0,
      "HOOG",
      "alVerstuurd 0, nietVerstuurd = klaar",
      kort(a, 200)
    );
  }
  {
    // De import maakt bewust geen tokens aan; zonder mail mag er niets zijn
    // met verstuurdOp gezet.
    const alVerstuurd = await prisma.passwordResetToken.count({
      where: { gebruiker: { schoolId: importSchoolId }, verstuurdOp: { not: null } },
    });
    verwacht(
      "de import zelf verstuurt geen inloggegevens",
      alVerstuurd === 0,
      "KRITIEK",
      "0 verstuurde tokens",
      String(alVerstuurd)
    );
  }

  // Het versturen wacht 600 ms per account; met 250+ accounts duurt dat te lang
  // voor de loop. We knippen de school terug tot een handvol accounts.
  {
    const teveel = await prisma.user.findMany({
      where: { schoolId: importSchoolId, email: { contains: "massa" } },
      select: { id: true },
    });
    await prisma.user.deleteMany({ where: { id: { in: teveel.map((t) => t.id) } } });
  }

  {
    const a = await api("POST", `/api/dev/scholen/${importSchoolId}/inloggegevens`, { cookie });
    const r = a.body as { verstuurd: number; nietVerstuurd: number; alVerstuurd: number };
    verwacht(
      "eerste keer versturen bereikt iedereen",
      a.status === 200 && (r?.verstuurd ?? 0) > 0 && r?.nietVerstuurd === 0,
      "KRITIEK",
      "verstuurd > 0 en daarna 0 wachtenden",
      kort(a, 200)
    );
  }
  {
    const a = await api("POST", `/api/dev/scholen/${importSchoolId}/inloggegevens`, { cookie });
    const r = a.body as { verstuurd: number };
    verwacht(
      "tweede klik verstuurt niets opnieuw",
      a.status === 200 && r?.verstuurd === 0,
      "KRITIEK",
      "verstuurd = 0",
      kort(a, 200)
    );
  }
  {
    // Een nieuw account erbij importeren: alleen díe krijgt mail.
    const bestand = await maakBestand([
      { voornaam: "Laatkomer", achternaam: "Test", email: e("laatkomer"), rol: "LEERLING" },
    ]);
    await importeer(cookie, importSchoolId, bestand);
    const status = await api("GET", `/api/dev/scholen/${importSchoolId}/inloggegevens`, { cookie });
    const s = status.body as { nietVerstuurd: number; wachtenden: { email: string }[] };
    verwacht(
      "na een tweede import wacht alleen de nieuwe persoon op mail",
      s?.nietVerstuurd === 1 && s.wachtenden?.[0]?.email === e("laatkomer"),
      "KRITIEK",
      "1 wachtende: de laatkomer",
      kort(status, 240)
    );
  }
  {
    const a = await api("POST", `/api/dev/scholen/${importSchoolId}/inloggegevens`, {});
    verwachtGeweigerd("inloggegevens versturen zonder dev-cookie", a);
  }

  groep("Opruimen van de importschool");

  {
    const users = await prisma.user.findMany({ where: { schoolId: importSchoolId }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.passwordResetToken.deleteMany({ where: { gebruikerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.school.deleteMany({ where: { id: importSchoolId } });
    const over = await prisma.user.count({ where: { schoolId: importSchoolId } });
    verwacht("importschool volledig opgeruimd", over === 0, "LAAG", "0 accounts over", String(over));
  }

  void BASIS;
}
