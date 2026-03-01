ALTER TABLE "products"
ADD COLUMN "type" VARCHAR(80);

CREATE INDEX "products_tenant_id_type_idx"
ON "products"("tenant_id", "type");
