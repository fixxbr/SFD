-- Expand visa types + visa document templates + document request items.

ALTER TYPE "VisaType" ADD VALUE IF NOT EXISTS 'H_1B';
ALTER TYPE "VisaType" ADD VALUE IF NOT EXISTS 'L_1A';
ALTER TYPE "VisaType" ADD VALUE IF NOT EXISTS 'L_1B';

CREATE TABLE IF NOT EXISTS "visa_type_defs" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visa_type_defs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "visa_type_defs_code_key" ON "visa_type_defs"("code");

CREATE TABLE IF NOT EXISTS "visa_document_templates" (
  "id" UUID NOT NULL,
  "visa_type_code" TEXT NOT NULL,
  "template_name" TEXT NOT NULL,
  "description" TEXT,
  "version" INT NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visa_document_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "visa_document_templates_visa_version_key"
  ON "visa_document_templates"("visa_type_code", "version");
CREATE INDEX IF NOT EXISTS "visa_document_templates_visa_active_idx"
  ON "visa_document_templates"("visa_type_code", "is_active");

CREATE TABLE IF NOT EXISTS "visa_document_template_items" (
  "id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "category" TEXT NOT NULL,
  "document_key" TEXT NOT NULL,
  "document_name" TEXT NOT NULL,
  "description" TEXT,
  "instructions" TEXT,
  "default_required" BOOLEAN NOT NULL DEFAULT false,
  "allows_multiple_files" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INT NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visa_document_template_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "visa_document_template_items_template_key_key"
  ON "visa_document_template_items"("template_id", "document_key");
CREATE INDEX IF NOT EXISTS "visa_document_template_items_template_id_idx"
  ON "visa_document_template_items"("template_id");

DO $$ BEGIN
  ALTER TABLE "visa_document_template_items"
    ADD CONSTRAINT "visa_document_template_items_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "visa_document_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "visa_type_code" TEXT;
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "template_id" UUID;
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "template_version" INT;
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "secure_url" TEXT;
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "opened_at" TIMESTAMP(3);
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "intro_message" TEXT;
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "heading" TEXT;

CREATE TABLE IF NOT EXISTS "document_request_items" (
  "id" UUID NOT NULL,
  "document_request_id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "template_item_id" UUID,
  "category" TEXT NOT NULL,
  "document_key" TEXT NOT NULL,
  "document_name" TEXT NOT NULL,
  "instructions" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "allows_multiple_files" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "sort_order" INT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_request_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "document_request_items_request_id_idx"
  ON "document_request_items"("document_request_id");
CREATE INDEX IF NOT EXISTS "document_request_items_candidate_id_idx"
  ON "document_request_items"("candidate_id");
CREATE INDEX IF NOT EXISTS "document_request_items_status_idx"
  ON "document_request_items"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "document_request_items_request_key_key"
  ON "document_request_items"("document_request_id", "document_key");

DO $$ BEGIN
  ALTER TABLE "document_request_items"
    ADD CONSTRAINT "document_request_items_document_request_id_fkey"
    FOREIGN KEY ("document_request_id") REFERENCES "document_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "document_request_items"
    ADD CONSTRAINT "document_request_items_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "document_request_items"
    ADD CONSTRAINT "document_request_items_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "document_request_id" UUID;
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "document_request_item_id" UUID;
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "visa_type_code" TEXT;

CREATE INDEX IF NOT EXISTS "case_documents_document_request_id_idx" ON "case_documents"("document_request_id");
CREATE INDEX IF NOT EXISTS "case_documents_document_request_item_id_idx" ON "case_documents"("document_request_item_id");

DO $$ BEGIN
  ALTER TABLE "case_documents"
    ADD CONSTRAINT "case_documents_document_request_id_fkey"
    FOREIGN KEY ("document_request_id") REFERENCES "document_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "case_documents"
    ADD CONSTRAINT "case_documents_document_request_item_id_fkey"
    FOREIGN KEY ("document_request_item_id") REFERENCES "document_request_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "document_requests"
    ADD CONSTRAINT "document_requests_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "visa_document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
