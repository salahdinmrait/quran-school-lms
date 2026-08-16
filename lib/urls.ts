// De publieke webapp (Jadwal). Alle links die we naar gebruikers sturen wijzen
// hierheen: de app heeft de huisstijl, de LMS-pagina's zijn intern gereedschap.
export const WEBAPP_URL = process.env.WEBAPP_URL ?? "https://quran-school-app.vercel.app";

// Scherm waar iemand een (nieuw) wachtwoord instelt. Na opslaan stuurt de app
// door naar de inlogpagina van de app zelf.
export function wachtwoordInstellenUrl(token: string): string {
  return `${WEBAPP_URL}/wachtwoord-instellen?token=${encodeURIComponent(token)}`;
}
