-- CreateTable
CREATE TABLE "featured_products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "featured_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "featured_products_tenant_id_idx" ON "featured_products"("tenant_id");

-- CreateIndex
CREATE INDEX "featured_products_tenant_id_sort_order_idx" ON "featured_products"("tenant_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "featured_products_tenant_id_product_id_key" ON "featured_products"("tenant_id", "product_id");

-- AddForeignKey
ALTER TABLE "featured_products" ADD CONSTRAINT "featured_products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_products" ADD CONSTRAINT "featured_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
