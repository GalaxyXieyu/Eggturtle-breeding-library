CREATE TABLE "product_certificates" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "cert_no" VARCHAR(120) NOT NULL,
  "verify_id" VARCHAR(40) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'ISSUED',
  "template_version" VARCHAR(40) NOT NULL,
  "lineage_snapshot" JSONB NOT NULL,
  "watermark_snapshot" JSONB,
  "image_key" VARCHAR(500) NOT NULL,
  "image_url" VARCHAR(1000) NOT NULL,
  "content_type" VARCHAR(255),
  "size_bytes" BIGINT NOT NULL DEFAULT 0,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issued_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_certificates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_certificate_quota_monthly" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "month_key" VARCHAR(6) NOT NULL,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_certificate_quota_monthly_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_couple_photos" (
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

CREATE UNIQUE INDEX "product_certificates_verify_id_key"
ON "product_certificates"("verify_id");

CREATE UNIQUE INDEX "product_certificates_tenant_id_cert_no_key"
ON "product_certificates"("tenant_id", "cert_no");

CREATE INDEX "product_certificates_tenant_id_idx"
ON "product_certificates"("tenant_id");

CREATE INDEX "product_certificates_tenant_id_product_id_idx"
ON "product_certificates"("tenant_id", "product_id");

CREATE INDEX "product_certificates_tenant_id_issued_at_idx"
ON "product_certificates"("tenant_id", "issued_at");

CREATE INDEX "product_certificates_issued_by_user_id_idx"
ON "product_certificates"("issued_by_user_id");

CREATE UNIQUE INDEX "tenant_certificate_quota_monthly_tenant_id_month_key_key"
ON "tenant_certificate_quota_monthly"("tenant_id", "month_key");

CREATE INDEX "tenant_certificate_quota_monthly_tenant_id_idx"
ON "tenant_certificate_quota_monthly"("tenant_id");

CREATE INDEX "product_couple_photos_tenant_id_idx"
ON "product_couple_photos"("tenant_id");

CREATE INDEX "product_couple_photos_tenant_id_female_product_id_idx"
ON "product_couple_photos"("tenant_id", "female_product_id");

CREATE INDEX "product_couple_photos_tenant_female_current_idx"
ON "product_couple_photos"("tenant_id", "female_product_id", "is_current");

CREATE INDEX "product_couple_photos_generated_by_user_id_idx"
ON "product_couple_photos"("generated_by_user_id");

ALTER TABLE "product_certificates"
ADD CONSTRAINT "product_certificates_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_certificates"
ADD CONSTRAINT "product_certificates_product_id_tenant_id_fkey"
FOREIGN KEY ("product_id", "tenant_id") REFERENCES "products"("id", "tenant_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_certificates"
ADD CONSTRAINT "product_certificates_issued_by_user_id_fkey"
FOREIGN KEY ("issued_by_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_certificate_quota_monthly"
ADD CONSTRAINT "tenant_certificate_quota_monthly_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_couple_photos"
ADD CONSTRAINT "product_couple_photos_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_couple_photos"
ADD CONSTRAINT "product_couple_photos_female_product_id_tenant_id_fkey"
FOREIGN KEY ("female_product_id", "tenant_id") REFERENCES "products"("id", "tenant_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_couple_photos"
ADD CONSTRAINT "product_couple_photos_generated_by_user_id_fkey"
FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
