ALTER TABLE "public_shares"
ADD COLUMN "presentation_override" JSONB;

CREATE TABLE "tenant_share_presentation_configs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "feed_title" VARCHAR(120),
  "feed_subtitle" VARCHAR(240),
  "brand_primary" VARCHAR(20),
  "brand_secondary" VARCHAR(20),
  "hero_images" JSONB,
  "show_wechat_block" BOOLEAN NOT NULL DEFAULT false,
  "wechat_qr_image_url" VARCHAR(1000),
  "wechat_id" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_share_presentation_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_share_presentation_configs_tenant_id_key"
ON "tenant_share_presentation_configs"("tenant_id");

CREATE INDEX "tenant_share_presentation_configs_tenant_id_idx"
ON "tenant_share_presentation_configs"("tenant_id");

ALTER TABLE "tenant_share_presentation_configs"
ADD CONSTRAINT "tenant_share_presentation_configs_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
