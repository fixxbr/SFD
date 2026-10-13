-- Unique Afterstem Candidate IDs (ASM-1001+) via a Postgres sequence.
-- Sequence is never reused, including after archive/delete.

CREATE SEQUENCE IF NOT EXISTS afterstem_candidate_number_seq START 1001;

ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "candidate_number" TEXT;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM candidates WHERE candidate_number IS NULL ORDER BY created_at ASC LOOP
    UPDATE candidates
      SET candidate_number = 'ASM-' || nextval('afterstem_candidate_number_seq')::text
      WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "candidates" ALTER COLUMN "candidate_number" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "candidates_candidate_number_key" ON "candidates"("candidate_number");

ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "candidate_number" TEXT;

ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "candidate_number" TEXT;

UPDATE "case_documents" d
SET candidate_number = c.candidate_number
FROM candidates c
WHERE d.candidate_id = c.id AND d.candidate_number IS NULL;

CREATE TABLE IF NOT EXISTS "candidate_submission_sessions" (
  "id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'DOCUMENT_UPLOAD',
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "candidate_submission_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_submission_sessions_token_hash_key"
  ON "candidate_submission_sessions"("token_hash");
CREATE INDEX IF NOT EXISTS "candidate_submission_sessions_candidate_id_idx"
  ON "candidate_submission_sessions"("candidate_id");
CREATE INDEX IF NOT EXISTS "candidate_submission_sessions_case_id_idx"
  ON "candidate_submission_sessions"("case_id");
CREATE INDEX IF NOT EXISTS "candidate_submission_sessions_expires_at_idx"
  ON "candidate_submission_sessions"("expires_at");

DO $$ BEGIN
  ALTER TABLE "candidate_submission_sessions"
    ADD CONSTRAINT "candidate_submission_sessions_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "candidate_submission_sessions"
    ADD CONSTRAINT "candidate_submission_sessions_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
