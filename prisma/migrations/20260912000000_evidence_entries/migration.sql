-- Evidence entries (education / transcripts / employment / licenses / clients)
-- with multi-document attachments per entry.

CREATE TYPE "EvidenceSection" AS ENUM ('EDUCATION', 'TRANSCRIPT', 'EMPLOYMENT', 'LICENSE', 'CLIENT');

CREATE TABLE "evidence_entries" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "section" "EvidenceSection" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evidence_entries_candidate_id_idx" ON "evidence_entries"("candidate_id");
CREATE INDEX "evidence_entries_case_id_idx" ON "evidence_entries"("case_id");
CREATE INDEX "evidence_entries_section_idx" ON "evidence_entries"("section");
CREATE INDEX "evidence_entries_case_id_section_idx" ON "evidence_entries"("case_id", "section");

ALTER TABLE "evidence_entries" ADD CONSTRAINT "evidence_entries_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_entries" ADD CONSTRAINT "evidence_entries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "evidence_entry_id" UUID;
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "display_name" TEXT;

CREATE INDEX IF NOT EXISTS "case_documents_evidence_entry_id_idx" ON "case_documents"("evidence_entry_id");

ALTER TABLE "case_documents" DROP CONSTRAINT IF EXISTS "case_documents_evidence_entry_id_fkey";
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_evidence_entry_id_fkey" FOREIGN KEY ("evidence_entry_id") REFERENCES "evidence_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
