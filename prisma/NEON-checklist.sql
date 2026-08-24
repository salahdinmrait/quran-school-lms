-- ════════════════════════════════════════════════════════════════════════════
-- Jadwal — checklist-update migratie voor Neon (PostgreSQL)
-- Draai dit ÉÉN keer in de Neon SQL-editor (veilig om vaker te draaien: alles
-- gebruikt IF NOT EXISTS / dedup-guards).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 18+ zelfstandige leerling ───────────────────────────────────────────────
-- VERVALLEN: het 18+/minderjarig-onderscheid bestaat niet meer. De kolom wordt
-- weer verwijderd door NEON-taal-en-18plus.sql. Deze regel staat er alleen nog
-- als historisch verslag van wat er ooit is gedraaid — niet opnieuw uitvoeren.
-- ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVolwassen" BOOLEAN NOT NULL DEFAULT false;

-- ── Cijfer: losse opmerking + bijlage ───────────────────────────────────────
ALTER TABLE "Cijfer" ADD COLUMN IF NOT EXISTS "opmerking"   TEXT;
ALTER TABLE "Cijfer" ADD COLUMN IF NOT EXISTS "opmerkingOp" TIMESTAMP(3);
ALTER TABLE "Cijfer" ADD COLUMN IF NOT EXISTS "bijlageNaam" TEXT;
ALTER TABLE "Cijfer" ADD COLUMN IF NOT EXISTS "bijlageUrl"  TEXT;
ALTER TABLE "Cijfer" ADD COLUMN IF NOT EXISTS "bijlageData" TEXT;
ALTER TABLE "Cijfer" ADD COLUMN IF NOT EXISTS "bijlageType" TEXT;

-- ── Les: omschrijving + bijlage ─────────────────────────────────────────────
ALTER TABLE "Les" ADD COLUMN IF NOT EXISTS "beschrijving" TEXT;
ALTER TABLE "Les" ADD COLUMN IF NOT EXISTS "bijlageNaam"  TEXT;
ALTER TABLE "Les" ADD COLUMN IF NOT EXISTS "bijlageUrl"   TEXT;
ALTER TABLE "Les" ADD COLUMN IF NOT EXISTS "bijlageData"  TEXT;
ALTER TABLE "Les" ADD COLUMN IF NOT EXISTS "bijlageType"  TEXT;

-- ── Inlevering: leerling-bijlage ────────────────────────────────────────────
ALTER TABLE "Inlevering" ADD COLUMN IF NOT EXISTS "bijlageNaam" TEXT;
ALTER TABLE "Inlevering" ADD COLUMN IF NOT EXISTS "bijlageUrl"  TEXT;
ALTER TABLE "Inlevering" ADD COLUMN IF NOT EXISTS "bijlageData" TEXT;
ALTER TABLE "Inlevering" ADD COLUMN IF NOT EXISTS "bijlageType" TEXT;

-- ── Bericht: bijlage ────────────────────────────────────────────────────────
ALTER TABLE "Bericht" ADD COLUMN IF NOT EXISTS "bijlageNaam" TEXT;
ALTER TABLE "Bericht" ADD COLUMN IF NOT EXISTS "bijlageUrl"  TEXT;
ALTER TABLE "Bericht" ADD COLUMN IF NOT EXISTS "bijlageData" TEXT;
ALTER TABLE "Bericht" ADD COLUMN IF NOT EXISTS "bijlageType" TEXT;

-- ── HuiswerkLeerling: huiswerk gericht op specifieke leerling(en) ───────────
CREATE TABLE IF NOT EXISTS "HuiswerkLeerling" (
    "id"         TEXT NOT NULL,
    "huiswerkId" TEXT NOT NULL,
    "leerlingId" TEXT NOT NULL,
    CONSTRAINT "HuiswerkLeerling_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HuiswerkLeerling_huiswerkId_leerlingId_key"
    ON "HuiswerkLeerling"("huiswerkId", "leerlingId");
DO $$ BEGIN
  ALTER TABLE "HuiswerkLeerling" ADD CONSTRAINT "HuiswerkLeerling_huiswerkId_fkey"
    FOREIGN KEY ("huiswerkId") REFERENCES "Huiswerk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "HuiswerkLeerling" ADD CONSTRAINT "HuiswerkLeerling_leerlingId_fkey"
    FOREIGN KEY ("leerlingId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── StudieMateriaal ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StudieMateriaal" (
    "id"           TEXT NOT NULL,
    "titel"        TEXT NOT NULL,
    "beschrijving" TEXT,
    "linkUrl"      TEXT,
    "bijlageNaam"  TEXT,
    "bijlageUrl"   TEXT,
    "bijlageData"  TEXT,
    "bijlageType"  TEXT,
    "docentId"     TEXT NOT NULL,
    "klasId"       TEXT,
    "vakId"        TEXT,
    "schoolId"     TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudieMateriaal_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "StudieMateriaal" ADD CONSTRAINT "StudieMateriaal_docentId_fkey"
    FOREIGN KEY ("docentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudieMateriaal" ADD CONSTRAINT "StudieMateriaal_klasId_fkey"
    FOREIGN KEY ("klasId") REFERENCES "Klas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudieMateriaal" ADD CONSTRAINT "StudieMateriaal_vakId_fkey"
    FOREIGN KEY ("vakId") REFERENCES "Vak"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
