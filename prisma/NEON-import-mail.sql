-- NEON-import-mail.sql — draai dit één keer in de Neon SQL-editor.
-- Hoort bij: telefoonveld op gebruikers + rate-limit-tabel voor login.
-- Idempotent: veilig om nogmaals te draaien.

-- 1. Telefoonnummer op gebruikers (uit de Excel-import)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telefoon" TEXT;

-- 2. Rate-limit-tabel voor login-/wachtwoord-vergeten-pogingen
CREATE TABLE IF NOT EXISTS "LoginPoging" (
    "id" TEXT NOT NULL,
    "sleutel" TEXT NOT NULL,
    "tijdstip" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginPoging_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoginPoging_sleutel_tijdstip_idx"
    ON "LoginPoging"("sleutel", "tijdstip");
