-- Enforce tenant isolation for FeaturedProduct -> Product relation.

-- 1) Provide a referenced unique constraint for composite FK.
CREATE UNIQUE INDEX "products_id_tenant_id_key" ON "products"("id", "tenant_id");

-- 2) Replace single-column FK with composite (product_id, tenant_id) FK.
ALTER TABLE "featured_products" DROP CONSTRAINT "featured_products_product_id_fkey";

ALTER TABLE "featured_products"
ADD CONSTRAINT "featured_products_product_id_tenant_id_fkey"
FOREIGN KEY ("product_id", "tenant_id")
REFERENCES "products"("id", "tenant_id")
ON DELETE CASCADE ON UPDATE CASCADE;
