import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDevAuthenticated } from "@/lib/dev-auth";
import { hash } from "bcryptjs";
import { z } from "zod";

const schoolSchema = z.object({
  naam: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Alleen kleine letters, cijfers en streepjes"),
  plaats: z.string().optional(),
  adres: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactTelefoon: z.string().optional(),
  // Optioneel: meteen het eerste admin-account aanmaken
  admin: z
    .object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8).optional(),
    })
    .optional(),
});

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  for (const b of bytes) pw += chars[b % chars.length];
  return pw;
}

// GET /api/dev/scholen — list all schools with counts
export async function GET() {
  if (!(await isDevAuthenticated())) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const scholen = await prisma.school.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { gebruikers: true, klassen: true, vakken: true } },
    },
  });

  return NextResponse.json(scholen);
}

// POST /api/dev/scholen — create a new school (+ optional first admin account)
export async function POST(req: NextRequest) {
  if (!(await isDevAuthenticated())) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = schoolSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validatiefout", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const slugExists = await prisma.school.findUnique({ where: { slug: data.slug } });
    if (slugExists) {
      return NextResponse.json({ error: "Deze slug is al in gebruik" }, { status: 409 });
    }

    if (data.admin) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.admin.email.toLowerCase().trim() },
      });
      if (emailExists) {
        return NextResponse.json(
          { error: `E-mailadres ${data.admin.email} is al in gebruik` },
          { status: 409 }
        );
      }
    }

    const school = await prisma.school.create({
      data: {
        naam: data.naam,
        slug: data.slug,
        plaats: data.plaats || null,
        adres: data.adres || null,
        contactEmail: data.contactEmail || null,
        contactTelefoon: data.contactTelefoon || null,
      },
    });

    let adminAccount: { email: string; password: string } | null = null;
    if (data.admin) {
      const password = data.admin.password || generatePassword();
      await prisma.user.create({
        data: {
          name: data.admin.name,
          email: data.admin.email.toLowerCase().trim(),
          password: await hash(password, 12),
          role: "ADMIN",
          schoolId: school.id,
        },
      });
      adminAccount = { email: data.admin.email.toLowerCase().trim(), password };
    }

    return NextResponse.json({ school, adminAccount }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/dev/scholen]", err);
    return NextResponse.json({ error: "Kon school niet aanmaken" }, { status: 500 });
  }
}
