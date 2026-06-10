import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDevAuthenticated } from "@/lib/dev-auth";
import { hash } from "bcryptjs";
import { z } from "zod";

const accountSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["ADMIN", "DOCENT", "LEERLING", "OUDER"]),
  password: z.string().min(8).optional(),
});

const bodySchema = z.object({
  accounts: z.array(accountSchema).min(1),
});

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  for (const b of bytes) pw += chars[b % chars.length];
  return pw;
}

// POST /api/dev/scholen/[id]/accounts — create one or more accounts for a school.
// Returns the (generated) passwords so the developer can hand them over.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isDevAuthenticated())) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;

  const school = await prisma.school.findUnique({ where: { id } });
  if (!school) {
    return NextResponse.json({ error: "School niet gevonden" }, { status: 404 });
  }

  try {
    const body = await req.json();
    // Accept both a single account object and { accounts: [...] }
    const parsed = bodySchema.safeParse(
      Array.isArray(body.accounts) ? body : { accounts: [body] }
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validatiefout", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const emails = parsed.data.accounts.map((a) => a.email.toLowerCase().trim());
    const existing = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Al in gebruik: ${existing.map((e) => e.email).join(", ")}` },
        { status: 409 }
      );
    }

    const created: { id: string; name: string; email: string; role: string; password: string }[] = [];
    for (const account of parsed.data.accounts) {
      const password = account.password || generatePassword();
      const user = await prisma.user.create({
        data: {
          name: account.name,
          email: account.email.toLowerCase().trim(),
          password: await hash(password, 12),
          role: account.role,
          schoolId: school.id,
        },
      });
      created.push({ id: user.id, name: user.name, email: user.email, role: user.role, password });
    }

    return NextResponse.json({ created }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/dev/scholen/[id]/accounts]", err);
    return NextResponse.json({ error: "Kon accounts niet aanmaken" }, { status: 500 });
  }
}
