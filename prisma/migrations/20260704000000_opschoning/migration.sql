-- ════════════════════════════════════════════════════════════════════════════
-- Jadwal — Opschoning & productie-gereedheid. Draai dit ÉÉN keer in de
-- Neon SQL-editor. Veilig om vaker te draaien (IF NOT EXISTS-guards).
--
-- Onderdelen:
--   1. Soft delete: kolom "verwijderdOp" op User, Klas, Vak
--   2. Max 1 ouder per kind: dedupliceren + unique constraint
--   3. Indexes op veelgebruikte foreign keys (sneller bij honderden leerlingen)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Soft delete ───────────────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verwijderdOp" TIMESTAMP(3);
ALTER TABLE "Klas" ADD COLUMN IF NOT EXISTS "verwijderdOp" TIMESTAMP(3);
ALTER TABLE "Vak"  ADD COLUMN IF NOT EXISTS "verwijderdOp" TIMESTAMP(3);

-- ── 2. Max 1 ouder per kind ──────────────────────────────────────────────────
-- Eerst dubbele koppelingen opruimen: per kind blijft de oudste koppeling staan.
DELETE FROM "OuderLeerling" a
USING "OuderLeerling" b
WHERE a."leerlingId" = b."leerlingId"
  AND a."id" > b."id";

-- Daarna de unieke regel afdwingen (kind heeft max 1 ouder-account).
CREATE UNIQUE INDEX IF NOT EXISTS "OuderLeerling_leerlingId_key"
  ON "OuderLeerling"("leerlingId");

-- ── 3. Indexes op hete foreign keys ──────────────────────────────────────────
-- Postgres maakt geen automatische indexes op foreign keys; deze versnellen
-- de meest voorkomende queries (cijfers/aanwezigheid/berichten per gebruiker).
CREATE INDEX IF NOT EXISTS "User_schoolId_idx"             ON "User"("schoolId");
CREATE INDEX IF NOT EXISTS "Klas_schoolId_idx"             ON "Klas"("schoolId");
CREATE INDEX IF NOT EXISTS "Vak_schoolId_idx"              ON "Vak"("schoolId");
CREATE INDEX IF NOT EXISTS "Cijfer_leerlingId_idx"         ON "Cijfer"("leerlingId");
CREATE INDEX IF NOT EXISTS "Cijfer_vakId_idx"              ON "Cijfer"("vakId");
CREATE INDEX IF NOT EXISTS "Les_klasId_idx"                ON "Les"("klasId");
CREATE INDEX IF NOT EXISTS "Les_datum_idx"                 ON "Les"("datum");
CREATE INDEX IF NOT EXISTS "Aanwezigheid_leerlingId_idx"   ON "Aanwezigheid"("leerlingId");
CREATE INDEX IF NOT EXISTS "Huiswerk_vakId_idx"            ON "Huiswerk"("vakId");
CREATE INDEX IF NOT EXISTS "Huiswerk_lesId_idx"            ON "Huiswerk"("lesId");
CREATE INDEX IF NOT EXISTS "Inlevering_leerlingId_idx"     ON "Inlevering"("leerlingId");
CREATE INDEX IF NOT EXISTS "HuiswerkLeerling_leerlingId_idx" ON "HuiswerkLeerling"("leerlingId");
CREATE INDEX IF NOT EXISTS "Bericht_ontvangerId_idx"       ON "Bericht"("ontvangerId");
CREATE INDEX IF NOT EXISTS "Bericht_verzenderId_idx"       ON "Bericht"("verzenderId");
CREATE INDEX IF NOT EXISTS "Bericht_replyToId_idx"         ON "Bericht"("replyToId");
CREATE INDEX IF NOT EXISTS "OuderLeerling_ouderId_idx"     ON "OuderLeerling"("ouderId");
CREATE INDEX IF NOT EXISTS "LeerlingDossier_leerlingId_idx" ON "LeerlingDossier"("leerlingId");
