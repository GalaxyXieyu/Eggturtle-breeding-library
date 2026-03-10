CREATE TABLE "platform_branding_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "app_name_zh" VARCHAR(160) NOT NULL DEFAULT '选育溯源档案',
    "app_name_en" VARCHAR(160) NOT NULL DEFAULT 'Breeding Traceability Record',
    "app_eyebrow_zh" VARCHAR(160) NOT NULL DEFAULT 'Breeding Traceability Record',
    "app_eyebrow_en" VARCHAR(160) NOT NULL DEFAULT '选育溯源档案',
    "app_description_zh" VARCHAR(280) NOT NULL DEFAULT '让每一条选育、配对、产蛋与孵化记录，都沉淀为可查、可验、可复盘的繁育档案。',
    "app_description_en" VARCHAR(280) NOT NULL DEFAULT 'A trusted workspace for breeder records, pairing timelines, and hatch traceability.',
    "admin_title_zh" VARCHAR(160) NOT NULL DEFAULT '选育溯源档案 平台后台',
    "admin_title_en" VARCHAR(160) NOT NULL DEFAULT 'Breeding Traceability Record Admin Console',
    "admin_subtitle_zh" VARCHAR(280) NOT NULL DEFAULT '跨用户运维控制台',
    "admin_subtitle_en" VARCHAR(280) NOT NULL DEFAULT 'Cross-tenant operations control',
    "default_tenant_name_zh" VARCHAR(160) NOT NULL DEFAULT '选育溯源档案',
    "default_tenant_name_en" VARCHAR(160) NOT NULL DEFAULT 'Breeding Traceability Record',
    "public_catalog_title_suffix_zh" VARCHAR(160) NOT NULL DEFAULT '公开图鉴',
    "public_catalog_title_suffix_en" VARCHAR(160) NOT NULL DEFAULT 'Public Catalog',
    "public_catalog_subtitle_suffix_zh" VARCHAR(280) NOT NULL DEFAULT '在库产品展示',
    "public_catalog_subtitle_suffix_en" VARCHAR(280) NOT NULL DEFAULT 'Catalog showcase',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_branding_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_branding_overrides" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "display_name" VARCHAR(120),
    "public_title" VARCHAR(120),
    "public_subtitle" VARCHAR(240),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_branding_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_branding_overrides_tenant_id_key" ON "tenant_branding_overrides"("tenant_id");
CREATE INDEX "tenant_branding_overrides_tenant_id_idx" ON "tenant_branding_overrides"("tenant_id");

ALTER TABLE "tenant_branding_overrides"
ADD CONSTRAINT "tenant_branding_overrides_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "platform_branding_configs" ("id", "updated_at")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
