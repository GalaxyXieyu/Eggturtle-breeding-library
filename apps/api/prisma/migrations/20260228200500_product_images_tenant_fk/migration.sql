ALTER TABLE "product_images" DROP CONSTRAINT "product_images_product_id_fkey";

ALTER TABLE "product_images"
ADD CONSTRAINT "product_images_product_id_tenant_id_fkey"
FOREIGN KEY ("product_id", "tenant_id") REFERENCES "products"("id", "tenant_id")
ON DELETE CASCADE ON UPDATE CASCADE;
