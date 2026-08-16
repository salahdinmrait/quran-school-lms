import { redirect } from "next/navigation";
import { WEBAPP_URL, wachtwoordInstellenUrl } from "@/lib/urls";

// Wachtwoord instellen gebeurt in de app — die heeft de huisstijl en stuurt na
// het opslaan door naar de inlogpagina van de app. Deze route blijft bestaan
// omdat eerder verstuurde mails er nog naar linken; we sturen die door.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  redirect(token ? wachtwoordInstellenUrl(token) : `${WEBAPP_URL}/wachtwoord-vergeten`);
}
