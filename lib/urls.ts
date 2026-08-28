// De publieke webapp (Jadwal). Alle links die we naar gebruikers sturen wijzen
// hierheen: de app heeft de huisstijl, de LMS-pagina's zijn intern gereedschap.
export const WEBAPP_URL = process.env.WEBAPP_URL ?? "https://quran-school-app.vercel.app";

// Deze LMS serveert zijn eigen /public-bestanden. E-mailclients laden alleen
// absolute URL's, dus het logo in de mail wijst hierheen — bewust níét naar
// WEBAPP_URL: dat domein hangt aan het app-project, dat /public van de LMS
// niet doorgeeft.
export const LMS_URL = process.env.LMS_URL ?? "https://quran-school-lms.vercel.app";
export const LOGO_URL = `${LMS_URL}/jadwal-seal.png`;

// Scherm waar iemand een (nieuw) wachtwoord instelt. Na opslaan stuurt de app
// door naar de inlogpagina van de app zelf.
export function wachtwoordInstellenUrl(token: string): string {
  return `${WEBAPP_URL}/wachtwoord-instellen?token=${encodeURIComponent(token)}`;
}
