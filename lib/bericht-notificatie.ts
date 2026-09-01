import { prisma } from "@/lib/prisma";
import { berichtNotificatieEmail, sendMail } from "@/lib/email";
import { WEBAPP_URL } from "@/lib/urls";

// Een mailtje bij een nieuw persoonlijk bericht, maar niet bij iemand die net
// nog in de app was. Zonder die uitzondering levert een gesprek van tien
// berichten heen en weer ook tien mails op.
//
// "Recent actief" komt uit `User.laatsteActiefOp`, dat lib/api-auth.ts bij elk
// geauthenticeerd verzoek bijhoudt (hoogstens eens per vijf minuten). Alleen
// naar de inlogtijd kijken zou niet werken: een mobiel token is dertig dagen
// geldig, dus wie ingelogd blijft logt bijna nooit opnieuw in.
const NIET_MAILEN_BINNEN_MINUTEN = 60;

type Rol = "ADMIN" | "DOCENT" | "LEERLING" | "OUDER";
const ROLLEN: Rol[] = ["ADMIN", "DOCENT", "LEERLING", "OUDER"];

function alsRol(role: string): Rol {
  return ROLLEN.find((r) => r === role) ?? "LEERLING";
}

export async function mailNieuweBerichten(opts: {
  ontvangerIds: string[];
  verzenderNaam: string;
  onderwerp: string;
}): Promise<void> {
  const { ontvangerIds, verzenderNaam, onderwerp } = opts;
  if (ontvangerIds.length === 0) return;

  // Mail is bijzaak: een storing hier mag het versturen van het bericht zelf
  // nooit laten mislukken.
  try {
    const grens = new Date(Date.now() - NIET_MAILEN_BINNEN_MINUTEN * 60 * 1000);

    const ontvangers = await prisma.user.findMany({
      where: {
        id: { in: ontvangerIds },
        actief: true,
        verwijderdOp: null,
        // Wie in het laatste uur nog iets deed, ziet het bericht vanzelf.
        OR: [{ laatsteActiefOp: null }, { laatsteActiefOp: { lt: grens } }],
      },
      select: { name: true, email: true, role: true },
    });

    await Promise.allSettled(
      ontvangers.map((o) =>
        sendMail({
          to: o.email,
          subject: `Nieuw bericht van ${verzenderNaam}`,
          html: berichtNotificatieEmail(
            o.name,
            verzenderNaam,
            onderwerp,
            WEBAPP_URL,
            o.email,
            // `role` is in het schema een string; alleen de vier bekende
            // rollen hebben een eigen pad in de app.
            alsRol(o.role)
          ),
        })
      )
    );
  } catch (err) {
    console.error("[bericht-notificatie]", err);
  }
}
