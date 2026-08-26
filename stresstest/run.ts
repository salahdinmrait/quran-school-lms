/**
 * Stresstest-loop voor Jadwal.
 *
 * Draait alle suites achter elkaar tegen de lokale dev-server en herhaalt dat
 * tot er twee runs op rij zijn zonder ook maar één bevinding. Bij bevindingen
 * stopt de loop met een rapport, zodat er iets te repareren valt.
 */
import "dotenv/config";
import { BASIS, api, reset, uitslag, groep, fout, type Bevinding, type Ernst } from "./lib";
import { controleerVeiligeDatabase, bouwFixture, prisma } from "./fixture";
import { bouwContext, type Ctx } from "./context";

import * as s01 from "./suites/01-auth";
import * as s02 from "./suites/02-autorisatie";
import * as s03 from "./suites/03-import";
import * as s04 from "./suites/04-huiswerk";
import * as s05 from "./suites/05-cijfers";
import * as s06 from "./suites/06-berichten";
import * as s07 from "./suites/07-accounts";
import * as s08 from "./suites/08-aanwezigheid-koppeling";
import * as s09 from "./suites/09-fuzz";
import * as s10 from "./suites/10-races";

interface SuiteModule {
  naam: string;
  draai: (c: Ctx) => Promise<void>;
}

const SUITES: SuiteModule[] = [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10];

const ERNST_VOLGORDE: Ernst[] = ["KRITIEK", "HOOG", "MIDDEL", "LAAG"];
const MAX_RUNS = Number(process.env.STRESS_MAX_RUNS ?? 6);
const ALLEEN = process.env.STRESS_SUITE ?? "";

async function wachtOpServer(): Promise<boolean> {
  for (let poging = 1; poging <= 30; poging++) {
    const a = await api("GET", "/api/klassen");
    // 401 is prima: de server leeft en weigert netjes.
    if (a.status !== 0) return true;
    await new Promise((r) => setTimeout(r, 1000));
    if (poging === 1) console.log(`Wachten op de dev-server op ${BASIS} …`);
  }
  return false;
}

function rapporteer(bevindingen: Bevinding[], gelukt: number, overgeslagen: string[], duurMs: number) {
  console.log("\n" + "═".repeat(74));
  console.log(`RAPPORT — ${gelukt} controles geslaagd, ${bevindingen.length} bevindingen, ` +
              `${overgeslagen.length} overgeslagen (${Math.round(duurMs / 1000)} s)`);
  console.log("═".repeat(74));

  if (bevindingen.length === 0) {
    console.log("Geen bevindingen.");
  }

  for (const ernst of ERNST_VOLGORDE) {
    const groepje = bevindingen.filter((b) => b.ernst === ernst);
    if (groepje.length === 0) continue;
    console.log(`\n${ernst} (${groepje.length})`);
    console.log("─".repeat(74));
    for (const b of groepje) {
      console.log(`• ${b.naam}`);
      console.log(`    waar     : ${b.groep}`);
      console.log(`    verwacht : ${b.verwacht}`);
      console.log(`    gekregen : ${b.gekregen}`);
    }
  }

  if (overgeslagen.length > 0) {
    console.log(`\nOvergeslagen (${overgeslagen.length})`);
    console.log("─".repeat(74));
    for (const o of overgeslagen) console.log(`⊘ ${o}`);
  }
}

async function eenRun(nummer: number): Promise<{ bevindingen: Bevinding[]; gelukt: number; overgeslagen: string[] }> {
  const start = Date.now();
  console.log("\n" + "█".repeat(74));
  console.log(`RUN ${nummer}`);
  console.log("█".repeat(74));

  reset();

  console.log("\nFixture opbouwen …");
  const f = await bouwFixture();
  console.log("Inloggen als elke rol …");
  const c = await bouwContext(f);
  if (!c.dev) {
    console.log("Let op: geen dev-cookie (DEVELOPER_SECRET ontbreekt of klopt niet) — de importsuite slaat zichzelf over.");
  }

  for (const suite of SUITES) {
    if (ALLEEN && !suite.naam.toLowerCase().includes(ALLEEN.toLowerCase())) continue;
    console.log("\n" + "▓".repeat(74));
    console.log(`SUITE — ${suite.naam}`);
    console.log("▓".repeat(74));
    try {
      await suite.draai(c);
    } catch (e) {
      const fout2 = e as Error;
      console.log(`\n!! De suite "${suite.naam}" is gestruikeld: ${fout2.message}`);
      console.log(fout2.stack?.split("\n").slice(1, 4).join("\n") ?? "");
      // Een gestruikelde suite is zelf een bevinding: er is iets dat niet eens
      // tot een antwoord komt.
      groep(suite.naam);
      fout(
        "de suite kon niet worden afgemaakt",
        "HOOG",
        "de suite loopt tot het einde",
        fout2.message
      );
    }
  }

  const u = uitslag();
  rapporteer(u.bevindingen, u.gelukt, u.overgeslagen, Date.now() - start);
  return u;
}

async function main() {
  controleerVeiligeDatabase();

  if (!(await wachtOpServer())) {
    console.error(`\nDe dev-server op ${BASIS} reageert niet. Start hem eerst (npm run dev) en probeer opnieuw.`);
    process.exit(2);
  }

  let schoon = 0;
  let laatste: Bevinding[] = [];

  for (let run = 1; run <= MAX_RUNS; run++) {
    const u = await eenRun(run);
    laatste = u.bevindingen;

    if (u.bevindingen.length === 0) {
      schoon++;
      console.log(`\n✓ Run ${run} is foutloos (${schoon} op rij).`);
      if (schoon >= 2) {
        console.log("\nTwee foutloze runs op rij — de loop stopt hier.");
        await prisma.$disconnect();
        process.exit(0);
      }
    } else {
      schoon = 0;
      console.log(`\n✗ Run ${run} heeft ${u.bevindingen.length} bevindingen. De loop stopt zodat ze gerepareerd kunnen worden.`);
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  console.log(`\nNa ${MAX_RUNS} runs nog geen twee foutloze runs op rij. Laatste stand: ${laatste.length} bevindingen.`);
  await prisma.$disconnect();
  process.exit(1);
}

main().catch(async (e) => {
  console.error("\nDe stresstest is zelf gestruikeld:", e);
  await prisma.$disconnect().catch(() => {});
  process.exit(3);
});
