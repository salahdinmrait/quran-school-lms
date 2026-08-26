import { api, groep, verwacht, verwachtGeweigerd, verwachtStatus, verwachtValidatiefout, nooitServerfout, kort, login, GEMENE_STRINGS } from "../lib";
import { prisma, WACHTWOORD } from "../fixture";
import type { Ctx } from "../context";

export const naam = "Accounts: aanmaken, dubbelen, wijzigen, archiveren, verwijderen";

export async function draai(c: Ctx) {
  const f = c.f;
  const stempel = Date.now().toString(36);
  const e = (n: string) => `stress.${n}.${stempel}@stresstest.local`;

  groep("Account aanmaken — validatie");

  const kapot: { naam: string; body: unknown }[] = [
    { naam: "zonder naam", body: { email: e("a"), password: "Geheim12345", role: "LEERLING" } },
    { naam: "met een naam van één teken", body: { name: "X", email: e("b"), password: "Geheim12345", role: "LEERLING" } },
    { naam: "zonder e-mail", body: { name: "Test Persoon", password: "Geheim12345", role: "LEERLING" } },
    { naam: "met een e-mail zonder @", body: { name: "Test Persoon", email: "geenapenstaartje", password: "Geheim12345", role: "LEERLING" } },
    { naam: "met een e-mail met spatie", body: { name: "Test Persoon", email: "met spatie@test.nl", password: "Geheim12345", role: "LEERLING" } },
    { naam: "met een te kort wachtwoord", body: { name: "Test Persoon", email: e("c"), password: "kort", role: "LEERLING" } },
    { naam: "zonder wachtwoord", body: { name: "Test Persoon", email: e("d"), role: "LEERLING" } },
    { naam: "met een onbekende rol", body: { name: "Test Persoon", email: e("f"), password: "Geheim12345", role: "DIRECTEUR" } },
    { naam: "met rol in kleine letters", body: { name: "Test Persoon", email: e("g"), password: "Geheim12345", role: "leerling" } },
    { naam: "met een telefoonnummer van 200 tekens", body: { name: "Test Persoon", email: e("h"), password: "Geheim12345", role: "LEERLING", telefoon: "0".repeat(200) } },
    { naam: "met een rol als array", body: { name: "Test Persoon", email: e("i"), password: "Geheim12345", role: ["ADMIN"] } },
  ];
  for (const k of kapot) {
    const a = await api("POST", "/api/gebruikers", { token: c.adminA.token, body: k.body });
    verwachtValidatiefout(`account ${k.naam} wordt geweigerd`, a, "HOOG");
  }
  {
    const a = await api("POST", "/api/gebruikers", { token: c.adminA.token, body: "{kapot" });
    verwachtValidatiefout("kapotte JSON bij accounts geeft geen crash", a, "HOOG");
  }
  for (const [rol, s] of [
    ["docent", c.docentA1],
    ["leerling", c.leerlingA1],
    ["ouder", c.ouderA1],
  ] as const) {
    const a = await api("POST", "/api/gebruikers", {
      token: s.token,
      body: { name: "Sluipweg Test", email: e("sluip"), password: "Geheim12345", role: "ADMIN" },
    });
    verwachtGeweigerd(`${rol} maakt zelf geen account aan`, a);
  }

  groep("Dubbele e-mailadressen");

  const eersteEmail = e("dubbel");
  let dubbelId = "";
  {
    const a = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: { name: "Dubbel Een", email: eersteEmail, password: "Geheim12345", role: "LEERLING" },
    });
    verwachtStatus("eerste account met dit adres lukt", a, [200, 201], "HOOG");
    dubbelId = (a.body as { id?: string })?.id ?? "";
  }
  {
    const a = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: { name: "Dubbel Twee", email: eersteEmail, password: "Geheim12345", role: "LEERLING" },
    });
    verwachtStatus("hetzelfde adres een tweede keer geeft 409", a, 409, "KRITIEK");
  }
  {
    const a = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: { name: "Dubbel Hoofdletters", email: eersteEmail.toUpperCase(), password: "Geheim12345", role: "LEERLING" },
    });
    const aantal = await prisma.user.count({
      where: { email: { in: [eersteEmail, eersteEmail.toUpperCase()] } },
    });
    verwacht(
      "hetzelfde adres in hoofdletters maakt geen tweede account",
      a.status === 409 || aantal === 1,
      "KRITIEK",
      "409, of hooguit één account",
      `status ${a.status}, ${aantal} account(s) — hoofdlettergevoelige unieke sleutel?`
    );
  }
  {
    const a = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: { name: "Dubbel Spaties", email: `  ${eersteEmail}  `, password: "Geheim12345", role: "LEERLING" },
    });
    verwacht(
      "hetzelfde adres met spaties eromheen maakt geen tweede account",
      a.status >= 400,
      "HOOG",
      "4xx",
      kort(a, 200)
    );
  }
  {
    // Admin B mag hetzelfde adres ook niet claimen: e-mail is systeembreed uniek.
    const a = await api("POST", "/api/gebruikers", {
      token: c.adminB.token,
      body: { name: "Andere School", email: eersteEmail, password: "Geheim12345", role: "LEERLING" },
    });
    verwachtStatus("een adres uit school A is ook in school B bezet", a, 409, "HOOG");
  }

  groep("Dezelfde naam, hetzelfde nummer — dat mag gewoon");

  {
    const a = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: { name: "Dubbel Een", email: e("zelfdenaam"), password: "Geheim12345", role: "LEERLING", telefoon: "0612345678" },
    });
    verwachtStatus("tweede persoon met dezelfde naam mag", a, [200, 201], "HOOG");
  }
  {
    const a = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: { name: "Broer Van", email: e("zelfdenummer"), password: "Geheim12345", role: "LEERLING", telefoon: "0612345678" },
    });
    verwachtStatus("tweede persoon met hetzelfde telefoonnummer mag", a, [200, 201], "HOOG");
  }
  {
    const a = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: { name: "محمد عبد الله", email: e("arabisch"), password: "Geheim12345", role: "LEERLING" },
    });
    verwachtStatus("Arabische naam wordt geaccepteerd", a, [200, 201], "HOOG");
  }
  {
    const a = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: { name: "Ali 🎓 Hassan", email: e("emoji"), password: "Geheim12345", role: "LEERLING" },
    });
    nooitServerfout("emoji in een naam laat de server niet vallen", a);
  }
  {
    const a = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: { name: "A".repeat(5000), email: e("langenaam"), password: "Geheim12345", role: "LEERLING" },
    });
    nooitServerfout("naam van 5000 tekens laat de server niet vallen", a);
  }

  groep("Account wijzigen");

  if (dubbelId) {
    {
      const a = await api("PUT", `/api/gebruikers/${dubbelId}`, {
        token: c.adminA.token,
        body: { name: "Dubbel Hernoemd", email: eersteEmail, role: "LEERLING", actief: true },
      });
      verwachtStatus("naam wijzigen lukt", a, 200, "HOOG");
    }
    {
      // Naar een adres dat al bezet is — dit hoort een nette 409 te zijn,
      // geen 500 vanuit de database.
      const a = await api("PUT", `/api/gebruikers/${dubbelId}`, {
        token: c.adminA.token,
        body: { name: "Dubbel Hernoemd", email: f.leerlingA1.email, role: "LEERLING", actief: true },
      });
      verwacht(
        "e-mail wijzigen naar een bezet adres geeft een nette 409",
        a.status === 409,
        "HOOG",
        "409 met uitleg",
        kort(a, 200)
      );
    }
    {
      const a = await api("PUT", `/api/gebruikers/${dubbelId}`, {
        token: c.adminA.token,
        body: { name: "Dubbel Hernoemd", email: eersteEmail, role: "ADMIN", actief: true },
      });
      verwachtStatus("rol wijzigen naar ADMIN lukt voor een admin", a, 200, "MIDDEL");
      // en weer terug
      await api("PUT", `/api/gebruikers/${dubbelId}`, {
        token: c.adminA.token,
        body: { name: "Dubbel Hernoemd", email: eersteEmail, role: "LEERLING", actief: true },
      });
    }
    {
      const a = await api("PUT", `/api/gebruikers/${dubbelId}`, {
        token: c.adminA.token,
        body: { name: "Dubbel Hernoemd", email: eersteEmail, role: "LEERLING", actief: true, nieuwWachtwoord: "kort" },
      });
      verwachtValidatiefout("te kort nieuw wachtwoord wordt geweigerd", a, "HOOG");
    }
    {
      const a = await api("PUT", `/api/gebruikers/${dubbelId}`, {
        token: c.docentA1.token,
        body: { name: "Gekaapt", email: eersteEmail, role: "ADMIN", actief: true },
      });
      verwachtGeweigerd("docent wijzigt geen accounts", a);
    }
    {
      const a = await api("PUT", `/api/gebruikers/${dubbelId}`, {
        token: c.adminA.token,
        body: { name: "Dubbel Hernoemd", email: eersteEmail, role: "LEERLING" },
      });
      verwachtValidatiefout("wijzigen zonder 'actief' wordt geweigerd", a, "LAAG");
    }
  }

  groep("Wachtwoord wijzigen door de beheerder");

  {
    const doelEmail = e("wachtwoord");
    const maak = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: { name: "Wachtwoord Test", email: doelEmail, password: "EersteGeheim1", role: "LEERLING" },
    });
    const id = (maak.body as { id?: string })?.id ?? "";

    const eerste = await login(doelEmail, "EersteGeheim1");
    verwacht("inloggen met het eerste wachtwoord lukt", !!eerste, "HOOG", "sessie", "mislukt");

    const a = await api("PUT", `/api/gebruikers/${id}`, {
      token: c.adminA.token,
      body: { name: "Wachtwoord Test", email: doelEmail, role: "LEERLING", actief: true, nieuwWachtwoord: "TweedeGeheim22" },
    });
    verwachtStatus("beheerder zet een nieuw wachtwoord", a, 200, "HOOG");

    const oud = await login(doelEmail, "EersteGeheim1");
    verwacht("het oude wachtwoord werkt niet meer", !oud, "KRITIEK", "geweigerd", "nog steeds geldig");

    const nieuw = await login(doelEmail, "TweedeGeheim22");
    verwacht("het nieuwe wachtwoord werkt", !!nieuw, "HOOG", "sessie", "mislukt");

    const rij = await prisma.user.findUnique({ where: { email: doelEmail }, select: { password: true } });
    verwacht(
      "het wachtwoord staat gehasht in de database",
      (rij?.password ?? "").startsWith("$2") && !rij?.password?.includes("TweedeGeheim"),
      "KRITIEK",
      "bcrypt-hash",
      (rij?.password ?? "").slice(0, 12)
    );

    // Bestaand token blijft geldig na een wachtwoordwijziging — dat is bekend
    // gedrag van JWT's; we controleren alleen dat het gedocumenteerde gedrag is.
    if (eerste) {
      const b = await api("GET", "/api/leerling/huiswerk", { token: eerste.token });
      console.log(`      (ter info) oud token na wachtwoordwijziging → status ${b.status}`);
    }
  }

  groep("Account archiveren (zachte verwijdering)");

  const archiefEmail = e("archief");
  let archiefId = "";
  let archiefToken = "";
  {
    const maak = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: { name: "Archief Test", email: archiefEmail, password: "ArchiefGeheim1", role: "LEERLING" },
    });
    archiefId = (maak.body as { id?: string })?.id ?? "";
    const s = await login(archiefEmail, "ArchiefGeheim1");
    archiefToken = s?.token ?? "";
    verwacht("het nieuwe account kan inloggen", !!s, "HOOG", "sessie", "mislukt");
  }
  {
    const a = await api("DELETE", `/api/gebruikers/${c.adminA.id}`, { token: c.adminA.token });
    verwachtValidatiefout("een admin kan zichzelf niet verwijderen", a, "HOOG");
  }
  {
    const a = await api("DELETE", `/api/gebruikers/${archiefId}`, { token: c.docentA1.token });
    verwachtGeweigerd("docent archiveert geen accounts", a);
  }
  if (archiefId) {
    const a = await api("DELETE", `/api/gebruikers/${archiefId}`, { token: c.adminA.token });
    verwachtStatus("beheerder archiveert het account", a, 200, "HOOG");

    const rij = await prisma.user.findUnique({
      where: { id: archiefId },
      select: { verwijderdOp: true, actief: true },
    });
    verwacht(
      "het account is zacht verwijderd, niet echt weg",
      !!rij && rij.verwijderdOp !== null && rij.actief === false,
      "HOOG",
      "verwijderdOp gezet, actief false",
      JSON.stringify(rij)
    );

    const opnieuw = await login(archiefEmail, "ArchiefGeheim1");
    verwacht(
      "een gearchiveerd account kan niet meer inloggen",
      !opnieuw,
      "KRITIEK",
      "geweigerd",
      "kon nog inloggen"
    );

    const metOudToken = await api("GET", "/api/leerling/huiswerk", { token: archiefToken });
    verwachtGeweigerd("het token van vóór de archivering werkt niet meer", metOudToken);

    const reset = await api("POST", "/api/auth/forgot-password", { body: { email: archiefEmail } });
    verwacht(
      "een gearchiveerd account krijgt geen resetmail",
      reset.status === 200 &&
        (await prisma.passwordResetToken.count({ where: { gebruikerId: archiefId, gebruikt: false } })) === 0,
      "HOOG",
      "geen nieuw reset-token",
      kort(reset)
    );

    const lijst = await api("GET", "/api/gebruikers", { token: c.adminA.token });
    verwacht(
      "een gearchiveerd account staat niet meer in de gewone lijst",
      !lijst.tekst.includes(archiefEmail),
      "MIDDEL",
      "niet in de lijst",
      "staat er nog in"
    );

    const archief = await api("GET", "/api/admin/archief", { token: c.adminA.token });
    verwacht(
      "een gearchiveerd account staat wél in het archief",
      archief.tekst.includes(archiefEmail),
      "MIDDEL",
      "in het archief",
      kort(archief, 200)
    );
  }

  groep("Account definitief verwijderen");

  {
    // Iemand met van alles eraan vast: bericht, cijfer, aanwezigheid, koppeling.
    const doelEmail = e("definitief");
    const maak = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: { name: "Definitief Weg", email: doelEmail, password: "WegGeheim123", role: "LEERLING" },
    });
    const id = (maak.body as { id?: string })?.id ?? "";
    if (id) {
      await prisma.klasLeerling.create({ data: { klasId: f.klasA1, leerlingId: id } });
      await prisma.cijfer.create({ data: { waarde: 7, vakId: f.vakA1, leerlingId: id, omschrijving: "Stress weg" } });
      await prisma.aanwezigheid.create({ data: { status: "AANWEZIG", lesId: f.lesA1Verleden, leerlingId: id } });
      await prisma.huiswerkLeerling.create({ data: { huiswerkId: f.huiswerkKlas, leerlingId: id } });
      const origineel = await prisma.bericht.create({
        data: { onderwerp: "Stress weg", inhoud: "hoi", verzenderId: f.docentA1.id, ontvangerId: id },
      });
      await prisma.bericht.create({
        data: { onderwerp: "Stress weg antwoord", inhoud: "terug", verzenderId: id, ontvangerId: f.docentA1.id, replyToId: origineel.id },
      });
      await prisma.ouderLeerling.create({ data: { ouderId: f.ouderA1.id, leerlingId: id } }).catch(() => {});

      {
        const a = await api("DELETE", "/api/admin/archief", {
          token: c.adminA.token,
          body: { type: "gebruiker", id },
        });
        verwacht(
          "een niet-gearchiveerd account kan niet definitief worden verwijderd",
          a.status === 404,
          "HOOG",
          "404 (staat niet in het archief)",
          kort(a, 200)
        );
      }

      await api("DELETE", `/api/gebruikers/${id}`, { token: c.adminA.token });

      {
        const a = await api("DELETE", "/api/admin/archief", {
          token: c.docentA1.token,
          body: { type: "gebruiker", id },
        });
        verwachtGeweigerd("docent verwijdert niets definitief", a);
      }
      {
        const a = await api("DELETE", "/api/admin/archief", {
          token: c.adminA.token,
          body: { type: "gebruiker", id },
        });
        verwachtStatus("definitief verwijderen lukt", a, 200, "HOOG");
      }

      const rest = {
        gebruiker: await prisma.user.count({ where: { id } }),
        cijfer: await prisma.cijfer.count({ where: { leerlingId: id } }),
        aanwezigheid: await prisma.aanwezigheid.count({ where: { leerlingId: id } }),
        huiswerkLeerling: await prisma.huiswerkLeerling.count({ where: { leerlingId: id } }),
        bericht: await prisma.bericht.count({ where: { OR: [{ verzenderId: id }, { ontvangerId: id }] } }),
        klasLeerling: await prisma.klasLeerling.count({ where: { leerlingId: id } }),
        ouderLeerling: await prisma.ouderLeerling.count({ where: { leerlingId: id } }),
        resetToken: await prisma.passwordResetToken.count({ where: { gebruikerId: id } }),
      };
      const wezen = Object.entries(rest).filter(([, n]) => n > 0);
      verwacht(
        "na definitief verwijderen blijft er nergens iets achter",
        wezen.length === 0,
        "KRITIEK",
        "overal 0",
        wezen.map(([k, n]) => `${k}=${n}`).join(", ") || "0"
      );

      const opnieuwMaken = await api("POST", "/api/gebruikers", {
        token: c.adminA.token,
        body: { name: "Definitief Terug", email: doelEmail, password: "WegGeheim123", role: "LEERLING" },
      });
      verwachtStatus(
        "het vrijgekomen e-mailadres kan opnieuw worden gebruikt",
        opnieuwMaken,
        [200, 201],
        "MIDDEL"
      );
    }
  }
  {
    const a = await api("DELETE", "/api/admin/archief", {
      token: c.adminA.token,
      body: { type: "onbekend", id: "x" },
    });
    verwachtValidatiefout("onbekend archieftype geeft een nette fout", a);
  }
  {
    const a = await api("DELETE", "/api/admin/archief", { token: c.adminA.token, body: {} });
    verwachtValidatiefout("archief verwijderen zonder type/id geeft 400", a);
  }

  groep("Gemene invoer in accountvelden");

  for (const g of GEMENE_STRINGS) {
    const a = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: {
        name: g.waarde,
        email: e(`fuzz${Math.random().toString(36).slice(2, 8)}`),
        password: "Geheim12345",
        role: "LEERLING",
        telefoon: g.waarde.slice(0, 30),
      },
    });
    nooitServerfout(`naam "${g.label}" laat de server niet vallen`, a);
  }

  groep("Opruimen van de testaccounts");

  {
    const rommel = await prisma.user.findMany({
      where: { email: { contains: `.${stempel}@` } },
      select: { id: true },
    });
    const ids = rommel.map((r) => r.id);
    if (ids.length > 0) {
      await prisma.bericht.updateMany({
        where: { replyTo: { OR: [{ verzenderId: { in: ids } }, { ontvangerId: { in: ids } }] } },
        data: { replyToId: null },
      });
      await prisma.bericht.deleteMany({ where: { OR: [{ verzenderId: { in: ids } }, { ontvangerId: { in: ids } }] } });
      await prisma.aanwezigheid.deleteMany({ where: { leerlingId: { in: ids } } });
      await prisma.cijfer.deleteMany({ where: { leerlingId: { in: ids } } });
      await prisma.inlevering.deleteMany({ where: { leerlingId: { in: ids } } });
      await prisma.huiswerkLeerling.deleteMany({ where: { leerlingId: { in: ids } } });
      await prisma.ouderLeerling.deleteMany({ where: { OR: [{ ouderId: { in: ids } }, { leerlingId: { in: ids } }] } });
      await prisma.passwordResetToken.deleteMany({ where: { gebruikerId: { in: ids } } });
      await prisma.klasLeerling.deleteMany({ where: { leerlingId: { in: ids } } });
      await prisma.klasDocent.deleteMany({ where: { docentId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.cijfer.deleteMany({ where: { omschrijving: { startsWith: "Stress" } } });
    const over = await prisma.user.count({ where: { email: { contains: `.${stempel}@` } } });
    verwacht("testaccounts opgeruimd", over === 0, "LAAG", "0 over", String(over));
  }

  void WACHTWOORD;
}
