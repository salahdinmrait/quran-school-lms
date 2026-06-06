/**
 * Shared Hifdh-tracker utilities.
 * Used by the API to generate weekly tasks and linked huiswerk.
 */
import { SURAHS } from "./quran";
import { prisma } from "./prisma";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSurahAyaat(surahNr: number): number {
  return SURAHS.find((s) => s.nr === surahNr)?.ayaat ?? 0;
}

function getSurahNaam(surahNr: number): string {
  const s = SURAHS.find((s) => s.nr === surahNr);
  return s ? `${s.naam} (${s.naamAr})` : `Surah ${surahNr}`;
}

/** Returns the Monday of the given date (or today if no date given). */
export function getMondayOf(d: Date = new Date()): Date {
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

// ── Task generation ───────────────────────────────────────────────────────────

interface TaakData {
  surahNr: number;
  vanAyah: number;
  totAyah: number;
  weekStart: Date;
}

/**
 * Generate up to `count` weekly tasks (type NIEUW) starting from
 * (startSurah, startAyah), going backwards through the Quran
 * (surah 114 → 113 → … → 1).
 *
 * Rule: if remaining ayaat in the current surah ≤ ayaatPerWeek,
 * the student only finishes that surah (even if fewer than the weekly target).
 * The next week starts at the NEXT (lower-numbered) surah.
 *
 * Returns the generated task data AND the position after the last task.
 */
export function buildTaakData(
  startSurah: number,
  startAyah: number,
  ayaatPerWeek: number,
  weekStart: Date,
  count = 6
): { taken: TaakData[]; eindSurahNr: number; eindAyahNr: number } {
  const taken: TaakData[] = [];
  let surah = startSurah;
  let ayah = startAyah;
  const monday = new Date(weekStart);

  for (let i = 0; i < count; i++) {
    if (surah < 1) break; // finished the whole Quran

    const surahSize = getSurahAyaat(surah);
    const remaining = surahSize - ayah + 1;

    let totAyah: number;
    if (remaining <= ayaatPerWeek) {
      // Finish this surah
      totAyah = surahSize;
    } else {
      totAyah = ayah + ayaatPerWeek - 1;
    }

    taken.push({ surahNr: surah, vanAyah: ayah, totAyah, weekStart: new Date(monday) });

    // Advance position
    if (totAyah >= surahSize) {
      surah--;
      ayah = 1;
    } else {
      ayah = totAyah + 1;
    }

    monday.setDate(monday.getDate() + 7);
  }

  return { taken, eindSurahNr: surah, eindAyahNr: ayah };
}

/**
 * Compute the position AFTER completing a specific task.
 * Used when a docent marks a NIEUW task as voltooid.
 */
export function nextPositionAfterTask(
  surahNr: number,
  totAyah: number
): { huidigeSurahNr: number; huidigeAyahNr: number } {
  const surahSize = getSurahAyaat(surahNr);
  if (totAyah >= surahSize) {
    return { huidigeSurahNr: surahNr - 1, huidigeAyahNr: 1 };
  }
  return { huidigeSurahNr: surahNr, huidigeAyahNr: totAyah + 1 };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

/**
 * Find the vakId of the Hifdh (categorie HIFZ) vak for a leerling's klas.
 * Returns null if not found.
 */
async function findHifdhVakId(leerlingId: string): Promise<string | null> {
  const link = await prisma.klasLeerling.findFirst({
    where: { leerlingId },
    include: {
      klas: {
        include: {
          vakken: { include: { vak: true } },
        },
      },
    },
  });
  const hifdhVak = link?.klas.vakken.find((kv) => kv.vak.categorie === "HIFZ");
  return hifdhVak?.vakId ?? null;
}

/**
 * Create 6 weeks of HifdhTaak records (+ linked Huiswerk) for a profiel.
 * weekStart defaults to the Monday of the current week.
 */
export async function createTakenForProfiel(profielId: string): Promise<void> {
  const profiel = await prisma.hifdhProfiel.findUnique({
    where: { id: profielId },
    include: { leerling: true },
  });
  if (!profiel) return;

  const vakId = await findHifdhVakId(profiel.leerlingId);
  const weekStart = getMondayOf(new Date());

  const { taken } = buildTaakData(
    profiel.huidigeSurahNr,
    profiel.huidigeAyahNr,
    profiel.ayaatPerWeek,
    weekStart
  );

  for (const t of taken) {
    const titel = `Hifdh: ${getSurahNaam(t.surahNr)} · ayah ${t.vanAyah}–${t.totAyah}`;
    const deadline = new Date(t.weekStart);
    deadline.setDate(deadline.getDate() + 6); // Sunday of that week

    // Create huiswerk if we have a vak
    let huiswerkId: string | null = null;
    if (vakId) {
      const hw = await prisma.huiswerk.create({
        data: {
          titel,
          beschrijving: `Memoriseer ${t.totAyah - t.vanAyah + 1} ayaat van ${getSurahNaam(t.surahNr)} (ayah ${t.vanAyah} t/m ${t.totAyah}).`,
          deadline,
          vakId,
        },
      });
      huiswerkId = hw.id;
    }

    await prisma.hifdhTaak.create({
      data: {
        profielId,
        type: "NIEUW",
        surahNr: t.surahNr,
        vanAyah: t.vanAyah,
        totAyah: t.totAyah,
        weekStart: t.weekStart,
        ...(huiswerkId ? { huiswerkId } : {}),
      },
    });
  }
}
