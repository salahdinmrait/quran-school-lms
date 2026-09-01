-- ════════════════════════════════════════════════════════════════════════════
-- Jadwal — Inleveren los van afvinken + laatste activiteit voor mailnotificaties.
-- Draai dit ÉÉN keer in de Neon SQL-editor.
-- Veilig om vaker te draaien (IF NOT EXISTS / IS NULL-guards).
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Inlevering krijgt twee losse momenten.
--    Tot nu toe betekende "er bestaat een rij" zowel 'ingeleverd' als
--    'afgevinkt'. Vanaf nu levert de leerling in (ingeleverdOp) en tekent de
--    docent af (afgevinktOp); alleen afgevinkt telt voor het klassement.
ALTER TABLE "Inlevering" ADD COLUMN IF NOT EXISTS "ingeleverdOp" TIMESTAMP(3);
ALTER TABLE "Inlevering" ADD COLUMN IF NOT EXISTS "afgevinktOp"  TIMESTAMP(3);

-- 2. Laatste activiteit per gebruiker. Bepaalt of er een notificatiemail
--    uitgaat bij een nieuw bericht (niet als iemand het laatste uur actief was).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "laatsteActiefOp" TIMESTAMP(3);

-- 3. Bestaande rijen omzetten zonder gedragsverandering.
--    Alles wat er nu staat gold als afgevinkt — die betekenis blijft.
UPDATE "Inlevering"
   SET "afgevinktOp" = "createdAt"
 WHERE "afgevinktOp" IS NULL;

--    Rijen met echte inhoud (niet het afvink-vinkje) zijn ooit door de
--    leerling zelf ingeleverd.
UPDATE "Inlevering"
   SET "ingeleverdOp" = "createdAt"
 WHERE "ingeleverdOp" IS NULL
   AND "inhoud" <> '✓';

-- 4. Controle: dit moet 0 rijen teruggeven.
SELECT COUNT(*) AS zonder_afgevinktop FROM "Inlevering" WHERE "afgevinktOp" IS NULL;
