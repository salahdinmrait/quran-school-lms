# Stresstest

Een zelfstandige testloop die de API van buitenaf aanvalt: elke suite logt in als
echte gebruikers (mobiele JWT) en vuurt gewone `fetch`-verzoeken af, precies zoals
de app dat doet. Geen mocks, geen interne functies — alleen de HTTP-grens.

De loop stopt vanzelf na **twee foutloze runs op rij**.

## Draaien

De test heeft een lokale SQLite-database nodig; `stresstest/context.ts` breekt af
zodra `DATABASE_URL` niet met `file:` begint, zodat er nooit per ongeluk tegen
Neon wordt getest.

```bash
npx prisma generate --schema prisma/schema.sqlite.bak
```

```bash
npx tsx stresstest/run.ts
```

Daarna de gewone client terugzetten (`schema.prisma` is postgresql):

```bash
npx prisma generate
```

Knoppen: `STRESS_MAX_RUNS=1` voor één run, `STRESS_SUITE=cijfers` om op naam te
filteren.

## Wat er getest wordt

| Suite | Onderwerp |
|---|---|
| 01-auth | inloggen, rate limiting, wachtwoord vergeten/instellen, tokens |
| 02-autorisatie | schoolgrens, rol-grenzen, id's raden op elke route |
| 03-import | dev-console, school aanmaken, Excel-import, inloggegevens versturen |
| 04-huiswerk | aanmaken, doelleerlingen, afvinken, verwijderen |
| 05-cijfers | invoeren, wijzigen, verwijderen, eigenaarschap |
| 06-berichten | wie mag wie aanschrijven, groepsberichten, antwoorden |
| 07-accounts | aanmaken, wijzigen, rollen, wachtwoorden, verwijderen |
| 08-aanwezigheid-koppeling | aanwezigheid, ouderkoppeling, klassen, vakken, lessen |
| 09-fuzz | rommel-id's, rommel-querystrings, onbekende methodes |
| 10-races | dezelfde handeling vijf keer tegelijk |

## Bekende overslag

`/api/search/leerling` zoekt hoofdletterongevoelig (`mode: "insensitive"`). Dat is
Postgres-only; op SQLite geeft de route een 500. De suite merkt dat aan het begin
op en slaat de zoekcontroles over in plaats van er een bevinding van te maken.
