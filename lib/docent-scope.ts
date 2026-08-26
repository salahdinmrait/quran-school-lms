import { prisma } from "@/lib/prisma";

/**
 * Bereikcontroles voor de docent.
 *
 * Een rolcheck ("is dit een docent?") zegt niets over *wélke* leerlingen en
 * vakken bij deze docent horen. Zonder deze controles kan elke docent — ook
 * een docent van een andere school — bij elke leerling terecht, zolang hij het
 * id maar kent. Deze helpers beantwoorden die vraag op één plek, zodat elke
 * route dezelfde regel gebruikt.
 */

/**
 * Zit deze leerling in een klas van deze docent, en wordt dit vak in die klas
 * gegeven? Beide voorwaarden gelden binnen dezelfde klas; daarmee is de
 * schoolgrens automatisch gedekt.
 */
export async function docentGeeftLeerlingDitVak(
  docentId: string,
  leerlingId: string,
  vakId: string
): Promise<boolean> {
  const klas = await prisma.klas.findFirst({
    where: {
      verwijderdOp: null,
      docenten: { some: { docentId } },
      leerlingen: { some: { leerlingId, leerling: { role: "LEERLING" } } },
      vakken: { some: { vakId, vak: { verwijderdOp: null } } },
    },
    select: { id: true },
  });
  return klas !== null;
}

/** Zit deze leerling in een van de klassen van deze docent? */
export async function docentGeeftLeerling(
  docentId: string,
  leerlingId: string
): Promise<boolean> {
  const klas = await prisma.klas.findFirst({
    where: {
      verwijderdOp: null,
      docenten: { some: { docentId } },
      leerlingen: { some: { leerlingId, leerling: { role: "LEERLING" } } },
    },
    select: { id: true },
  });
  return klas !== null;
}

/** Hoort dit cijfer bij een klas/vak van deze docent? */
export async function docentMagBijCijfer(docentId: string, cijferId: string): Promise<boolean> {
  const cijfer = await prisma.cijfer.findUnique({
    where: { id: cijferId },
    select: { leerlingId: true, vakId: true },
  });
  if (!cijfer) return false;
  return docentGeeftLeerlingDitVak(docentId, cijfer.leerlingId, cijfer.vakId);
}

/**
 * Hoort dit huiswerk bij een klas van deze docent, en zit deze leerling in
 * diezelfde klas? Gebruikt voor afvinken en voor het lezen van inleveringen.
 */
export async function docentMagBijHuiswerkVoorLeerling(
  docentId: string,
  huiswerkId: string,
  leerlingId: string
): Promise<boolean> {
  const huiswerk = await prisma.huiswerk.findUnique({
    where: { id: huiswerkId },
    select: { vakId: true, les: { select: { klasId: true } } },
  });
  if (!huiswerk) return false;

  // Huiswerk dat aan een les hangt: die ene klas telt. Los huiswerk (oude
  // rijen, lesId is nullable): elke klas waarin dit vak wordt gegeven.
  const klas = await prisma.klas.findFirst({
    where: {
      verwijderdOp: null,
      ...(huiswerk.les ? { id: huiswerk.les.klasId } : { vakken: { some: { vakId: huiswerk.vakId } } }),
      docenten: { some: { docentId } },
      leerlingen: { some: { leerlingId, leerling: { role: "LEERLING" } } },
    },
    select: { id: true },
  });
  return klas !== null;
}
