-- Email templates storage (professional Afterstem branded HTML)
CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" UUID PRIMARY KEY,
  "template_key" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "subject_template" TEXT NOT NULL,
  "html_template" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
