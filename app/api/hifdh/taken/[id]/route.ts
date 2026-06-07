import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextPositionAfterTask, buildTaakData, reshuffleTakenFrom } from "@/lib/hifdh-utils";
import { SURAHS } from "@/lib/quran";

function getSurahNaam(surahNr: number): string {
  const s = SURAHS.find((s) => s.nr === surahNr);
  return s ? `${s.naam} (${s.naamAr})` : `Surah ${surahNr}`;
}

// PATCH /api/hifdh/taken/[id] — edit totAyah + cascade subsequent open tasks
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "DOCENT" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const { totAyah } = await req.json();
  if (!totAyah || isNaN(Number(totAyah))) {
    return NextResponse.json({ error: "totAyah is verplicht" }, { status: 400 });
  }

  const taak = await prisma.hifdhTaak.findUnique({ where: { id } });
  if (!taak) return NextResponse.json({ error: "Taak niet gevonden" }, { status: 404 });
  if (taak.voltooid) return NextResponse.json({ error: "Voltooide taken kunnen niet worden aangepast" }, { status: 400 });

  await reshuffleTakenFrom(taak.profielId, id, Number(totAyah));

  // Return full updated profiel so the client can replace local state
  const profiel = await prisma.hifdhProfiel.findUnique({
    where: { id: taak.profielId },
    include: {
      leerling: { select: { id: true, name: true, email: true } },
      taken: { orderBy: { weekStart: "asc" } },
    },
  });
  return NextResponse.json(profiel);
}

// PUT /api/hifdh/taken/[id] — DOCENT/ADMIN only: toggle voltooid
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "DOCENT" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Alleen docenten kunnen taken afvinken" }, { status: 403 });
  }

  const { id } = await params;
  const { voltooid } = await req.json();

  const taak = await prisma.hifdhTaak.findUnique({
    where: { id },
    include: { profiel: { include: { taken: true } } },
  });
  if (!taak) return NextResponse.json({ error: "Taak niet gevonden" }, { status: 404 });

  const updated = await prisma.hifdhTaak.update({
    where: { id },
    data: {
      voltooid: Boolean(voltooid),
      voltooidOp: voltooid ? new Date() : null,
    },
  });

  // Update student's current position when NIEUW task is completed
  if (voltooid && taak.type === "NIEUW") {
    const newPos = nextPositionAfterTask(taak.surahNr, taak.totAyah);
    await prisma.hifdhProfiel.update({
      where: { id: taak.profielId },
      data: newPos,
    });
  }

  // Mark linked huiswerk as done for the student
  if (voltooid && taak.huiswerkId) {
    const leerlingId = taak.profiel.leerlingId;
    await prisma.inlevering
      .upsert({
        where: { huiswerkId_leerlingId: { huiswerkId: taak.huiswerkId, leerlingId } },
        create: { huiswerkId: taak.huiswerkId, leerlingId, inhoud: "✓" },
        update: { inhoud: "✓" },
      })
      .catch(() => {/* ignore */});
  }

  // Auto-generate next 6 weeks when ALL tasks for this profiel are now done
  if (voltooid) {
    const allTaken = await prisma.hifdhTaak.findMany({ where: { profielId: taak.profielId } });
    const anyOpen = allTaken.some((t) => t.id === id ? false : !t.voltooid);
    if (!anyOpen) {
      const profiel = await prisma.hifdhProfiel.findUnique({ where: { id: taak.profielId } });
      if (profiel && profiel.huidigeSurahNr >= 1) {
        // Start next batch the week after the latest existing task
        const latestWeek = allTaken.reduce(
          (max, t) => (t.weekStart > max ? t.weekStart : max),
          allTaken[0].weekStart
        );
        const nextMonday = new Date(latestWeek);
        nextMonday.setDate(nextMonday.getDate() + 7);
        nextMonday.setHours(0, 0, 0, 0);

        await createNextBatch(
          taak.profielId,
          profiel.leerlingId,
          profiel.huidigeSurahNr,
          profiel.huidigeAyahNr,
          profiel.ayaatPerWeek,
          nextMonday
        );
      }
    }
  }

  return NextResponse.json(updated);
}

// DELETE /api/hifdh/taken/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.hifdhTaak.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

// ── Internal: create next batch of 6 tasks ────────────────────────────────────

async function createNextBatch(
  profielId: string,
  leerlingId: string,
  startSurah: number,
  startAyah: number,
  ayaatPerWeek: number,
  weekStart: Date
) {
  const link = await prisma.klasLeerling.findFirst({
    where: { leerlingId },
    include: { klas: { include: { vakken: { include: { vak: true } } } } },
  });
  const hifdhVakId =
    link?.klas.vakken.find((kv) => kv.vak.categorie === "HIFZ")?.vakId ?? null;

  const { taken } = buildTaakData(startSurah, startAyah, ayaatPerWeek, weekStart, 6);

  for (const t of taken) {
    const titel = `Hifdh: ${getSurahNaam(t.surahNr)} · ayah ${t.vanAyah}–${t.totAyah}`;
    const deadline = new Date(t.weekStart);
    deadline.setDate(deadline.getDate() + 6);

    let huiswerkId: string | null = null;
    if (hifdhVakId) {
      const hw = await prisma.huiswerk.create({
        data: {
          titel,
          beschrijving: `Memoriseer ${t.totAyah - t.vanAyah + 1} ayaat van ${getSurahNaam(t.surahNr)} (ayah ${t.vanAyah} t/m ${t.totAyah}).`,
          deadline,
          vakId: hifdhVakId,
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
