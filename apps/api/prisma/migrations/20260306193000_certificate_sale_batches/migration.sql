ALTER TABLE "product_events"
ADD CONSTRAINT "product_events_id_tenant_id_key" UNIQUE ("id", "tenant_id");

ALTER TABLE "product_certificates"
ADD COLUMN "egg_event_id" TEXT,
ADD COLUMN "sale_batch_id" TEXT,
ADD COLUMN "sale_allocation_id" TEXT,
ADD COLUMN "subject_media_id" TEXT,
ADD COLUMN "previous_certificate_id" TEXT,
ADD COLUMN "version_no" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "void_reason" VARCHAR(240),
ADD COLUMN "sale_snapshot" JSONB;

CREATE TABLE "sale_batches" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "female_product_id" TEXT NOT NULL,
  "egg_event_id" TEXT NOT NULL,
  "batch_no" VARCHAR(120) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'OPEN',
  "planned_quantity" INTEGER NOT NULL DEFAULT 1,
  "sold_quantity" INTEGER NOT NULL DEFAULT 0,
  "event_date_snapshot" TIMESTAMP(3) NOT NULL,
  "egg_count_snapshot" INTEGER,
  "female_code_snapshot" VARCHAR(120) NOT NULL,
  "sire_code_snapshot" VARCHAR(120) NOT NULL,
  "series_name_snapshot" VARCHAR(120),
  "price_low" DECIMAL(10, 2),
  "price_high" DECIMAL(10, 2),
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sale_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_allocations" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "sale_batch_id" TEXT NOT NULL,
  "allocation_no" VARCHAR(120) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'SOLD',
  "quantity" INTEGER NOT NULL,
  "buyer_name" VARCHAR(120) NOT NULL,
  "buyer_account_id" VARCHAR(120),
  "buyer_contact" VARCHAR(120),
  "unit_price" DECIMAL(10, 2),
  "channel" VARCHAR(80),
  "campaign_id" VARCHAR(120),
  "note" TEXT,
  "sold_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sale_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_subject_media" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "female_product_id" TEXT NOT NULL,
  "sale_batch_id" TEXT NOT NULL,
  "label" VARCHAR(120),
  "image_key" VARCHAR(500) NOT NULL,
  "image_url" VARCHAR(1000) NOT NULL,
  "content_type" VARCHAR(255),
  "size_bytes" BIGINT NOT NULL DEFAULT 0,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sale_subject_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sale_batches_id_tenant_id_key"
ON "sale_batches"("id", "tenant_id");

CREATE UNIQUE INDEX "sale_batches_tenant_id_batch_no_key"
ON "sale_batches"("tenant_id", "batch_no");

CREATE INDEX "sale_batches_tenant_id_idx"
ON "sale_batches"("tenant_id");

CREATE INDEX "sale_batches_tenant_id_female_product_id_idx"
ON "sale_batches"("tenant_id", "female_product_id");

CREATE INDEX "sale_batches_tenant_id_egg_event_id_idx"
ON "sale_batches"("tenant_id", "egg_event_id");

CREATE UNIQUE INDEX "sale_allocations_id_tenant_id_key"
ON "sale_allocations"("id", "tenant_id");

CREATE UNIQUE INDEX "sale_allocations_tenant_id_allocation_no_key"
ON "sale_allocations"("tenant_id", "allocation_no");

CREATE INDEX "sale_allocations_tenant_id_idx"
ON "sale_allocations"("tenant_id");

CREATE INDEX "sale_allocations_tenant_id_sale_batch_id_idx"
ON "sale_allocations"("tenant_id", "sale_batch_id");

CREATE INDEX "sale_allocations_tenant_id_buyer_name_idx"
ON "sale_allocations"("tenant_id", "buyer_name");

CREATE UNIQUE INDEX "sale_subject_media_id_tenant_id_key"
ON "sale_subject_media"("id", "tenant_id");

CREATE INDEX "sale_subject_media_tenant_id_idx"
ON "sale_subject_media"("tenant_id");

CREATE INDEX "sale_subject_media_tenant_id_female_product_id_idx"
ON "sale_subject_media"("tenant_id", "female_product_id");

CREATE INDEX "sale_subject_media_tenant_id_sale_batch_id_idx"
ON "sale_subject_media"("tenant_id", "sale_batch_id");

CREATE INDEX "sale_subject_media_tenant_batch_primary_idx"
ON "sale_subject_media"("tenant_id", "sale_batch_id", "is_primary");

CREATE INDEX "product_certificates_tenant_id_egg_event_id_idx"
ON "product_certificates"("tenant_id", "egg_event_id");

CREATE INDEX "product_certificates_tenant_id_sale_batch_id_idx"
ON "product_certificates"("tenant_id", "sale_batch_id");

CREATE INDEX "product_certificates_tenant_id_sale_allocation_id_idx"
ON "product_certificates"("tenant_id", "sale_allocation_id");

ALTER TABLE "sale_batches"
ADD CONSTRAINT "sale_batches_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_batches"
ADD CONSTRAINT "sale_batches_female_product_id_tenant_id_fkey"
FOREIGN KEY ("female_product_id", "tenant_id") REFERENCES "products"("id", "tenant_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_batches"
ADD CONSTRAINT "sale_batches_egg_event_id_tenant_id_fkey"
FOREIGN KEY ("egg_event_id", "tenant_id") REFERENCES "product_events"("id", "tenant_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_allocations"
ADD CONSTRAINT "sale_allocations_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_allocations"
ADD CONSTRAINT "sale_allocations_sale_batch_id_tenant_id_fkey"
FOREIGN KEY ("sale_batch_id", "tenant_id") REFERENCES "sale_batches"("id", "tenant_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_subject_media"
ADD CONSTRAINT "sale_subject_media_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_subject_media"
ADD CONSTRAINT "sale_subject_media_female_product_id_tenant_id_fkey"
FOREIGN KEY ("female_product_id", "tenant_id") REFERENCES "products"("id", "tenant_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_subject_media"
ADD CONSTRAINT "sale_subject_media_sale_batch_id_tenant_id_fkey"
FOREIGN KEY ("sale_batch_id", "tenant_id") REFERENCES "sale_batches"("id", "tenant_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_certificates"
ADD CONSTRAINT "product_certificates_egg_event_id_tenant_id_fkey"
FOREIGN KEY ("egg_event_id", "tenant_id") REFERENCES "product_events"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_certificates"
ADD CONSTRAINT "product_certificates_sale_batch_id_tenant_id_fkey"
FOREIGN KEY ("sale_batch_id", "tenant_id") REFERENCES "sale_batches"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_certificates"
ADD CONSTRAINT "product_certificates_sale_allocation_id_tenant_id_fkey"
FOREIGN KEY ("sale_allocation_id", "tenant_id") REFERENCES "sale_allocations"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_certificates"
ADD CONSTRAINT "product_certificates_subject_media_id_tenant_id_fkey"
FOREIGN KEY ("subject_media_id", "tenant_id") REFERENCES "sale_subject_media"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_certificates"
ADD CONSTRAINT "product_certificates_previous_certificate_id_fkey"
FOREIGN KEY ("previous_certificate_id") REFERENCES "product_certificates"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
