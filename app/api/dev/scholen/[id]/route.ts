import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDevAuthenticated } from "@/lib/dev-auth";

// GET /api/dev/scholen/[id] — school detail with all accounts
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isDevAuthenticated())) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

  const school = await prisma.school.findUnique({
    where: { id },
    include: {
      gebruikers: {
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: { id: true, name: true, email: true, role: true, actief: true, createdAt: true },
      },
      _count: { select: { klassen: true, vakken: true } },
    },
  });

  if (!school) {
    return NextResponse.json({ error: "School niet gevonden" }, { status: 404 });
  }

  return NextResponse.json(school);
}

// PATCH /api/dev/scholen/[id] — update school info / toggle actief
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isDevAuthenticated())) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const key of ["naam", "plaats", "adres", "contactEmail", "contactTelefoon"] as const) {
      if (typeof body[key] === "string") data[key] = body[key] || null;
    }
    if (typeof body.actief === "boolean") data.actief = body.actief;

    const school = await prisma.school.update({ where: { id }, data });
    return NextResponse.json(school);
  } catch (err) {
    console.error("[PATCH /api/dev/scholen/[id]]", err);
    return NextResponse.json({ error: "Kon school niet bijwerken" }, { status: 500 });
  }
}
