-- Optional payment receipt proof attachments (manual finance)
ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "attachment_storage_key" TEXT;
ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "attachment_filename" TEXT;
ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "attachment_mime_type" TEXT;
ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "attachment_size_bytes" INTEGER;
ALTER TABLE "payment_receipts" ADD COLUMN IF NOT EXISTS "attachment_provider" TEXT;
