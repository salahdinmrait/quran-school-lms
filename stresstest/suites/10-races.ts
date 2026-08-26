import { api, groep, verwacht, kort, wacht, type Antwoord } from "../lib";
import { prisma } from "../fixture";
import type { Ctx } from "../context";

export const naam = "Gelijktijdigheid: twee handelingen tegelijk";

/** Voert n identieke verzoeken tegelijk uit. */
async function tegelijk(n: number, maak: (i: number) => Promise<Antwoord>): Promise<Antwoord[]> {
  return Promise.all(Array.from({ length: n }, (_, i) => maak(i)));
}

export async function draai(c: Ctx) {
  const f = c.f;
  const stempel = Date.now();

  groep("Twee keer hetzelfde account aanmaken");

  {
    const email = `race.${stempel}@stresstest.local`;
    const antwoorden = await tegelijk(5, () =>
      api("POST", "/api/gebruikers", {
        token: c.adminA.token,
        body: { name: "Race Account", email, role: "LEERLING", actief: true, password: "StressTest123!" },
      })
    );
    const gelukt = antwoorden.filter((a) => a.status >= 200 && a.status < 300).length;
    const serverfouten = antwoorden.filter((a) => a.status >= 500).length;
    const rijen = await prisma.user.count({ where: { email } });

    verwacht(
      "vijf keer tegelijk hetzelfde account aanmaken levert een gebruiker op",
      rijen === 1,
      "KRITIEK",
      "1 rij in de database",
      `${rijen} rijen (${gelukt} verzoeken gelukt)`
    );
    verwacht(
      "de verliezers krijgen een nette 409, geen serverfout",
      serverfouten === 0,
      "HOOG",
      "0 serverfouten",
      `${serverfouten} van de 5 gaven 5xx: ${antwoorden.filter((a) => a.status >= 500).map((a) => kort(a, 80)).join(" | ")}`
    );

    const gemaakteIds = (await prisma.user.findMany({ where: { email }, select: { id: true } })).map((r) => r.id);
    await opruimenGebruikers(gemaakteIds);
  }

  groep("Twee keer tegelijk aanwezigheid registreren");

  {
    await prisma.aanwezigheid.deleteMany({ where: { lesId: f.lesA1Verleden, leerlingId: f.leerlingA3.id } });
    const antwoorden = await tegelijk(6, (i) =>
      api("POST", "/api/docent/absentie", {
        token: c.docentA1.token,
        body: {
          lesId: f.lesA1Verleden,
          leerlingId: f.leerlingA3.id,
          status: i % 2 === 0 ? "AANWEZIG" : "TE_LAAT",
        },
      })
    );
    const rijen = await prisma.aanwezigheid.count({
      where: { lesId: f.lesA1Verleden, leerlingId: f.leerlingA3.id },
    });
    verwacht(
      "zes gelijktijdige registraties geven een rij",
      rijen === 1,
      "KRITIEK",
      "1 rij",
      `${rijen} rijen`
    );
    const serverfouten = antwoorden.filter((a) => a.status >= 500);
    verwacht(
      "gelijktijdig registreren geeft geen serverfout",
      serverfouten.length === 0,
      "HOOG",
      "0 serverfouten",
      serverfouten.map((a) => kort(a, 80)).join(" | ") || "0"
    );
  }

  groep("Twee ouders vechten om hetzelfde kind");

  {
    await prisma.ouderLeerling.deleteMany({ where: { leerlingId: f.leerlingA2.id } });
    const antwoorden = await Promise.all([
      api("POST", "/api/ouder/koppeling", {
        token: c.adminA.token,
        body: { ouderId: f.ouderA1.id, leerlingId: f.leerlingA2.id },
      }),
      api("POST", "/api/ouder/koppeling", {
        token: c.adminA.token,
        body: { ouderId: f.ouderA3.id, leerlingId: f.leerlingA2.id },
      }),
    ]);
    const rijen = await prisma.ouderLeerling.count({ where: { leerlingId: f.leerlingA2.id } });
    verwacht(
      "twee ouders tegelijk koppelen levert precies een koppeling op",
      rijen === 1,
      "KRITIEK",
      "1 koppeling",
      `${rijen} koppelingen`
    );
    const serverfouten = antwoorden.filter((a) => a.status >= 500);
    verwacht(
      "de verliezende ouder krijgt een nette fout",
      serverfouten.length === 0,
      "HOOG",
      "0 serverfouten",
      serverfouten.map((a) => kort(a, 100)).join(" | ") || "0"
    );
    await prisma.ouderLeerling.deleteMany({ where: { leerlingId: f.leerlingA2.id } });
  }

  groep("Huiswerk tegelijk afvinken en weer afvinken");

  {
    await prisma.inlevering.deleteMany({ where: { huiswerkId: f.huiswerkKlas, leerlingId: f.leerlingA2.id } });
    const antwoorden = await tegelijk(6, () =>
      api("POST", "/api/docent/huiswerk/afvinken", {
        token: c.docentA1.token,
        body: { huiswerkId: f.huiswerkKlas, leerlingId: f.leerlingA2.id },
      })
    );
    const rijen = await prisma.inlevering.count({
      where: { huiswerkId: f.huiswerkKlas, leerlingId: f.leerlingA2.id },
    });
    verwacht("zes keer tegelijk afvinken geeft een inlevering", rijen === 1, "KRITIEK", "1 rij", `${rijen} rijen`);
    const serverfouten = antwoorden.filter((a) => a.status >= 500);
    verwacht(
      "gelijktijdig afvinken geeft geen serverfout",
      serverfouten.length === 0,
      "HOOG",
      "0 serverfouten",
      serverfouten.map((a) => kort(a, 80)).join(" | ") || "0"
    );

    // Afvinken en ontvinken door elkaar: de eindtoestand mag geen halve rij zijn.
    await Promise.all([
      api("POST", "/api/docent/huiswerk/afvinken", {
        token: c.docentA1.token,
        body: { huiswerkId: f.huiswerkKlas, leerlingId: f.leerlingA2.id },
      }),
      api("DELETE", "/api/docent/huiswerk/afvinken", {
        token: c.docentA1.token,
        body: { huiswerkId: f.huiswerkKlas, leerlingId: f.leerlingA2.id },
      }),
    ]);
    const na = await prisma.inlevering.count({
      where: { huiswerkId: f.huiswerkKlas, leerlingId: f.leerlingA2.id },
    });
    verwacht("afvinken en ontvinken door elkaar laat hoogstens een rij achter", na <= 1, "HOOG", "0 of 1", String(na));
    await prisma.inlevering.deleteMany({ where: { huiswerkId: f.huiswerkKlas, leerlingId: f.leerlingA2.id } });
  }

  groep("Tegelijk archiveren en gebruiken");

  {
    const email = `race.archief.${stempel}@stresstest.local`;
    const gemaakt = await api("POST", "/api/gebruikers", {
      token: c.adminA.token,
      body: { name: "Race Archief", email, role: "LEERLING", actief: true },
    });
    const id = (gemaakt.body as { id?: string })?.id ?? "";
    if (id) {
      const antwoorden = await Promise.all([
        api("DELETE", `/api/gebruikers/${id}`, { token: c.adminA.token }),
        api("DELETE", `/api/gebruikers/${id}`, { token: c.adminA.token }),
        api("PUT", `/api/gebruikers/${id}`, {
          token: c.adminA.token,
          body: { name: "Race Archief", email, role: "LEERLING", actief: true },
        }),
      ]);
      const serverfouten = antwoorden.filter((a) => a.status >= 500);
      verwacht(
        "twee keer verwijderen plus een wijziging geeft geen serverfout",
        serverfouten.length === 0,
        "HOOG",
        "0 serverfouten",
        serverfouten.map((a) => kort(a, 100)).join(" | ") || "0"
      );
      const rij = await prisma.user.findUnique({ where: { id }, select: { verwijderdOp: true, actief: true } });
      verwacht(
        "het account blijft gearchiveerd, ook na de gelijktijdige wijziging",
        rij?.verwijderdOp != null,
        "HOOG",
        "verwijderdOp gezet",
        JSON.stringify(rij)
      );
      await opruimenGebruikers([id]);
    }
  }

  groep("Veel verzoeken tegelijk");

  {
    const start = Date.now();
    const antwoorden = await tegelijk(40, () => api("GET", "/api/klassen", { token: c.adminA.token }));
    const duur = Date.now() - start;
    const serverfouten = antwoorden.filter((a) => a.status >= 500);
    const netwerkfouten = antwoorden.filter((a) => a.status === 0);
    verwacht(
      "40 gelijktijdige verzoeken geven geen serverfout",
      serverfouten.length === 0,
      "HOOG",
      "0 serverfouten",
      serverfouten.map((a) => kort(a, 80)).join(" | ") || "0"
    );
    verwacht(
      "40 gelijktijdige verzoeken verbreken geen verbindingen",
      netwerkfouten.length === 0,
      "HOOG",
      "0 netwerkfouten",
      `${netwerkfouten.length} verbroken (${duur} ms totaal)`
    );
  }

  groep("Berichten tegelijk versturen");

  {
    const antwoorden = await tegelijk(10, (i) =>
      api("POST", "/api/berichten", {
        token: c.docentA1.token,
        body: {
          doelType: "GEBRUIKERS",
          doelIds: [f.leerlingA1.id],
          onderwerp: `Stress race ${i}`,
          inhoud: "gelijktijdig",
        },
      })
    );
    const serverfouten = antwoorden.filter((a) => a.status >= 500);
    verwacht(
      "tien berichten tegelijk versturen geeft geen serverfout",
      serverfouten.length === 0,
      "HOOG",
      "0 serverfouten",
      serverfouten.map((a) => kort(a, 100)).join(" | ") || "0"
    );
    const aantal = await prisma.bericht.count({ where: { onderwerp: { startsWith: "Stress race" } } });
    verwacht("alle tien berichten zijn aangekomen", aantal === 10, "MIDDEL", "10", String(aantal));
    await prisma.bericht.updateMany({
      where: { replyTo: { onderwerp: { startsWith: "Stress race" } } },
      data: { replyToId: null },
    });
    await prisma.bericht.deleteMany({ where: { onderwerp: { startsWith: "Stress race" } } });
  }

  await wacht(50);
  const rest = await prisma.user.findMany({
    where: { email: { contains: "race." } },
    select: { id: true },
  });
  const restIds = rest.map((r) => r.id);
  if (restIds.length > 0) {
    await opruimenGebruikers(restIds);
  }
}

/** Wist testgebruikers inclusief alles wat er via een sleutel aan hangt. */
async function opruimenGebruikers(ids: string[]) {
  await prisma.passwordResetToken.deleteMany({ where: { gebruikerId: { in: ids } } });
  await prisma.bericht.updateMany({
    where: { replyTo: { OR: [{ verzenderId: { in: ids } }, { ontvangerId: { in: ids } }] } },
    data: { replyToId: null },
  });
  await prisma.bericht.deleteMany({ where: { OR: [{ verzenderId: { in: ids } }, { ontvangerId: { in: ids } }] } });
  await prisma.aanwezigheid.deleteMany({ where: { leerlingId: { in: ids } } });
  await prisma.cijfer.deleteMany({ where: { leerlingId: { in: ids } } });
  await prisma.inlevering.deleteMany({ where: { leerlingId: { in: ids } } });
  await prisma.huiswerkLeerling.deleteMany({ where: { leerlingId: { in: ids } } });
  await prisma.leerlingDossier.deleteMany({
    where: { OR: [{ leerlingId: { in: ids } }, { auteurId: { in: ids } }] },
  });
  await prisma.studieMateriaal.deleteMany({ where: { docentId: { in: ids } } });
  await prisma.hifdhProfiel.deleteMany({ where: { leerlingId: { in: ids } } });
  await prisma.ouderLeerling.deleteMany({
    where: { OR: [{ ouderId: { in: ids } }, { leerlingId: { in: ids } }] },
  });
  await prisma.klasDocent.deleteMany({ where: { docentId: { in: ids } } });
  await prisma.klasLeerling.deleteMany({ where: { leerlingId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
