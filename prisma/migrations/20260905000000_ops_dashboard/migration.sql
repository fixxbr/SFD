-- Single-page operations: case health, referrals, pinned notes,
-- payment confirmation fields, payment_events, document_requests, lawyer_assignments

CREATE TYPE "CaseHealth" AS ENUM (
  'ON_TRACK',
  'NEEDS_ATTENTION',
  'WAITING_ON_CANDIDATE',
  'WAITING_ON_ATTORNEY',
  'READY_FOR_NEXT_STEP'
);

CREATE TYPE "ReferralType" AS ENUM (
  'TEAM_MEMBER',
  'PARTNER',
  'EXTERNAL',
  'OTHER'
);

ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "case_health" "CaseHealth" NOT NULL DEFAULT 'ON_TRACK';
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "referral_type" "ReferralType";
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "referred_by_name" TEXT;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "referred_by_admin_id" UUID;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "referred_at" TIMESTAMP(3);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "referral_note" TEXT;

DO $$ BEGIN
  ALTER TABLE "cases"
    ADD CONSTRAINT "cases_referred_by_admin_id_fkey"
    FOREIGN KEY ("referred_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "case_notes" ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "case_notes" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "case_notes_is_pinned_idx" ON "case_notes"("is_pinned");

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "confirmed_by" UUID;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "confirmed_source" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reference_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "admin_note" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "payments"
    ADD CONSTRAINT "payments_confirmed_by_fkey"
    FOREIGN KEY ("confirmed_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "template_type" TEXT;
ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "body_snapshot" TEXT;

CREATE TABLE IF NOT EXISTS "payment_events" (
  "id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "actor_id" UUID,
  "note" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_events_payment_id_idx" ON "payment_events"("payment_id");
CREATE INDEX IF NOT EXISTS "payment_events_case_id_idx" ON "payment_events"("case_id");
CREATE INDEX IF NOT EXISTS "payment_events_candidate_id_idx" ON "payment_events"("candidate_id");

DO $$ BEGIN
  ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "document_requests" (
  "id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "access_link_id" UUID,
  "template_key" TEXT NOT NULL,
  "requested_categories" JSONB NOT NULL DEFAULT '[]',
  "sent_by" UUID,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "document_requests_candidate_id_idx" ON "document_requests"("candidate_id");
CREATE INDEX IF NOT EXISTS "document_requests_case_id_idx" ON "document_requests"("case_id");

DO $$ BEGIN
  ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_sent_by_fkey"
    FOREIGN KEY ("sent_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "lawyer_assignments" (
  "id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "lawyer_id" UUID NOT NULL,
  "assigned_by" UUID,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawyer_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lawyer_assignments_case_id_idx" ON "lawyer_assignments"("case_id");
CREATE INDEX IF NOT EXISTS "lawyer_assignments_lawyer_id_idx" ON "lawyer_assignments"("lawyer_id");

DO $$ BEGIN
  ALTER TABLE "lawyer_assignments" ADD CONSTRAINT "lawyer_assignments_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "lawyer_assignments" ADD CONSTRAINT "lawyer_assignments_lawyer_id_fkey"
    FOREIGN KEY ("lawyer_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "lawyer_assignments" ADD CONSTRAINT "lawyer_assignments_assigned_by_fkey"
    FOREIGN KEY ("assigned_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
