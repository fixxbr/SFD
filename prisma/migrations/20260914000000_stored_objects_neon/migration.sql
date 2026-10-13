-- Persist document/receipt binaries in Neon (BYTEA) as the permanent source of truth.
CREATE TABLE IF NOT EXISTS "stored_objects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "mime_type" TEXT,
    "content" BYTEA NOT NULL,
    "checksum" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stored_objects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stored_objects_key_key" ON "stored_objects"("key");
CREATE INDEX IF NOT EXISTS "stored_objects_checksum_idx" ON "stored_objects"("checksum");
