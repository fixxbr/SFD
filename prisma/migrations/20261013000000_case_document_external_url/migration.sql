-- Links are stored separately from uploaded files: a link row carries its URL here.
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "external_url" TEXT;

-- Backfill single-URL link rows saved before this column existed.
UPDATE "case_documents"
SET "external_url" = "display_name"
WHERE "external_url" IS NULL
  AND "display_name" ~* '^https?://[^[:space:]]+$'
  AND ("original_filename" ILIKE '%.url.txt' OR "original_filename" ILIKE '%.url' OR "mime_type" IN ('text/plain', 'text/uri-list'));
