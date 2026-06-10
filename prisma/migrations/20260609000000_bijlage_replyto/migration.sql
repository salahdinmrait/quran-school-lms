-- Add file attachment fields to Huiswerk
ALTER TABLE "Huiswerk" ADD COLUMN IF NOT EXISTS "bijlageNaam"  TEXT;
ALTER TABLE "Huiswerk" ADD COLUMN IF NOT EXISTS "bijlageData"  TEXT;
ALTER TABLE "Huiswerk" ADD COLUMN IF NOT EXISTS "bijlageType"  TEXT;

-- Add self-referential replyToId to Bericht for conversation threading
ALTER TABLE "Bericht" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;
ALTER TABLE "Bericht" ADD CONSTRAINT "Bericht_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "Bericht"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
