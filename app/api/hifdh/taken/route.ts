import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/hifdh/taken — create a hifdh task for a student
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "DOCENT")) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { profielId, type, surahNr, vanAyah, totAyah, weekStart } = await req.json();
  if (!profielId || !type || !surahNr || !vanAyah || !totAyah || !weekStart) {
    return NextResponse.json({ error: "Alle velden zijn verplicht" }, { status: 400 });
  }

  try {
    // Get the monday of the given week
    const weekDate = new Date(weekStart);
    const day = weekDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekDate.setDate(weekDate.getDate() + diff);
    weekDate.setHours(0, 0, 0, 0);

    const taak = await prisma.hifdhTaak.create({
      data: {
        profielId,
        type,
        surahNr: Number(surahNr),
        vanAyah: Number(vanAyah),
        totAyah: Number(totAyah),
        weekStart: weekDate,
      },
    });
    return NextResponse.json(taak, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Aanmaken mislukt" }, { status: 500 });
  }
}
