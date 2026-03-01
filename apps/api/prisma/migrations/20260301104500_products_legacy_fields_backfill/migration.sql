-- AlterTable
ALTER TABLE "products"
ADD COLUMN "series_id" TEXT,
ADD COLUMN "sex" VARCHAR(20),
ADD COLUMN "offspring_unit_price" DECIMAL(10, 2),
ADD COLUMN "sire_code" VARCHAR(120),
ADD COLUMN "dam_code" VARCHAR(120),
ADD COLUMN "mate_code" VARCHAR(120),
ADD COLUMN "exclude_from_breeding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "has_sample" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "in_stock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "popularity_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "products_tenant_id_series_id_idx" ON "products"("tenant_id", "series_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_sex_idx" ON "products"("tenant_id", "sex");

-- AddForeignKey
ALTER TABLE "products"
ADD CONSTRAINT "products_series_id_tenant_id_fkey"
FOREIGN KEY ("series_id", "tenant_id") REFERENCES "series"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
