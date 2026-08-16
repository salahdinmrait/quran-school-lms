# Jadwal — LMS backend (de "motor")

Next.js (App Router) backend voor Jadwal: database, alle API-routes, NextAuth-login,
de developer-console (`/dev`) en de oude web-UI. De mobiele app + webapp
(`quran-school-app`, apart repo) praten allemaal tegen déze backend.

> Voor URL's, wachtwoorden en API-keys: zie `PROJECT-SLEUTELS.md` op
> `Desktop\QuranMagister` (bewust **niet** in git). Dit bestand legt uit **hoe**
> alles werkt; het sleutelbestand zegt **wat** de actuele waarden zijn.

---

## Inhoudsopgave

1. [Architectuur in het kort](#1-architectuur-in-het-kort)
2. [Multi-tenant: hoe een schoolomgeving werkt](#2-multi-tenant-hoe-een-schoolomgeving-werkt)
3. [Van nul naar een werkende school — de volledige flow](#3-van-nul-naar-een-werkende-school--de-volledige-flow)
4. [Authenticatie](#4-authenticatie)
5. [Database-schema (Prisma)](#5-database-schema-prisma)
6. [Alle API-routes](#6-alle-api-routes)
7. [De developer-console (`/dev`)](#7-de-developer-console-dev)
8. [E-mail](#8-e-mail)
9. [Wachtwoord vergeten / reset](#9-wachtwoord-vergeten--reset)
10. [Rate limiting (brute-force-bescherming)](#10-rate-limiting-brute-force-bescherming)
11. [Dagelijkse backups](#11-dagelijkse-backups)
12. [Bestandsbijlagen (uploads)](#12-bestandsbijlagen-uploads)
13. [Soft delete & archief](#13-soft-delete--archief)
14. [Alle environment-variabelen](#14-alle-environment-variabelen)
15. [Lokaal ontwikkelen](#15-lokaal-ontwikkelen)
16. [Deployment](#16-deployment)
17. [Belangrijke afspraken / conventies](#17-belangrijke-afspraken--conventies)

---

## 1. Architectuur in het kort

```
                 ┌──────────────────────────┐
   telefoon /   →│  quran-school-app        │  Expo/React Native
   browser       │  (webapp op Vercel)      │  (apart repo)
                 └────────────┬─────────────┘
                               │ /api/* en /dev/* worden geproxied
                               │ (zie quran-school-app/vercel.json)
                               ▼
                 ┌──────────────────────────┐
                 │  quran-school-lms        │  ← dit repo
                 │  Next.js App Router      │
                 │  - API-routes (app/api)  │
                 │  - /dev-console          │
                 │  - oude web-UI           │
                 └────────────┬─────────────┘
                               │ Prisma
                               ▼
                 ┌──────────────────────────┐
                 │  Neon (serverless        │
                 │  PostgreSQL)             │
                 └──────────────────────────┘
```

- **Twee git-repo's, twee Vercel-projecten:**
  - `quran-school-app` — de app die gebruikers zien (mobiel + webversie via
    react-native-web). Bevat vrijwel geen eigen logica; praat alleen met de API.
  - `quran-school-lms` (dit repo) — "de motor": database, business-logic, alle
    API-routes, e-mail, backups, de developer-console.
- De webapp-URL stuurt `/api/**` en `/dev/**` automatisch door naar dit backend-
  project (rewrite in `quran-school-app/vercel.json`). Daardoor werkt zowel
  `https://quran-school-app.vercel.app/dev` als
  `https://quran-school-lms.vercel.app/dev` — het is dezelfde server.
- **Rolgebaseerd:** vier rollen — `ADMIN`, `DOCENT`, `LEERLING`, `OUDER` — met
  identieke rechten in app én webapp, want beide praten tegen dezelfde,
  serverside gecontroleerde API.

## 2. Multi-tenant: hoe een schoolomgeving werkt

Eén database, meerdere scholen. Elke `School`-rij is een eigen omgeving; bijna
elk model (`User`, `Klas`, `Vak`, ...) heeft een `schoolId`. Een school:

- heeft een unieke `slug` (bv. `al-noor`), gebruikt voor herkenbaarheid in de
  dev-console (niet in de eindgebruikers-URL's — iedereen gebruikt dezelfde
  webapp-URL en logt in met e-mail/wachtwoord);
- kan **gedeactiveerd** worden (`School.actief = false`) — dan kan niemand van
  die school nog inloggen, ook niet met een geldig token/sessie
  (`lib/api-auth.ts` controleert dit niet direct op School, maar via
  `User.actief`/`verwijderdOp`; scholen deactiveren de admin-console gebruikt
  om in bulk gebruikers te deactiveren — zie `app/api/dev/scholen/[id]/route.ts`);
- data blijft strikt gescheiden: elke API-route filtert op `schoolId` van de
  ingelogde gebruiker (helpers in `lib/school-scope.ts`:
  `klasBehoortTotSchool`, `userBehoortTotSchool`) zodat een admin van school A
  nooit klassen/leerlingen van school B kan zien of wijzigen.

`schoolId` is nullable in het schema — dat is legacy uit de tijd vóór
multi-tenant en wordt niet meer gebruikt voor nieuwe scholen.

## 3. Van nul naar een werkende school — de volledige flow

Dit is het end-to-end proces dat wij (developer) doorlopen als een nieuwe
school aansluit:

1. **School aanmaken** — `/dev` → "Nieuwe school" (`app/dev/scholen/nieuw/page.tsx`).
   Vult naam, plaats, contactgegevens in; slug wordt automatisch voorgesteld.
   Optioneel meteen een eerste admin-account. Roept `POST /api/dev/scholen` aan.
2. **Gebruikers aanleveren door de school** — de school stuurt ons een lijst met
   voornaam/achternaam/e-mail/telefoon/rol per persoon (leerlingen, ouders,
   docenten, evt. extra admins).
3. **Bulk-import** — wij downloaden op de schoolpagina in `/dev` de Excel-
   template, vullen die met de aangeleverde gegevens en uploaden het bestand.
   Zie [§7 Excel-import](#excel-import-gebruikers-in-bulk-aanmaken) voor de
   details. Elke rij wordt een account met een gegenereerd wachtwoord en een
   welkomstmail.
4. **Structuur inrichten** — via de webapp (ingelogd als de admin van de
   school): klassen aanmaken, vakken aanmaken, leerlingen/docenten aan klassen
   koppelen, vakken aan klassen koppelen, rooster (lessen) inplannen.
   Dit gaat via de normale admin-schermen in de app, niet via `/dev`.
5. **Gebruikers loggen in** — iedereen klikt de link in hun welkomstmail (of
   logt direct in met het meegestuurde wachtwoord), en kan optioneel meteen
   een eigen wachtwoord kiezen via de link (7 dagen geldig).
6. **Dagelijks gebruik** — huiswerk, cijfers, aanwezigheid, berichten, rooster;
   alles loopt via de API-routes in §6, met rol- en school-scoping.
7. **Achtergrond, automatisch, geen actie nodig:** elke nacht 03:00 UTC een
   versleutelde volledige backup (§11); rate limiting beschermt login/reset
   tegen brute-force (§10).

Als een school stopt: admin-account(s) en/of alle gebruikers archiveren via de
soft-delete/archief-functionaliteit (§13) — niet hard verwijderen.

## 4. Authenticatie

Er zijn **twee** inlogmechanismen die naar dezelfde `User`-tabel en hetzelfde
wachtwoord-hashformaat (bcrypt, 12 rounds) kijken:

### Web (NextAuth, sessie-cookie)
- `lib/auth.ts` — NextAuth v5 (beta) met de **Credentials**-provider.
  `authorize()` zoekt de gebruiker op e-mail, controleert `actief`/
  `verwijderdOp` (gearchiveerde accounts kunnen niet inloggen), vergelijkt het
  wachtwoord met bcrypt, en checkt eerst de rate limiter (§10).
- Sessie-strategie: JWT (`session.strategy = "jwt"`), ondertekend met
  `NEXTAUTH_SECRET`. De sessie bevat `id`, `role`, `schoolId`, `isVolwassen`.
- Gebruikt door de oude web-UI en door API-routes die vanuit de browser worden
  aangeroepen (sessie-cookie wordt automatisch meegestuurd).

### Mobiel + webapp (custom JWT via Bearer-header)
- `app/api/mobile/login/route.ts` — eigen inlog-endpoint, geeft na controle
  (zelfde bcrypt-check + rate limiting) een eigen JWT terug via
  `lib/mobile-jwt.ts` (bibliotheek: **jose**). Token is **30 dagen geldig**,
  ondertekend met **hetzelfde** `NEXTAUTH_SECRET` (bewust — één secret, twee
  loginpaden, altijd consistent).
- De app bewaart dit token met `expo-secure-store` en stuurt het als
  `Authorization: Bearer <token>` mee bij elke API-aanroep.
- `lib/api-auth.ts` → `auth()` is de **gedeelde** functie die elke API-route
  gebruikt: ze accepteert zowel de NextAuth-sessiecookie (web) als de
  Bearer-header (mobiel/webapp) en geeft in beide gevallen hetzelfde
  `{ user: {...} }`-object terug. Routes hoeven dus nooit te weten welk kanaal
  de aanvraag gebruikt.
- **Live account-check bij elk verzoek:** ook al is het token 30 dagen geldig,
  `auth()` doet altijd een DB-lookup (`isAccountActief`) — een gedeactiveerd of
  gearchiveerd account is **direct** buitengesloten, ongeacht een nog geldig
  token.

### Developer-console (`/dev`)
- Apart, simpel mechanisme los van gebruikersaccounts: één gedeeld wachtwoord
  in `DEVELOPER_SECRET`. Zie §7.

## 5. Database-schema (Prisma)

`prisma/schema.prisma` (provider `postgresql`, Neon). Belangrijkste modellen:

| Model | Waarvoor |
|---|---|
| `School` | Eén rij per schoolomgeving (multi-tenant root) |
| `User` | Alle accounts (rol in `role`: ADMIN/DOCENT/LEERLING/OUDER); `telefoon`, `actief`, `isVolwassen`, `verwijderdOp` (soft delete) |
| `LeerlingDossier` | Vrije notities van docenten/admins over een leerling, blijvend |
| `Klas`, `Vak`, `KlasVak`, `KlasDocent`, `KlasLeerling` | Structuur en koppelingen |
| `Cijfer` | Cijfers per leerling/vak, met optionele opmerking + bijlage |
| `Les` | Roosterregel (datum/tijd/lokaal/klas/vak), met optionele bijlage |
| `Aanwezigheid` | Status per leerling per les (AANWEZIG/AFWEZIG/TE_LAAT/GEOORLOOFD) |
| `Huiswerk`, `Inlevering`, `HuiswerkLeerling` | Huiswerk, inleveringen (+docent-feedback), optioneel doelgroep-leerlingen |
| `Bericht` | Berichten tussen gebruikers, met threads (`replyToId`) en optionele bijlage |
| `StudieMateriaal` | Gedeeld materiaal (bestand of link) per klas/vak |
| `OuderLeerling` | Koppeling ouder↔kind; **max 1 ouder per kind** (`@@unique([leerlingId])`) |
| `HifdhProfiel`, `HifdhTaak` | Qor'aan-memorisatie-tracker (voortgang + wekelijkse taken) |
| `LoginPoging` | Rate-limit-teller (zie §10) |
| `PasswordResetToken` | Tokens voor wachtwoord-reset/instellen (zie §9) |

**Bij elke schemawijziging** (afspraak, zie ook het geheugenbestand van de
assistent): pas zowel `prisma/schema.prisma` (postgresql) áls
`prisma/schema.sqlite.bak` (sqlite-variant, voor lokaal draaien) aan, én
schrijf een `prisma/NEON-*.sql`-script dat handmatig in de Neon SQL-editor
gedraaid wordt (er draait geen automatische `prisma migrate deploy` in
productie). Alle nog te draaien scripts staan opgesomd in
`PROJECT-SLEUTELS.md`.

**Soft delete:** `Klas`, `Vak` en `User` hebben `verwijderdOp DateTime?`.
`null` = actief/zichtbaar; een datum = gearchiveerd. Er is bewust **geen**
terugzet-functie — alleen definitief verwijderen kan (alleen ADMIN, via
`/api/admin/archief`).

## 6. Alle API-routes

Alle routes staan onder `app/api/**` (Next.js Route Handlers). Tenzij anders
vermeld: vereisen een geldige sessie/token (§4) en filteren op rol + school.

### Auth & account
| Route | Methode | Doel |
|---|---|---|
| `api/auth/[...nextauth]` | — | NextAuth-handler (web-login/sessie) |
| `api/mobile/login` | POST | Login voor app/webapp → eigen JWT (rate-limited) |
| `api/auth/forgot-password` | POST | Stuurt reset-mail als het e-mailadres bestaat (rate-limited, anti-enumeration) |
| `api/auth/reset-password` | POST | Wisselt een geldig token in voor een nieuw wachtwoord |

### Gebruikersbeheer (admin)
| Route | Methode | Doel |
|---|---|---|
| `api/gebruikers` | GET/POST | Lijst / nieuw account aanmaken binnen eigen school |
| `api/gebruikers/[id]` | GET/PUT | Ophalen / bewerken (incl. `telefoon`) |
| `api/search/leerling` | GET | Leerling zoeken (bv. voor ouder-koppeling) |
| `api/ouder/koppeling` | — | Ouder↔kind koppelen (max 1 ouder-regel) |

### Klassen, vakken, rooster
| Route | Methode | Doel |
|---|---|---|
| `api/klassen`, `api/klassen/[id]` | GET/POST/PUT | Klassen CRUD |
| `api/klassen/[id]/leerlingen`, `/docenten`, `/vakken` | GET/POST | Koppelingen beheren |
| `api/klassen/[id]/ranking` | GET | Klassement (gemiddelde cijfers) |
| `api/vakken`, `api/vakken/[id]` | GET/POST/PUT | Vakken CRUD |
| `api/lessen`, `api/lessen/[id]` | GET/POST/PATCH/DELETE | Rooster/lessen. GET geeft per les `hasBijlage` + `huiswerkAantal` (nooit de base64 `bijlageData`). PATCH accepteert ook `datum`. DELETE wist de aanwezigheid van die les en ontkoppelt het huiswerk (`lesId: null`) in plaats van het te verwijderen |

### Docent
| Route | Doel |
|---|---|
| `api/docent/klassen` | Eigen klassen |
| `api/docent/lessen` | Eigen roosterregels (incl. `vak`, `hasBijlage`, `huiswerkAantal`; zonder `bijlageData`) |
| `api/docent/cijfers`, `/cijfers/[id]` | Cijfers invoeren/bewerken |
| `api/docent/absentie` | Aanwezigheid registreren |
| `api/docent/huiswerk`, `/huiswerk/[id]` | Huiswerk aanmaken/bewerken |
| `api/docent/huiswerk/afvinken` | Inlevering aftekenen + feedback |
| `api/docent/huiswerk/inleveringen/[id]` | Eén inlevering bekijken |
| `api/docent/statistieken` | Overzicht per klas/vak |

### Leerling
| Route | Doel |
|---|---|
| `api/leerling/dashboard` | Startscherm-overzicht |
| `api/leerling/cijfers`, `/ranking` | Eigen cijfers + klassement |
| `api/leerling/huiswerk`, `/inlevering` | Huiswerk bekijken + inleveren |
| `api/leerling/lessen`, `/absentie` | Rooster + eigen aanwezigheid |
| `api/leerling/contacten` | Beschikbare berichten-contacten |

### Ouder
| Route | Doel |
|---|---|
| `api/ouder/kind` | Gekoppelde kind(eren) |
| `api/ouder/huiswerk`, `/lessen` | Meevolgen van het kind |
| `api/ouder/berichten` | Berichten met docent(en) van het kind |

### Gedeeld
| Route | Doel |
|---|---|
| `api/berichten`, `/berichten/[id]` | Berichten versturen/lezen (alle rollen, rechten server-side) |
| `api/studiemateriaal` | Materiaal delen/bekijken |
| `api/leerling-dossier` | Dossiernotities lezen/schrijven (docent/admin) |
| `api/upload` | Bestand uploaden naar Vercel Blob |
| `api/bijlage/[id]`, `api/attachment/[type]/[id]` | Bijlage beveiligd opvragen |

### Admin-only
| Route | Doel |
|---|---|
| `api/admin/archief` | Archiveren/definitief verwijderen (soft delete) |
| `api/admin/statistieken` | Schoolbrede statistieken |
| `api/admin/berichten-data` | Data voor het berichten-beheerscherm |

### Developer-console (`/api/dev/**`) — apart auth-mechanisme, zie §7
| Route | Methode | Doel |
|---|---|---|
| `api/dev/login` | POST | Inloggen met `DEVELOPER_SECRET` (rate-limited) |
| `api/dev/scholen` | GET/POST | Scholen listen / nieuwe school aanmaken |
| `api/dev/scholen/[id]` | GET/PATCH/DELETE | Schooldetails / (de)activeren / **definitief verwijderen** (zie §13) |
| `api/dev/scholen/[id]/accounts` | GET | Alle accounts van die school |
| `api/dev/scholen/[id]/import` | POST | **Excel bulk-import**, zie §7 |
| `api/dev/import-template` | GET | Download het Excel-sjabloon |

### Achtergrondtaken
| Route | Methode | Doel |
|---|---|---|
| `api/cron/backup` | GET | Dagelijkse versleutelde backup (§11), alleen via `Authorization: Bearer CRON_SECRET` |

## 7. De developer-console (`/dev`)

Bedoeld voor ons (developer), niet voor scholen. Login op `/dev/login` met het
gedeelde `DEVELOPER_SECRET`-wachtwoord (`lib/dev-auth.ts`,
`lib/dev-token.ts`) → HTTP-only cookie. API-routes onder `/api/dev/**`
accepteren zowel die cookie (browser) als een `x-dev-secret`-header (scripts).

Functionaliteit op `/dev`:
- **Scholen overzicht + nieuwe school aanmaken** (naam, slug, contactgegevens,
  optioneel meteen een eerste admin).
- **Schoolpagina** (`/dev/scholen/[id]`): accountlijst, school (de)activeren,
  de Excel-import, en onderaan een **Gevarenzone** om de school definitief te
  verwijderen (zie §13).

### Excel-import (gebruikers in bulk aanmaken)

1. Download het sjabloon via de knop op de schoolpagina
   (`GET /api/dev/import-template`, gegenereerd on-the-fly met **exceljs**):
   kolommen **Voornaam | Achternaam | E-mailadres | Telefoonnummer | Rol**,
   met een voorbeeldrij en een instructieblad. Rol-kolom heeft een dropdown
   (LEERLING/OUDER/DOCENT/ADMIN) voor de eerste 1000 rijen.
2. Vul het bestand met de door de school aangeleverde gegevens.
3. Upload het op de schoolpagina → `POST /api/dev/scholen/[id]/import`
   (multipart formData, veld `bestand`).
4. Per rij:
   - validatie: voornaam verplicht, geldig e-mailformaat, geldige rol, geen
     dubbele e-mails binnen het bestand;
   - bestaat het e-mailadres al in de DB → rij overgeslagen;
   - anders: account aangemaakt (`name` = voornaam + achternaam, wachtwoord
     via `generatePassword()`, bcrypt 12 rounds, `telefoon`, `schoolId`),
     een `PasswordResetToken` met **7 dagen** geldigheid, en een welkomstmail
     (§8) met inloggegevens + "kies je eigen wachtwoord"-link.
   - 600ms pauze tussen mails (Resend-snelheidslimiet); `maxDuration = 300`
     (Vercel), dus **±150 rijen per upload** is de praktische bovengrens.
5. Resultaat per rij terug in de UI: aangemaakt / overgeslagen / fout, met
   reden. Gegenereerde wachtwoorden worden éénmalig getoond (staan ook in de
   mail).

De voorbeeldrij in het sjabloon (`ahmed@voorbeeld.nl`) wordt altijd
overgeslagen, ook al staat dat adres niet in de database.

## 8. E-mail

`lib/email.ts` — **nodemailer**, verstuurt via **Resend**'s SMTP-interface
(niet de Resend SDK — bewust, zodat bestaande code ongewijzigd bleef):
`smtp.resend.com:465`, user `resend`, wachtwoord = Resend API-key. Env-vars:
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

Zijn de SMTP-env-vars niet gezet, dan wordt een mail **niet verstuurd maar
gelogd** (`console.log`, zichtbaar in Vercel → Functions → Logs) — handig voor
lokaal testen zonder een echte mailserver.

Templates:
- **`welkomstEmail()`** — gebruikt bij Excel-import: uitleg over het Jadwal-
  account, e-mail + tijdelijk wachtwoord, knop "Kies je eigen wachtwoord"
  (7 dagen geldig), link naar de webapp (`WEBAPP_URL`).
- **`passwordResetEmail()`** — de klassieke "wachtwoord vergeten"-flow (§9),
  1 uur geldig.

Beide wachtwoordknoppen linken naar **de webapp** (`lib/urls.ts` →
`wachtwoordInstellenUrl()`), niet naar een LMS-pagina — zie §9.
- **`berichtNotificatieEmail()`** — melding bij een nieuw bericht.

### Huisstijl van de mails

Alle drie de templates delen één `mailLayout()`-functie met de Jadwal-
huisstijl: table-based HTML met inline styles (600px, mobiele fallback onder
620px, Outlook-proof knoppen), terracotta accent `#9D5148` op bone `#FAF7F2` —
dezelfde kleuren als `lib/theme.ts` in de app-repo, zodat mail en app één
geheel vormen. Hulpfuncties: `alinea()`, `kleineTekst()`, `paneel()` (uitgelicht
blok met labelkop) en `knop()`.

Twee dingen om te weten:
- Namen en schoolnamen komen uit vrije invoer (o.a. de Excel-import) en worden
  door `esc()` ge-escaped voordat ze in de HTML belanden.
- De footer toont alleen een postadres als **`MAIL_AFZENDER_ADRES`** is gezet.
  Is die leeg, dan staat er geen adres in de mail — er wordt bewust geen adres
  verzonnen. Voor transactionele mail is dit niet verplicht; zet het wel als je
  ooit nieuwsbrieven gaat sturen.

Setup-stappen (domein kopen, Resend-account, DNS/SPF/DKIM, API-key) staan in
`Desktop\QuranMagister\INSTRUCTIES-EMAIL-EN-BACKUP.md`.

## 9. Wachtwoord vergeten / reset

Twee ingangen, zelfde `PasswordResetToken`-tabel:

1. **Gebruiker vergeet wachtwoord** — "Wachtwoord vergeten?"-link in zowel de
   app (`wachtwoord-vergeten.tsx`) als de backend-loginpagina
   (`app/(auth)/login/wachtwoord-vergeten/page.tsx`) → e-mail invullen →
   `POST /api/auth/forgot-password`. Geeft **altijd** een succesmelding terug,
   ongeacht of het adres bestaat (anti-enumeration) en negeert
   inactieve/gearchiveerde accounts. Token: **1 uur** geldig.
2. **Bulk-import welkomstmail** — zelfde tokenmechanisme, maar **7 dagen**
   geldig (§7).

Beide links wijzen naar **de webapp**, niet naar de LMS:
`{WEBAPP_URL}/wachtwoord-instellen?token=…`. Daar staat het scherm met de
huisstijl; na het opslaan stuurt de app door naar haar eigen inlogpagina.
Het scherm werkt in elke browser, dus ook als de gebruiker de link op een
ander apparaat opent dan waar de app op staat.

Alle uitgaande links worden gebouwd in **`lib/urls.ts`** (`WEBAPP_URL` +
`wachtwoordInstellenUrl(token)`) — één plek, zodat mail en import niet uit
elkaar kunnen lopen.

De oude LMS-pagina `app/(auth)/login/reset-password` bestaat nog, maar doet
alleen nog een `redirect()` naar de app: eerder verstuurde mails blijven zo
werken.

Het scherm in de app post naar `POST /api/auth/reset-password` met het token +
nieuw wachtwoord. Een token is eenmalig bruikbaar (`gebruikt: true` na gebruik)
en verloopt op `verlooptOp`.

## 10. Rate limiting (brute-force-bescherming)

`lib/rate-limit.ts` — DB-gebaseerd (fixed window) via de `LoginPoging`-tabel,
géén externe dienst (Upstash e.d.) nodig; werkt daardoor ook betrouwbaar
serverless (elke Vercel-instantie deelt dezelfde database als "geheugen").

Kernfuncties: `telPogingen(sleutel, vensterMinuten)`,
`registreerPoging(sleutel)`, `wisPogingen(sleutel)`, `clientIp(headers)`
(leest `x-forwarded-for`).

| Plek | Limiet |
|---|---|
| Web-login (`lib/auth.ts`) | 5 mislukte pogingen per e-mail per 15 min |
| App/webapp-login (`api/mobile/login`) | 5 per e-mail + 20 per IP per 15 min |
| Wachtwoord vergeten (`api/auth/forgot-password`) | 3 per e-mail + 10 per IP per uur |
| Developer-login (`api/dev/login`) | 10 per IP per 15 min |

Alleen **mislukte** pogingen tellen mee; bij een geslaagde login worden de
tellers voor dat e-mailadres gewist. Bewust **fail-open** ontworpen: als de
`LoginPoging`-tabel (nog) niet bestaat of een query faalt, wordt dat gelogd en
mag inloggen gewoon doorgaan — een storing in de limiter mag nooit de hele
site onbereikbaar maken. Oude rijen (>1 dag) worden dagelijks opgeruimd door
de backup-cron.

## 11. Dagelijkse backups

`app/api/cron/backup/route.ts`, getriggerd door **Vercel Cron**
(`vercel.json`, elke nacht 03:00 UTC). Beveiligd met
`Authorization: Bearer <CRON_SECRET>` (Vercel zet die header automatisch mee
bij cron-aanroepen; handmatig testen kan met dezelfde header).

Werking:
1. Alle tabellen parallel exporteren (`Promise.all` van `findMany()`):
   scholen, gebruikers, klassen, vakken, koppeltabellen, lessen, aanwezigheid,
   huiswerk, inleveringen, cijfers, berichten, studiemateriaal,
   ouder-koppelingen, dossiers, hifdh-profielen/taken.
2. Alles in één JSON-envelope (`{ versie, gemaaktOp, data }`), gzip
   (Node `zlib`), en **versleuteld met AES-256-GCM** — sleutel = SHA-256-hash
   van `BACKUP_SECRET`, formaat `[12-byte iv][16-byte auth-tag][ciphertext]`.
   Versleuteling is nodig omdat Vercel Blob-URL's "publiek maar moeilijk te
   raden" zijn, niet echt privé.
3. Upload naar **Vercel Blob** (`@vercel/blob`) als
   `backups/jadwal-backup-YYYY-MM-DD.json.gz.enc`.
4. Opruimen: blobs ouder dan **30 dagen**, `LoginPoging`-rijen ouder dan 1 dag,
   verlopen `PasswordResetToken`-rijen ouder dan 30 dagen.

⚠️ **`BACKUP_SECRET` kwijt = alle bestaande backups onbruikbaar** (encryptie
kan niet ongedaan gemaakt worden zonder de sleutel). Bewaar een kopie op een
tweede plek.

**Terugzetten:** `scripts/herstel-backup.ts` —
`npx tsx scripts/herstel-backup.ts <pad-of-url>` met `DATABASE_URL` en
`BACKUP_SECRET` als env-vars. Ontsleutelt, ontgzipt, en zet elke tabel terug
met `createMany({ skipDuplicates: true })` in FK-volgorde; `Bericht` (met
zelfverwijzende `replyToId`) wordt eerst zonder replies ingezet en daarna per
bericht bijgewerkt. Stap-voor-stap in
`Desktop\QuranMagister\INSTRUCTIES-EMAIL-EN-BACKUP.md`.

## 12. Bestandsbijlagen (uploads)

- Kleine bijlagen (foto's/pdf's, tot 4 MB) via de app: base64 in het model
  zelf (`bijlageData`) als legacy-fallback.
- Grotere bestanden (video's tot 500 MB) en nieuwe uploads via de webapp:
  `api/upload` → **Vercel Blob**, publieke maar niet-raadbare URL in
  `bijlageUrl`.
- Bijlagen opvragen gaat via `api/bijlage/[id]` / `api/attachment/[type]/[id]`
  — deze routes checken eerst of de ingelogde gebruiker toegang mag hebben
  (zelfde rol/school-scoping als de rest van de API) voordat het bestand
  wordt vrijgegeven.

## 13. Soft delete & archief

`Klas`, `Vak`, `User` hebben `verwijderdOp DateTime?`. Archiveren zet dit veld,
records blijven in de database maar verdwijnen uit normale lijsten/queries.
Alleen **ADMIN** kan via `api/admin/archief` iets definitief verwijderen.
Er is **bewust geen terugzet-knop** — dit is een vaste productieafspraak.

Een kind heeft **maximaal 1 ouder-account** (`OuderLeerling.leerlingId` is
`@unique`) — ook een vaste afspraak, niet zomaar in de code te herkennen.

### Een hele school definitief verwijderen

`DELETE /api/dev/scholen/[id]` (dev-console, Gevarenzone onderaan de
schoolpagina) verwijdert de school **en alle bijbehorende data** echt uit de
database: accounts, klassen, vakken, lessen, cijfers, huiswerk, inleveringen,
aanwezigheid, berichten, dossiers, hifdh-profielen, studiemateriaal en
koppelingen. Dit is géén soft delete en er is geen terugzet-knop — herstel kan
alleen nog uit een nachtelijke backup van vóór het verwijderen (§11).

Beveiliging en werking:
- alleen bereikbaar met dev-authenticatie (`isDevAuthenticated()`);
- de aanroeper moet de **slug van de school exact meesturen** in de body
  (`{ "bevestiging": "<slug>" }`); de UI laat je die overtypen;
- de opschoning gebeurt in foreign-key-veilige volgorde (kinderen eerst,
  `Bericht.replyToId` wordt eerst losgeknipt omdat die naar zichzelf verwijst);
- bewust **geen** lange transactie: die is op serverless Neon kwetsbaar voor
  timeouts. Bij een halve mislukking is de route gewoon opnieuw aan te roepen —
  al verwijderde rijen zijn dan een no-op.

**Deactiveren blijft de normale route.** Definitief verwijderen is bedoeld voor
testscholen en voor een school die stopt en om verwijdering van haar gegevens
vraagt (AVG-recht op verwijdering).

## 14. Alle environment-variabelen

Ingesteld in Vercel → project **quran-school-lms** → Settings → Environment
Variables. Actuele waarden staan (bewust buiten git) in
`Desktop\QuranMagister\PROJECT-SLEUTELS.md`.

| Variabele | Waarvoor |
|---|---|
| `DATABASE_URL` | Neon Postgres-connectiestring (pooled) |
| `DIRECT_URL` | Neon-connectiestring zonder pooling (voor migraties, optioneel) |
| `NEXTAUTH_SECRET` | Ondertekent web-sessies **én** mobiele JWT's (zelfde secret, twee kanalen) |
| `NEXTAUTH_URL` | Basis-URL voor door NextAuth gegenereerde links |
| `DEVELOPER_SECRET` | Wachtwoord voor `/dev` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Resend SMTP-interface voor alle uitgaande mail |
| `WEBAPP_URL` | Basis-URL van de webapp — álle links in uitgaande mail (welkomstmail, wachtwoord instellen, inloggen) wijzen hierheen, via `lib/urls.ts` |
| `MAIL_AFZENDER_ADRES` | Optioneel — postadres in de mailfooter; leeg = geen adres tonen (§8) |
| `CRON_SECRET` | Beveiligt `/api/cron/backup` (Vercel Cron stuurt dit automatisch mee) |
| `BACKUP_SECRET` | AES-256-sleutel voor backup-versleuteling — **kwijt = backups onbruikbaar** |
| `BLOB_STORE_ID` | Automatisch gezet door Vercel bij het koppelen van een Blob-store; samen met het door Vercel zelf beheerde `VERCEL_OIDC_TOKEN` (OIDC, geen zichtbare env var) genoeg om vanaf Vercel te schrijven/lezen — géén losse `BLOB_READ_WRITE_TOKEN` nodig |

Zonder SMTP-vars werkt alles nog steeds — mails worden dan alleen gelogd
(§8). Zonder `CRON_SECRET`/`BACKUP_SECRET` slaat de backup-route direct af
met een foutmelding (geen halve/onversleutelde backup mogelijk).

## 15. Lokaal ontwikkelen

```bash
npm install
npm run dev          # http://localhost:3000
```

Voor lokaal werken zonder de productie-Neon-database aan te raken: gebruik
`prisma/schema.sqlite.bak` (kopieer naar `schema.prisma`, provider op
`sqlite` zetten) of wijs `DATABASE_URL` tijdelijk naar een losse
Neon-branch/database. Seed-scripts: `prisma/seed.ts`, `prisma/seed-demo.ts`,
`prisma/seed-testschool.ts` (`npx tsx prisma/seed-testschool.ts`).

Zonder SMTP-env-vars verschijnen mails in de terminal-output (`console.log`)
in plaats van dat ze echt verstuurd worden.

## 16. Deployment

Beide Vercel-projecten bouwen automatisch bij een push naar `master`
(GitHub-integratie) — **geen handmatige export/deploy-stap nodig**.
`vercel.json` in dit repo bevat alleen de cron-configuratie; de
build-instellingen zelf staan in het Vercel-dashboard (standaard
Next.js-build).

## 17. Belangrijke afspraken / conventies

Deze staan niet (volledig) in de code en moeten bij nieuwe features
gerespecteerd worden:

- **Nederlandstalig**: alle code, comments, UI-teksten, veldnamen
  (`verwijderdOp`, `gebruiker`, `sleutel`, ...) zijn consequent Nederlands.
- **Schemawijziging** → altijd `schema.prisma` + `schema.sqlite.bak` +
  een `prisma/NEON-*.sql`-script voor handmatig draaien in Neon.
- **Soft delete, nooit hard delete** vanuit de gewone UI; alleen ADMIN via het
  archief-endpoint kan definitief verwijderen.
- **Max 1 ouder per kind.**
- **Rate limiting is fail-open**: een storing in de limiter mag login nooit
  breken.
- **Backups zijn versleuteld**; `BACKUP_SECRET` is kritiek en niet
  herstelbaar bij verlies.
- Zie ook `Desktop\QuranMagister\ERD.md`,
  `Desktop\QuranMagister\TECHNISCHE-REVIEW.md` en
  `Desktop\QuranMagister\INSTRUCTIES-EMAIL-EN-BACKUP.md` voor aanvullende
  achtergrond en stap-voor-stap instructies.
