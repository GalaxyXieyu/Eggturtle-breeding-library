CREATE TABLE IF NOT EXISTS "product_couple_photos" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "female_product_id" TEXT NOT NULL,
  "male_product_id_snapshot" TEXT,
  "female_code_snapshot" VARCHAR(120) NOT NULL,
  "male_code_snapshot" VARCHAR(120) NOT NULL,
  "female_image_key_snapshot" VARCHAR(500),
  "male_image_key_snapshot" VARCHAR(500),
  "price_snapshot" DECIMAL(10, 2),
  "template_version" VARCHAR(40) NOT NULL,
  "watermark_snapshot" JSONB,
  "image_key" VARCHAR(500) NOT NULL,
  "image_url" VARCHAR(1000) NOT NULL,
  "content_type" VARCHAR(255),
  "size_bytes" BIGINT NOT NULL DEFAULT 0,
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "stale_reason" VARCHAR(80),
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generated_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_couple_photos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "product_couple_photos"
  ADD COLUMN IF NOT EXISTS "tenant_id" TEXT,
  ADD COLUMN IF NOT EXISTS "female_product_id" TEXT,
  ADD COLUMN IF NOT EXISTS "male_product_id_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "female_code_snapshot" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "male_code_snapshot" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "female_image_key_snapshot" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "male_image_key_snapshot" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "price_snapshot" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "template_version" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "watermark_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "image_key" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "content_type" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "size_bytes" BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_current" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "stale_reason" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "generated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "generated_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

UPDATE "product_couple_photos"
SET
  "size_bytes" = COALESCE("size_bytes", 0),
  "is_current" = COALESCE("is_current", true),
  "generated_at" = COALESCE("generated_at", CURRENT_TIMESTAMP),
  "created_at" = COALESCE("created_at", CURRENT_TIMESTAMP),
  "updated_at" = COALESCE("updated_at", COALESCE("generated_at", CURRENT_TIMESTAMP))
WHERE
  "size_bytes" IS NULL
  OR "is_current" IS NULL
  OR "generated_at" IS NULL
  OR "created_at" IS NULL
  OR "updated_at" IS NULL;

ALTER TABLE "product_couple_photos"
  ALTER COLUMN "size_bytes" SET DEFAULT 0,
  ALTER COLUMN "is_current" SET DEFAULT true,
  ALTER COLUMN "generated_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_couple_photos' AND column_name = 'tenant_id') THEN
    ALTER TABLE "product_couple_photos" ALTER COLUMN "tenant_id" SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_couple_photos' AND column_name = 'female_product_id') THEN
    ALTER TABLE "product_couple_photos" ALTER COLUMN "female_product_id" SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_couple_photos' AND column_name = 'female_code_snapshot') THEN
    ALTER TABLE "product_couple_photos" ALTER COLUMN "female_code_snapshot" SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_couple_photos' AND column_name = 'male_code_snapshot') THEN
    ALTER TABLE "product_couple_photos" ALTER COLUMN "male_code_snapshot" SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_couple_photos' AND column_name = 'template_version') THEN
    ALTER TABLE "product_couple_photos" ALTER COLUMN "template_version" SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_couple_photos' AND column_name = 'image_key') THEN
    ALTER TABLE "product_couple_photos" ALTER COLUMN "image_key" SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_couple_photos' AND column_name = 'image_url') THEN
    ALTER TABLE "product_couple_photos" ALTER COLUMN "image_url" SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_couple_photos' AND column_name = 'size_bytes') THEN
    ALTER TABLE "product_couple_photos" ALTER COLUMN "size_bytes" SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_couple_photos' AND column_name = 'is_current') THEN
    ALTER TABLE "product_couple_photos" ALTER COLUMN "is_current" SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_couple_photos' AND column_name = 'generated_at') THEN
    ALTER TABLE "product_couple_photos" ALTER COLUMN "generated_at" SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_couple_photos' AND column_name = 'generated_by_user_id') THEN
    ALTER TABLE "product_couple_photos" ALTER COLUMN "generated_by_user_id" SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_couple_photos' AND column_name = 'created_at') THEN
    ALTER TABLE "product_couple_photos" ALTER COLUMN "created_at" SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_couple_photos' AND column_name = 'updated_at') THEN
    ALTER TABLE "product_couple_photos" ALTER COLUMN "updated_at" SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "product_couple_photos_tenant_id_idx"
  ON "product_couple_photos" ("tenant_id");
CREATE INDEX IF NOT EXISTS "product_couple_photos_tenant_id_female_product_id_idx"
  ON "product_couple_photos" ("tenant_id", "female_product_id");
CREATE INDEX IF NOT EXISTS "product_couple_photos_tenant_female_current_idx"
  ON "product_couple_photos" ("tenant_id", "female_product_id", "is_current");
CREATE INDEX IF NOT EXISTS "product_couple_photos_generated_by_user_id_idx"
  ON "product_couple_photos" ("generated_by_user_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_couple_photos_tenant_id_fkey') THEN
    ALTER TABLE "product_couple_photos"
      ADD CONSTRAINT "product_couple_photos_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_couple_photos_female_product_id_tenant_id_fkey') THEN
    ALTER TABLE "product_couple_photos"
      ADD CONSTRAINT "product_couple_photos_female_product_id_tenant_id_fkey"
      FOREIGN KEY ("female_product_id", "tenant_id") REFERENCES "products"("id", "tenant_id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_couple_photos_generated_by_user_id_fkey') THEN
    ALTER TABLE "product_couple_photos"
      ADD CONSTRAINT "product_couple_photos_generated_by_user_id_fkey"
      FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
