-- Multi-tenant: School table + schoolId on User, Klas, Vak
-- Run this in the Neon SQL editor (safe to re-run thanks to IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "School" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plaats" TEXT,
    "adres" TEXT,
    "contactEmail" TEXT,
    "contactTelefoon" TEXT,
    "actief" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "School_slug_key" ON "School"("slug");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "Klas" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "Vak"  ADD COLUMN IF NOT EXISTS "schoolId" TEXT;

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Klas" ADD CONSTRAINT "Klas_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Vak" ADD CONSTRAINT "Vak_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
