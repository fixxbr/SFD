-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'CASE_MANAGER', 'ATTORNEY', 'FINANCE', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "RecordLifecycle" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VisaType" AS ENUM ('O_1A', 'O_1B', 'EB_1A', 'EB_2_NIW', 'EB_5', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('ASSESSMENT', 'QUALIFIED', 'ONBOARDING_NOT_SENT', 'ONBOARDING_SENT', 'ONBOARDING_IN_PROGRESS', 'ONBOARDING_SUBMITTED', 'DOCUMENT_REVIEW', 'MORE_DOCUMENTS_REQUIRED', 'EVIDENCE_BUILDING', 'ATTORNEY_REVIEW', 'PETITION_DRAFTING', 'CLIENT_REVIEW', 'READY_TO_FILE', 'FILED', 'USCIS_REVIEW', 'RFE', 'RFE_RESPONSE', 'APPROVED', 'DENIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('MISSING', 'UPLOADED', 'UNDER_REVIEW', 'ACCEPTED', 'NEEDS_REPLACEMENT', 'REJECTED', 'NOT_APPLICABLE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'REQUESTED', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('INTERNAL', 'CLIENT_VISIBLE');

-- CreateEnum
CREATE TYPE "UploadedByType" AS ENUM ('CANDIDATE', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "QuestionReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'NEEDS_MORE_INFORMATION');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "auth_provider" TEXT NOT NULL DEFAULT 'password',
    "role" "AdminRole" NOT NULL,
    "status" "AdminStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL,
    "full_legal_name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "phone" TEXT,
    "date_of_birth" DATE,
    "nationality" TEXT,
    "current_immigration_status" TEXT,
    "current_address" TEXT,
    "source" TEXT NOT NULL,
    "assessment_completed" BOOLEAN NOT NULL DEFAULT false,
    "assessment_completed_at" TIMESTAMP(3),
    "lifecycle" "RecordLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "submitted_data" JSONB NOT NULL,
    "result" TEXT,
    "visa_recommendation" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "case_number" TEXT NOT NULL,
    "visa_type" "VisaType" NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'ASSESSMENT',
    "lifecycle" "RecordLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "assigned_case_manager_id" UUID,
    "assigned_attorney_id" UUID,
    "engagement_amount_cents" INTEGER,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filed_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_status_history" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "from_status" "CaseStatus",
    "to_status" "CaseStatus" NOT NULL,
    "changed_by" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "o1_onboarding_submissions" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "submitted_at" TIMESTAMP(3),
    "last_saved_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "o1_onboarding_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_invites" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_documents" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "onboarding_submission_id" UUID,
    "category" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "question_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "storage_provider" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_current_version" BOOLEAN NOT NULL DEFAULT true,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by_type" "UploadedByType" NOT NULL,
    "uploaded_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" UUID,
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_notes" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'INTERNAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_activity" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "case_id" UUID,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripe_checkout_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "payment_link" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_log" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "case_id" UUID,
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sent_by" UUID,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_user_id_idx" ON "admin_sessions"("admin_user_id");

-- CreateIndex
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "login_attempts_email_created_at_idx" ON "login_attempts"("email", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_ip_address_created_at_idx" ON "login_attempts"("ip_address", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_id_idx" ON "admin_audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_entity_type_entity_id_idx" ON "admin_audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "candidates_normalized_email_idx" ON "candidates"("normalized_email");

-- CreateIndex
CREATE INDEX "candidates_normalized_name_idx" ON "candidates"("normalized_name");

-- CreateIndex
CREATE INDEX "candidates_lifecycle_idx" ON "candidates"("lifecycle");

-- CreateIndex
CREATE INDEX "candidates_created_at_idx" ON "candidates"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_normalized_name_normalized_email_key" ON "candidates"("normalized_name", "normalized_email");

-- CreateIndex
CREATE INDEX "assessments_candidate_id_idx" ON "assessments"("candidate_id");

-- CreateIndex
CREATE INDEX "assessments_submitted_at_idx" ON "assessments"("submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cases_case_number_key" ON "cases"("case_number");

-- CreateIndex
CREATE INDEX "cases_candidate_id_idx" ON "cases"("candidate_id");

-- CreateIndex
CREATE INDEX "cases_case_number_idx" ON "cases"("case_number");

-- CreateIndex
CREATE INDEX "cases_status_idx" ON "cases"("status");

-- CreateIndex
CREATE INDEX "cases_lifecycle_idx" ON "cases"("lifecycle");

-- CreateIndex
CREATE INDEX "cases_assigned_case_manager_id_idx" ON "cases"("assigned_case_manager_id");

-- CreateIndex
CREATE INDEX "cases_assigned_attorney_id_idx" ON "cases"("assigned_attorney_id");

-- CreateIndex
CREATE INDEX "case_status_history_case_id_idx" ON "case_status_history"("case_id");

-- CreateIndex
CREATE INDEX "o1_onboarding_submissions_candidate_id_idx" ON "o1_onboarding_submissions"("candidate_id");

-- CreateIndex
CREATE INDEX "o1_onboarding_submissions_case_id_idx" ON "o1_onboarding_submissions"("case_id");

-- CreateIndex
CREATE INDEX "o1_onboarding_submissions_status_idx" ON "o1_onboarding_submissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_invites_token_hash_key" ON "onboarding_invites"("token_hash");

-- CreateIndex
CREATE INDEX "onboarding_invites_candidate_id_idx" ON "onboarding_invites"("candidate_id");

-- CreateIndex
CREATE INDEX "onboarding_invites_case_id_idx" ON "onboarding_invites"("case_id");

-- CreateIndex
CREATE INDEX "case_documents_candidate_id_idx" ON "case_documents"("candidate_id");

-- CreateIndex
CREATE INDEX "case_documents_case_id_idx" ON "case_documents"("case_id");

-- CreateIndex
CREATE INDEX "case_documents_category_idx" ON "case_documents"("category");

-- CreateIndex
CREATE INDEX "case_documents_status_idx" ON "case_documents"("status");

-- CreateIndex
CREATE INDEX "case_documents_question_key_is_current_version_idx" ON "case_documents"("question_key", "is_current_version");

-- CreateIndex
CREATE INDEX "case_documents_storage_key_idx" ON "case_documents"("storage_key");

-- CreateIndex
CREATE INDEX "case_notes_candidate_id_idx" ON "case_notes"("candidate_id");

-- CreateIndex
CREATE INDEX "case_notes_case_id_idx" ON "case_notes"("case_id");

-- CreateIndex
CREATE INDEX "case_activity_case_id_idx" ON "case_activity"("case_id");

-- CreateIndex
CREATE INDEX "case_activity_candidate_id_idx" ON "case_activity"("candidate_id");

-- CreateIndex
CREATE INDEX "case_activity_created_at_idx" ON "case_activity"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_checkout_session_id_key" ON "payments"("stripe_checkout_session_id");

-- CreateIndex
CREATE INDEX "payments_case_id_idx" ON "payments"("case_id");

-- CreateIndex
CREATE INDEX "payments_candidate_id_idx" ON "payments"("candidate_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_case_id_installment_number_key" ON "payments"("case_id", "installment_number");

-- CreateIndex
CREATE INDEX "email_log_candidate_id_idx" ON "email_log"("candidate_id");

-- CreateIndex
CREATE INDEX "email_log_case_id_idx" ON "email_log"("case_id");

-- CreateIndex
CREATE INDEX "email_log_sent_at_idx" ON "email_log"("sent_at");

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_case_manager_id_fkey" FOREIGN KEY ("assigned_case_manager_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_attorney_id_fkey" FOREIGN KEY ("assigned_attorney_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "o1_onboarding_submissions" ADD CONSTRAINT "o1_onboarding_submissions_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "o1_onboarding_submissions" ADD CONSTRAINT "o1_onboarding_submissions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "o1_onboarding_submissions" ADD CONSTRAINT "o1_onboarding_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_invites" ADD CONSTRAINT "onboarding_invites_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_invites" ADD CONSTRAINT "onboarding_invites_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_onboarding_submission_id_fkey" FOREIGN KEY ("onboarding_submission_id") REFERENCES "o1_onboarding_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_activity" ADD CONSTRAINT "case_activity_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_activity" ADD CONSTRAINT "case_activity_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

