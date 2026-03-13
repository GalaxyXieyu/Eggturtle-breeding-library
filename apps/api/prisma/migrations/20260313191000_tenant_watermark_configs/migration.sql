CREATE TABLE "tenant_watermark_configs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "text_mode" VARCHAR(32) NOT NULL DEFAULT 'AUTO_TENANT_NAME',
  "custom_text" VARCHAR(64),
  "apply_to_share_poster" BOOLEAN NOT NULL DEFAULT true,
  "apply_to_couple_photo" BOOLEAN NOT NULL DEFAULT true,
  "apply_to_certificate" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_watermark_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_watermark_configs_tenant_id_key"
  ON "tenant_watermark_configs"("tenant_id");

CREATE INDEX "tenant_watermark_configs_tenant_id_idx"
  ON "tenant_watermark_configs"("tenant_id");

ALTER TABLE "tenant_watermark_configs"
  ADD CONSTRAINT "tenant_watermark_configs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
