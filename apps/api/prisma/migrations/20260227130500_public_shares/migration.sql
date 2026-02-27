CREATE TABLE "public_shares" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "share_token" VARCHAR(120) NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "public_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_shares_share_token_key" ON "public_shares"("share_token");
CREATE UNIQUE INDEX "public_shares_tenant_id_product_id_key" ON "public_shares"("tenant_id", "product_id");
CREATE INDEX "public_shares_tenant_id_idx" ON "public_shares"("tenant_id");
CREATE INDEX "public_shares_product_id_idx" ON "public_shares"("product_id");
CREATE INDEX "public_shares_created_by_user_id_idx" ON "public_shares"("created_by_user_id");

ALTER TABLE "public_shares"
ADD CONSTRAINT "public_shares_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public_shares"
ADD CONSTRAINT "public_shares_product_id_tenant_id_fkey"
FOREIGN KEY ("product_id", "tenant_id") REFERENCES "products"("id", "tenant_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public_shares"
ADD CONSTRAINT "public_shares_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
