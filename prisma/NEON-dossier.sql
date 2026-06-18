-- ════════════════════════════════════════════════════════════════════════════
-- Jadwal — Leerlingendossier. Draai dit ÉÉN keer in de Neon SQL-editor.
-- Veilig om vaker te draaien (IF NOT EXISTS / dedup-guards).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "LeerlingDossier" (
    "id"         TEXT NOT NULL,
    "leerlingId" TEXT NOT NULL,
    "auteurId"   TEXT NOT NULL,
    "titel"      TEXT,
    "inhoud"     TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeerlingDossier_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "LeerlingDossier" ADD CONSTRAINT "LeerlingDossier_leerlingId_fkey"
    FOREIGN KEY ("leerlingId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeerlingDossier" ADD CONSTRAINT "LeerlingDossier_auteurId_fkey"
    FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
