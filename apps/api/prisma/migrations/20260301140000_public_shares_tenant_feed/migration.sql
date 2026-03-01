ALTER TABLE "public_shares"
ADD COLUMN "resource_type" VARCHAR(40);

ALTER TABLE "public_shares"
ADD COLUMN "resource_id" TEXT;

UPDATE "public_shares"
SET
  "resource_type" = 'product',
  "resource_id" = "product_id";

ALTER TABLE "public_shares"
ALTER COLUMN "resource_type" SET NOT NULL;

ALTER TABLE "public_shares"
ALTER COLUMN "resource_id" SET NOT NULL;

ALTER TABLE "public_shares"
ALTER COLUMN "product_id" DROP NOT NULL;

CREATE UNIQUE INDEX "public_shares_tenant_id_resource_type_resource_id_key"
ON "public_shares"("tenant_id", "resource_type", "resource_id");

CREATE INDEX "public_shares_tenant_id_resource_type_idx"
ON "public_shares"("tenant_id", "resource_type");
