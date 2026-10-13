-- Manual finance system (quotes, schedules, receipts) — Stripe not required for tracking

CREATE TABLE IF NOT EXISTS "financial_engagements" (
  "id" UUID PRIMARY KEY,
  "candidate_id" UUID NOT NULL,
  "case_id" UUID NOT NULL UNIQUE,
  "quoted_amount_cents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "quote_status" TEXT NOT NULL DEFAULT 'DRAFT',
  "quoted_at" TIMESTAMP(3),
  "quoted_by_id" UUID,
  "structure_type" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "financial_engagements_candidate_id_idx" ON "financial_engagements"("candidate_id");
CREATE INDEX IF NOT EXISTS "financial_engagements_quote_status_idx" ON "financial_engagements"("quote_status");

CREATE TABLE IF NOT EXISTS "quote_history" (
  "id" UUID PRIMARY KEY,
  "candidate_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "engagement_id" UUID,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL,
  "created_by_id" UUID,
  "change_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "quote_history_candidate_id_idx" ON "quote_history"("candidate_id");
CREATE INDEX IF NOT EXISTS "quote_history_case_id_idx" ON "quote_history"("case_id");

CREATE TABLE IF NOT EXISTS "payment_schedules" (
  "id" UUID PRIMARY KEY,
  "candidate_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "engagement_id" UUID,
  "structure_type" TEXT NOT NULL,
  "frequency" TEXT,
  "total_amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "payment_schedules_candidate_id_idx" ON "payment_schedules"("candidate_id");
CREATE INDEX IF NOT EXISTS "payment_schedules_case_id_idx" ON "payment_schedules"("case_id");

CREATE TABLE IF NOT EXISTS "payment_schedule_items" (
  "id" UUID PRIMARY KEY,
  "schedule_id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "sequence_number" INTEGER NOT NULL,
  "scheduled_amount_cents" INTEGER NOT NULL,
  "fee_category" TEXT NOT NULL DEFAULT 'PROFESSIONAL_FEE',
  "counts_toward_engagement" BOOLEAN NOT NULL DEFAULT true,
  "due_date" TIMESTAMP(3),
  "due_condition" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UPCOMING',
  "reminder_count" INTEGER NOT NULL DEFAULT 0,
  "last_reminder_at" TIMESTAMP(3),
  "last_overdue_notice_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "payment_schedule_items_schedule_id_idx" ON "payment_schedule_items"("schedule_id");
CREATE INDEX IF NOT EXISTS "payment_schedule_items_candidate_id_idx" ON "payment_schedule_items"("candidate_id");
CREATE INDEX IF NOT EXISTS "payment_schedule_items_case_id_idx" ON "payment_schedule_items"("case_id");
CREATE INDEX IF NOT EXISTS "payment_schedule_items_status_idx" ON "payment_schedule_items"("status");
CREATE INDEX IF NOT EXISTS "payment_schedule_items_due_date_idx" ON "payment_schedule_items"("due_date");

CREATE TABLE IF NOT EXISTS "payment_receipts" (
  "id" UUID PRIMARY KEY,
  "candidate_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "payment_schedule_item_id" UUID,
  "description" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "received_date" TIMESTAMP(3) NOT NULL,
  "payment_method" TEXT NOT NULL,
  "payment_method_other" TEXT,
  "received_by_name" TEXT NOT NULL,
  "confirmed_by_admin_id" UUID,
  "reference_number" TEXT,
  "internal_note" TEXT,
  "receipt_type" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "void_reason" TEXT,
  "correction_of_id" UUID,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "payment_receipts_candidate_id_idx" ON "payment_receipts"("candidate_id");
CREATE INDEX IF NOT EXISTS "payment_receipts_case_id_idx" ON "payment_receipts"("case_id");
CREATE INDEX IF NOT EXISTS "payment_receipts_item_id_idx" ON "payment_receipts"("payment_schedule_item_id");
CREATE INDEX IF NOT EXISTS "payment_receipts_status_idx" ON "payment_receipts"("status");
CREATE INDEX IF NOT EXISTS "payment_receipts_received_date_idx" ON "payment_receipts"("received_date");
CREATE INDEX IF NOT EXISTS "payment_receipts_reference_number_idx" ON "payment_receipts"("reference_number");

CREATE TABLE IF NOT EXISTS "payment_receipt_allocations" (
  "id" UUID PRIMARY KEY,
  "receipt_id" UUID NOT NULL,
  "schedule_item_id" UUID NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "payment_receipt_allocations_receipt_id_idx" ON "payment_receipt_allocations"("receipt_id");
CREATE INDEX IF NOT EXISTS "payment_receipt_allocations_schedule_item_id_idx" ON "payment_receipt_allocations"("schedule_item_id");

CREATE TABLE IF NOT EXISTS "finance_events" (
  "id" UUID PRIMARY KEY,
  "candidate_id" UUID NOT NULL,
  "case_id" UUID,
  "event_type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actor_id" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "finance_events_candidate_id_idx" ON "finance_events"("candidate_id");
CREATE INDEX IF NOT EXISTS "finance_events_case_id_idx" ON "finance_events"("case_id");
CREATE INDEX IF NOT EXISTS "finance_events_created_at_idx" ON "finance_events"("created_at");

CREATE TABLE IF NOT EXISTS "finance_settings" (
  "id" UUID PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "value" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FKs
ALTER TABLE "financial_engagements"
  ADD CONSTRAINT "financial_engagements_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "financial_engagements_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "financial_engagements_quoted_by_id_fkey" FOREIGN KEY ("quoted_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quote_history"
  ADD CONSTRAINT "quote_history_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "quote_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "quote_history_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "financial_engagements"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "quote_history_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_schedules"
  ADD CONSTRAINT "payment_schedules_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_schedules_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_schedules_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "financial_engagements"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_schedules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_schedule_items"
  ADD CONSTRAINT "payment_schedule_items_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "payment_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_schedule_items_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_schedule_items_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_receipts"
  ADD CONSTRAINT "payment_receipts_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_receipts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_receipts_item_id_fkey" FOREIGN KEY ("payment_schedule_item_id") REFERENCES "payment_schedule_items"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_receipts_confirmed_by_fkey" FOREIGN KEY ("confirmed_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_receipts_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_receipt_allocations"
  ADD CONSTRAINT "payment_receipt_allocations_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "payment_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_receipt_allocations_item_id_fkey" FOREIGN KEY ("schedule_item_id") REFERENCES "payment_schedule_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "finance_events"
  ADD CONSTRAINT "finance_events_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "finance_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "finance_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
