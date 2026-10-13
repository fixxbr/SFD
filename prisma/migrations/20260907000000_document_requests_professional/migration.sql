-- Document request numbers (REQ-2034+) and richer request payloads.

CREATE SEQUENCE IF NOT EXISTS afterstem_document_request_seq START 2034;

ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "request_number" TEXT;
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "request_type" TEXT NOT NULL DEFAULT 'FULL';
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "requested_items" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "document_name" TEXT;
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "document_note" TEXT;
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "recipient_email" TEXT;
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'SENT';

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM document_requests WHERE request_number IS NULL ORDER BY created_at ASC LOOP
    UPDATE document_requests
      SET request_number = 'REQ-' || nextval('afterstem_document_request_seq')::text
      WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "document_requests" ALTER COLUMN "request_number" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "document_requests_request_number_key" ON "document_requests"("request_number");
CREATE INDEX IF NOT EXISTS "document_requests_access_link_id_idx" ON "document_requests"("access_link_id");
CREATE INDEX IF NOT EXISTS "document_requests_request_type_idx" ON "document_requests"("request_type");

-- Case-scoped custom document definitions (unlimited admin-added types).
CREATE TABLE IF NOT EXISTS "custom_document_defs" (
  "id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "instructions" TEXT,
  "category" TEXT NOT NULL DEFAULT 'additional',
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "custom_document_defs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "custom_document_defs_case_key_key"
  ON "custom_document_defs"("case_id", "key");
CREATE INDEX IF NOT EXISTS "custom_document_defs_candidate_id_idx"
  ON "custom_document_defs"("candidate_id");

DO $$ BEGIN
  ALTER TABLE "custom_document_defs"
    ADD CONSTRAINT "custom_document_defs_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "custom_document_defs"
    ADD CONSTRAINT "custom_document_defs_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "custom_document_defs"
    ADD CONSTRAINT "custom_document_defs_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "candidate_submission_sessions"
  ADD COLUMN IF NOT EXISTS "document_request_id" UUID;

DO $$ BEGIN
  ALTER TABLE "candidate_submission_sessions"
    ADD CONSTRAINT "candidate_submission_sessions_document_request_id_fkey"
    FOREIGN KEY ("document_request_id") REFERENCES "document_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
