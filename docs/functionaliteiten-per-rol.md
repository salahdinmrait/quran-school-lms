# QuranMagister — Functionaliteiten per rol

Geldt voor zowel de **website** als de **mobiele app** (iOS & Android), tenzij anders vermeld. Alle rechten worden server-side afgedwongen: site en app praten tegen dezelfde API, en elke school ziet uitsluitend haar eigen data.

---

## 👑 Admin (schoolbeheerder)

### Dashboard
- Vier tellers: actieve leerlingen, actieve docenten, klassen, vakken — alleen van de eigen school
- **Leerling zoeken** (site): zoekbalk die live zoekt op naam/e-mail en doorklikt naar het leerlingprofiel
- Snelkoppelingen naar vak/gebruiker/klas aanmaken

### Gebruikers
- **Aanmaken**: naam, e-mailadres (uniek), wachtwoord (minimaal 8 tekens), rol (Leerling / Ouder / Docent / Admin). Het account hoort automatisch bij de eigen school en kan direct inloggen op site én app
- **Bewerken**: naam, e-mail en rol wijzigen; status op **Actief/Inactief** zetten (inactief = kan niet meer inloggen, data blijft bewaard)
- **Wachtwoord resetten**: nieuw wachtwoord instellen voor elke gebruiker (min. 8 tekens)
- **Verwijderen**: definitief, met bevestiging. Je kunt jezelf niet verwijderen
- **Ouder-kind koppeling**: bij een gebruiker met rol Ouder koppel je één of meer leerlingen als "kind". Pas daarna ziet de ouder iets en wordt hij bereikbaar via "ouders van klas"-berichten. Ontkoppelen kan per kind
- Filteren op rol (app: chips Alle/Leerlingen/Ouders/Docenten/Admins)

### Klassen
- **Aanmaken**: naam (verplicht) + beschrijving
- **Hernoemen**: naam en beschrijving achteraf wijzigen
- **Leerlingen inschrijven**: multi-select met zoekveld — meerdere leerlingen aanvinken en in één keer inschrijven (al ingeschreven leerlingen worden overgeslagen). **Ontkoppelen** per leerling met bevestiging; op de site ook bulk-verwijderen via selectiemodus
- **Docenten koppelen/ontkoppelen**: een gekoppelde docent ziet die klas in "mijn klassen" en kan er lessen, huiswerk, cijfers en absentie voor beheren
- **Vakken koppelen/ontkoppelen**: bepaalt welke vakken docenten kunnen kiezen bij huiswerk/cijfers in die klas
- **Klas verwijderen**: met bevestiging — verwijdert ook alle lessen, huiswerk, inleveringen en aanwezigheidsregistraties van die klas (onomkeerbaar)

### Vakken
- **Aanmaken**: naam + categorie (Hifdh, Tajweed, Arabisch, Fiqh, Sira, Overig) + beschrijving
- **Bewerken**: alle drie de velden
- **Verwijderen**: alleen mogelijk als het vak aan géén klas gekoppeld is — anders volgt een foutmelding met het aantal koppelingen dat eerst weggehaald moet worden

### Rooster
- **Les aanmaken**: klas (verplicht), vak (optioneel), datum, begintijd, eindtijd, lokaal (optioneel)
- **Wekelijks herhalen**: vul een einddatum in en er wordt voor elke week op dezelfde dag een les aangemaakt (bijv. elke zondag t/m 20 december = ±25 losse lessen in één keer)
- **Les verwijderen**: per les, met bevestiging (verwijdert ook de aanwezigheidsregistraties van die les)

### Berichten
- Drie tabbladen: **Inbox** (met ongelezen-teller), **Verzonden**, **Nieuw**
- Versturen naar, met **multi-select + zoekveld + "Alles/Niets"**:
  1. **Specifieke leerling(en)** — meerdere tegelijk aanvinken
  2. **Hele klas (leerlingen)** — alle leerlingen van één klas
  3. **Specifieke ouder(s)** — met vermelding van welk kind
  4. **Alle ouders van een klas**
  5. **Specifieke docent(en)**
- Elk bericht heeft onderwerp + inhoud. Groepsberichten staan in "Verzonden" als één regel ("→ Klas 1A (leerlingen), 12×")
- **Threads**: reacties verschijnen onder het origineel; in de inbox zie je bij een antwoord ook het originele bericht als context. Reageren kan direct vanuit het geopende bericht

### Statistieken
- Totalen (leerlingen/docenten/klassen/vakken)
- **Per klas**, met kleurcodes (groen/oranje/rood):
  - Aanwezigheid % (groen ≥ 80%, oranje ≥ 60%)
  - Gemiddeld cijfer (groen ≥ 5.5, oranje ≥ 4)
  - Huiswerk-inleverpercentage (groen ≥ 70%, oranje ≥ 40%)
- Vakken per categorie

---

## 🧑‍🏫 Docent

### Mijn klassen
- Alleen klassen waaraan de admin de docent gekoppeld heeft, met per klas: vakken (badges), alle leerlingen, en de gekoppelde ouders ("ouder van …")

### Huiswerk
- **Aanmaken**: titel (verplicht) → beschrijving → deadline (datum) → **klas kiezen** → **vak** (alleen vakken van die klas) → optioneel **koppelen aan een les** (alleen lessen van die klas) → optioneel **bijlage**
- **Bijlagen**:
  - **Via de site**: foto, video, audio, PDF, Word, tekst — tot **500 MB** (met voortgangsbalk); ideaal voor recitatie-video's
  - **Via de app**: foto, PDF, audio, video tot **4 MB**; voor grote video's verwijst de app naar de site
- **Aftekenen per leerling**: open een opgave → lijst van alle leerlingen waarvoor het geldt (de klas van de gekoppelde les, anders alle eigen klassen met dat vak) → per leerling "Aftekenen". **Terugdraaien kan** (nogmaals tikken). Bovenaan een voortgangsbadge zoals "7/12"
- **Opmerking per leerling**: bij elke afgevinkte leerling kan een opmerking geschreven en later bewerkt worden — zichtbaar voor de leerling en diens ouders
- **Verwijderen**: hele opgave inclusief afvinkstatussen, met bevestiging
- Titel/inhoud achteraf bewerken kan niet — verwijderen en opnieuw aanmaken
- **Klassement**: top 3 leerlingen per klas (🥇🥈🥉) op inleverpercentage, met klas-wissel bij meerdere klassen

### Cijfers
- **Invoeren**: klas → leerling (uit die klas) → vak (van die klas) → cijfer **1–10** (decimalen zoals 7.5 toegestaan) → omschrijving (bijv. "Tajweed-toets")
- **Verwijderen**: per cijfer met bevestiging. Bewerken = verwijderen + opnieuw invoeren
- Overzicht van alle ingevoerde cijfers, kleurgecodeerd (groen ≥ 5.5, rood eronder)

### Absentie
- Les selecteren → per leerling één van vier statussen: **Aanwezig / Afwezig / Te laat / Geoorloofd**
- Een status kan altijd gewijzigd worden (laatste keuze telt)

### Rooster
- Eigen lessen (gegroepeerd op datum), **les aanmaken** voor eigen klassen — zelfde velden als admin inclusief **wekelijks herhalen tot einddatum** — en **les verwijderen**
- Op de site: per les ook het gekoppelde huiswerk bekijken en direct huiswerk aan die les toevoegen

### Berichten
- Identiek aan admin, behalve: geen "docenten"-doel, en alleen **eigen klassen** als bereik (leerlingen/ouders van de eigen klassen)

---

## 🧕 Leerling

- **Dashboard**: komende lessen, openstaand huiswerk en recente cijfers
- **Huiswerk**: gesplitst in **Open** en **Afgerond**; per opgave titel, vak, deadline ("verlopen"-badge als voorbij), beschrijving, **bijlage downloaden/openen**, en na aftekenen: datum + de **opmerking van de docent**. De leerling kan zelf níets afvinken — dat doet de docent in de les
- **Klassement**: top 3 van de klas + **eigen positie en percentage** ("Jouw positie: #5 · 40% ingeleverd")
- **Cijfers**: alle cijfers met vak, datum en omschrijving
- **Rooster**: eigen lessen met tijd en lokaal
- **Absentie**: eigen aanwezigheidshistorie per les
- **Berichten**: ⚠️ kan **niet zelf een gesprek beginnen** — alleen **reageren** op berichten van docent/admin. De volledige thread (origineel + alle reacties) is voor beide kanten zichtbaar

---

## 👨‍👩‍👧 Ouder

- Alles is **per kind** — bij meerdere gekoppelde kinderen kies je bovenaan welk kind
- **Voortgang**: cijfers en aanwezigheidsoverzicht van het kind
- **Huiswerk meevolgen**: alle opgaven met status (open/afgerond), deadlines, bijlagen én de opmerkingen die de docent bij het kind schreef
- **Rooster**: de lessen van het kind
- **Berichten**: kan zelf **gesprekken beginnen met de docenten van het kind**, ontvangt klas-/oudersberichten van docent en admin, en kan overal op reageren
- Alles is read-only: een ouder kan niets wijzigen, alleen volgen en communiceren

---

## 🛠️ Developer (eigenaar, via `/dev`)

- Inloggen met de `DEVELOPER_SECRET`
- **School onboarden**: naam, slug, plaats, adres, contactgegevens + optioneel direct het eerste **admin-account** (wachtwoord zelf kiezen of automatisch genereren — wordt éénmalig getoond)
- Per school extra accounts aanmaken (elke rol)
- **School deactiveren**: niemand van die school kan dan nog inloggen in de app
- Overzicht van alle scholen met aantallen accounts/klassen/vakken

---

## Verschillen site ↔ app (bewust)

| Onderwerp | Site | App |
|---|---|---|
| Bijlage-upload huiswerk | tot 500 MB (video/audio/foto/PDF/Word/tekst) | tot 4 MB (foto/PDF/audio/video) |
| Wachtwoord vergeten (e-mailflow) | ✅ | ❌ — admin reset het wachtwoord direct |
| Leerling zoeken (admin-zoekbalk) | ✅ | via de gebruikerslijst met rolfilter |
| Alle overige functionaliteit | ✅ | ✅ identiek |
