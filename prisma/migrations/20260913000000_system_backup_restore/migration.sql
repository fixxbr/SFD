-- System backup / restore job history
CREATE TYPE "BackupJobKind" AS ENUM ('FULL', 'DATA_ONLY', 'DOCUMENTS_ONLY', 'EXCEL', 'CSV', 'PRE_RESTORE');
CREATE TYPE "BackupJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');
CREATE TYPE "RestoreMode" AS ENUM ('MERGE', 'MISSING_ONLY', 'UPDATE_EXISTING', 'FULL');
CREATE TYPE "RestoreJobStatus" AS ENUM ('VALIDATING', 'PREVIEW_READY', 'IMPORTING', 'VERIFYING', 'COMPLETED', 'FAILED');

CREATE TABLE "backup_jobs" (
    "id" UUID NOT NULL,
    "kind" "BackupJobKind" NOT NULL DEFAULT 'FULL',
    "status" "BackupJobStatus" NOT NULL DEFAULT 'PENDING',
    "filename" TEXT,
    "byte_size" INTEGER,
    "candidate_count" INTEGER NOT NULL DEFAULT 0,
    "document_count" INTEGER NOT NULL DEFAULT 0,
    "case_count" INTEGER NOT NULL DEFAULT 0,
    "payment_count" INTEGER NOT NULL DEFAULT 0,
    "files_included" INTEGER NOT NULL DEFAULT 0,
    "files_missing" INTEGER NOT NULL DEFAULT 0,
    "manifest_json" JSONB,
    "warning_report" JSONB,
    "error_message" TEXT,
    "requested_by_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "restore_jobs" (
    "id" UUID NOT NULL,
    "status" "RestoreJobStatus" NOT NULL DEFAULT 'VALIDATING',
    "mode" "RestoreMode" NOT NULL DEFAULT 'MERGE',
    "source_filename" TEXT,
    "byte_size" INTEGER,
    "summary_json" JSONB,
    "result_json" JSONB,
    "error_message" TEXT,
    "pre_restore_backup_id" UUID,
    "confirmation_text" TEXT,
    "requested_by_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "restore_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "backup_jobs_created_at_idx" ON "backup_jobs"("created_at");
CREATE INDEX "backup_jobs_requested_by_id_idx" ON "backup_jobs"("requested_by_id");
CREATE INDEX "restore_jobs_created_at_idx" ON "restore_jobs"("created_at");
CREATE INDEX "restore_jobs_requested_by_id_idx" ON "restore_jobs"("requested_by_id");

ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "restore_jobs" ADD CONSTRAINT "restore_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
