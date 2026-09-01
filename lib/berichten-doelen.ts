import { prisma } from "@/lib/prisma";

// Wie kan deze verzender aanschrijven? Eén plek voor de lijst met mogelijke
// ontvangers, zodat het samenstellen van een bericht (groepen én losse
// personen) overal dezelfde gegevens gebruikt.
//
// ADMIN ziet alle klassen van de school plus alle docenten; DOCENT ziet alleen
// de eigen klassen, de collega-docenten en het beheer. Die grens wordt bij het
// versturen nog een keer gecontroleerd in app/api/berichten/route.ts — deze
// lijst is voor de UI, niet de autorisatie.

export interface DoelPersoon {
  id: string;
  name: string;
  email: string;
}

export interface DoelOuder extends DoelPersoon {
  /** Alle kinderen van deze ouder binnen deze klas. */
  kinderen: string[];
  /** Dezelfde kinderen als één regel, voor in de zoekresultaten. */
  kindNaam: string;
}

export interface DoelKlas {
  id: string;
  naam: string;
  leerlingen: DoelPersoon[];
  ouders: DoelOuder[];
}

/** Vorm waarin Prisma de leerlingen van een klas mét hun ouders teruggeeft. */
type LeerlingMetOuders = {
  leerling: {
    id: string;
    name: string;
    email: string;
    kindVan: { ouder: { id: string; name: string; email: string } }[];
  };
};

/**
 * Ouders van een klas: gededupliceerd, maar mét álle kinderen per ouder. Een
 * ouder met twee kinderen in dezelfde klas hoort één keer in de lijst te staan,
 * met beide namen erbij.
 */
export function oudersVanKlas(leerlingen: LeerlingMetOuders[]): DoelOuder[] {
  const ouderMap = new Map<string, { id: string; name: string; email: string; kinderen: string[] }>();
  for (const { leerling } of leerlingen) {
    for (const { ouder } of leerling.kindVan) {
      const bestaand = ouderMap.get(ouder.id);
      if (bestaand) {
        if (!bestaand.kinderen.includes(leerling.name)) bestaand.kinderen.push(leerling.name);
      } else {
        ouderMap.set(ouder.id, { id: ouder.id, name: ouder.name, email: ouder.email, kinderen: [leerling.name] });
      }
    }
  }
  return Array.from(ouderMap.values()).map((o) => ({
    id: o.id,
    name: o.name,
    email: o.email,
    kinderen: o.kinderen,
    kindNaam: o.kinderen.join(", "),
  }));
}

/** De include die `oudersVanKlas()` verwacht. */
export const leerlingenMetOudersInclude = {
  where: { leerling: { verwijderdOp: null } },
  include: {
    leerling: {
      select: {
        id: true,
        name: true,
        // E-mail hoort erbij: de zoekbalk zoekt op naam én adres.
        email: true,
        kindVan: {
          where: { ouder: { verwijderdOp: null } },
          select: { ouder: { select: { id: true, name: true, email: true } } },
        },
      },
    },
  },
} as const;

export async function doelenVoor(
  userId: string,
  role: string,
  schoolId: string | null
): Promise<{ klassen: DoelKlas[]; docenten: DoelPersoon[]; admins: DoelPersoon[] }> {
  const [klassenRaw, docenten, admins] = await Promise.all([
    prisma.klas.findMany({
      where: {
        schoolId,
        verwijderdOp: null,
        // Een docent schrijft alleen zijn eigen klassen aan.
        ...(role === "DOCENT" ? { docenten: { some: { docentId: userId } } } : {}),
      },
      orderBy: { naam: "asc" },
      include: { leerlingen: leerlingenMetOudersInclude },
    }),
    prisma.user.findMany({
      where: { schoolId, role: "DOCENT", actief: true, verwijderdOp: null, id: { not: userId } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.user.findMany({
      where: { schoolId, role: "ADMIN", actief: true, verwijderdOp: null, id: { not: userId } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const klassen: DoelKlas[] = klassenRaw.map((klas) => ({
    id: klas.id,
    naam: klas.naam,
    leerlingen: klas.leerlingen.map(({ leerling }) => ({
      id: leerling.id,
      name: leerling.name,
      email: leerling.email,
    })),
    ouders: oudersVanKlas(klas.leerlingen),
  }));

  return { klassen, docenten, admins };
}
