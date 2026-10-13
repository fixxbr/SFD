-- AlterTable
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "client_idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "case_documents_case_id_client_idempotency_key_key"
  ON "case_documents"("case_id", "client_idempotency_key");
