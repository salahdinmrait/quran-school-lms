-- Add bijlageUrl column to Huiswerk for Vercel Blob storage
-- New uploads store a public URL here; bijlageData (base64) remains for legacy files
ALTER TABLE "Huiswerk" ADD COLUMN IF NOT EXISTS "bijlageUrl" TEXT;
