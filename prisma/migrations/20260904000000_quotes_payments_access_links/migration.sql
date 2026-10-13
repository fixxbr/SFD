-- Afterstem: quoted engagement amounts, expanded payment statuses,
-- candidate_access_links + optional email OTP verification.

-- PaymentStatus: replace old enum values
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";

CREATE TYPE "PaymentStatus" AS ENUM (
  'DRAFT',
  'READY',
  'PAYMENT_LINK_GENERATED',
  'PAYMENT_LINK_SENT',
  'PROCESSING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'WAIVED'
);

ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "payments"
  ALTER COLUMN "status" TYPE "PaymentStatus"
  USING (
    CASE "status"::text
      WHEN 'PENDING' THEN 'DRAFT'::"PaymentStatus"
      WHEN 'REQUESTED' THEN 'PAYMENT_LINK_SENT'::"PaymentStatus"
      WHEN 'PAID' THEN 'PAID'::"PaymentStatus"
      WHEN 'FAILED' THEN 'FAILED'::"PaymentStatus"
      WHEN 'CANCELED' THEN 'EXPIRED'::"PaymentStatus"
      WHEN 'REFUNDED' THEN 'REFUNDED'::"PaymentStatus"
      ELSE 'DRAFT'::"PaymentStatus"
    END
  );

ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"PaymentStatus";

DROP TYPE "PaymentStatus_old";

CREATE TYPE "AccessLinkPurpose" AS ENUM (
  'ONBOARDING',
  'DOCUMENT_UPLOAD',
  'PAYMENT',
  'CASE_UPDATE'
);

-- Cases: rename engagement → quoted + financial / filing override fields
ALTER TABLE "cases" RENAME COLUMN "engagement_amount_cents" TO "quoted_amount_cents";
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'usd';
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "quoted_amount_locked_at" TIMESTAMP(3);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "quoted_amount_updated_by" UUID;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "filing_payment_override_at" TIMESTAMP(3);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "filing_payment_override_by" UUID;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "filing_payment_override_reason" TEXT;

ALTER TABLE "cases"
  ADD CONSTRAINT "cases_quoted_amount_updated_by_fkey"
  FOREIGN KEY ("quoted_amount_updated_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cases"
  ADD CONSTRAINT "cases_filing_payment_override_by_fkey"
  FOREIGN KEY ("filing_payment_override_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payments: richer Stripe / link tracking
ALTER TABLE "payments" RENAME COLUMN "payment_link" TO "payment_url";
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_link_generated_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_link_sent_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paid_amount_cents" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_method_type" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "card_last4" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "created_by" UUID;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Secure email-only candidate access (no passwords)
CREATE TABLE "candidate_access_links" (
  "id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "purpose" "AccessLinkPurpose" NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "requires_email_verification" BOOLEAN NOT NULL DEFAULT false,
  "payment_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "candidate_access_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_access_links_token_hash_key" ON "candidate_access_links"("token_hash");
CREATE INDEX "candidate_access_links_candidate_id_idx" ON "candidate_access_links"("candidate_id");
CREATE INDEX "candidate_access_links_case_id_idx" ON "candidate_access_links"("case_id");
CREATE INDEX "candidate_access_links_purpose_idx" ON "candidate_access_links"("purpose");

ALTER TABLE "candidate_access_links"
  ADD CONSTRAINT "candidate_access_links_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_access_links"
  ADD CONSTRAINT "candidate_access_links_case_id_fkey"
  FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "email_verification_codes" (
  "id" UUID NOT NULL,
  "access_link_id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "code_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_verification_codes_access_link_id_idx" ON "email_verification_codes"("access_link_id");
CREATE INDEX "email_verification_codes_candidate_id_idx" ON "email_verification_codes"("candidate_id");

ALTER TABLE "email_verification_codes"
  ADD CONSTRAINT "email_verification_codes_access_link_id_fkey"
  FOREIGN KEY ("access_link_id") REFERENCES "candidate_access_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_verification_codes"
  ADD CONSTRAINT "email_verification_codes_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
