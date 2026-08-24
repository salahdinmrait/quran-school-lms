-- ════════════════════════════════════════════════════════════════════════════
-- Jadwal — "18+ eruit" + handmatig inloggegevens versturen
-- Draai dit ÉÉN keer in de Neon SQL-editor, VÓÓR de deploy van deze versie.
-- Veilig om vaker te draaien: alles gebruikt IF (NOT) EXISTS.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Inloggegevens worden voortaan handmatig verstuurd ────────────────────
-- De import maakt alleen nog het account + token aan; het mailen is een aparte
-- knop in de dev-console. Dit veld is de waarheid over "al verstuurd?", zodat
-- een refresh of een tweede import niets opnieuw kan versturen.
ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "verstuurdOp" TIMESTAMP(3);

-- Tokens die vóór deze migratie zijn aangemaakt, zijn destijds wél direct
-- gemaild. Markeer ze als verstuurd — anders lijken bestaande accounts
-- "nog niet verstuurd" en zou één klik iedereen opnieuw mailen.
UPDATE "PasswordResetToken" SET "verstuurdOp" = "createdAt" WHERE "verstuurdOp" IS NULL;

-- ── 2. Het 18+/minderjarig-onderscheid vervalt ──────────────────────────────
-- Elke leerling krijgt dezelfde rechten (de rechten die tot nu toe voor 18+
-- golden). De kolom bevatte alleen die vlag en niets anders; er hangt geen
-- andere gegevens aan.
ALTER TABLE "User" DROP COLUMN IF EXISTS "isVolwassen";
