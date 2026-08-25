import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDevAuthenticated } from "@/lib/dev-auth";
import { inloggegevensStatus, verstuurInloggegevens } from "@/lib/inloggegevens";

// Honderden mails met 600 ms ertussen duurt lang
export const maxDuration = 300;

async function school(id: string) {
  if (!(await isDevAuthenticated())) return { error: "Geen toegang", status: 403 } as const;
  const rij = await prisma.school.findUnique({ where: { id }, select: { id: true, naam: true } });
  if (!rij) return { error: "School niet gevonden", status: 404 } as const;
  return { school: rij } as const;
}

// GET /api/dev/scholen/[id]/inloggegevens — tellers voor de dev-console plus de
// lijst met accounts die nog niets hebben gehad: precies de mensen die de POST
// zou aanschrijven, zodat je vóór het versturen ziet om wie het gaat.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await school(id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  return NextResponse.json(await inloggegevensStatus(ctx.school.id));
}

// POST /api/dev/scholen/[id]/inloggegevens — verstuur de welkomstmail naar
// iedereen die er nog geen heeft gehad. Idempotent: wie al gemaild is wordt
// overgeslagen, ook na een refresh of een tweede import.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await school(id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  try {
    const resultaat = await verstuurInloggegevens(ctx.school.id, ctx.school.naam);
    return NextResponse.json({ ...resultaat, ...(await inloggegevensStatus(ctx.school.id)) });
  } catch (err) {
    console.error("[POST /api/dev/scholen/[id]/inloggegevens]", err);
    return NextResponse.json({ error: "Kon de inloggegevens niet versturen" }, { status: 500 });
  }
}
