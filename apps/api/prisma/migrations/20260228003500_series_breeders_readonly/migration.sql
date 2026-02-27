-- CreateTable
CREATE TABLE "series" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breeders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "series_id" TEXT NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120),
    "sex" VARCHAR(20),
    "description" TEXT,
    "sire_code" VARCHAR(120),
    "dam_code" VARCHAR(120),
    "mate_code" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "breeders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breeder_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "breeder_id" TEXT NOT NULL,
    "event_type" VARCHAR(40) NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "breeder_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "series_id_tenant_id_key" ON "series"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "series_tenant_id_code_key" ON "series"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "series_tenant_id_idx" ON "series"("tenant_id");

-- CreateIndex
CREATE INDEX "series_tenant_id_sort_order_idx" ON "series"("tenant_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "breeders_id_tenant_id_key" ON "breeders"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "breeders_tenant_id_code_key" ON "breeders"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "breeders_tenant_id_idx" ON "breeders"("tenant_id");

-- CreateIndex
CREATE INDEX "breeders_tenant_id_series_id_idx" ON "breeders"("tenant_id", "series_id");

-- CreateIndex
CREATE INDEX "breeder_events_tenant_id_idx" ON "breeder_events"("tenant_id");

-- CreateIndex
CREATE INDEX "breeder_events_tenant_id_breeder_id_idx" ON "breeder_events"("tenant_id", "breeder_id");

-- CreateIndex
CREATE INDEX "breeder_events_tenant_id_breeder_id_event_date_idx" ON "breeder_events"("tenant_id", "breeder_id", "event_date");

-- AddForeignKey
ALTER TABLE "series" ADD CONSTRAINT "series_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breeders" ADD CONSTRAINT "breeders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breeders" ADD CONSTRAINT "breeders_series_id_tenant_id_fkey" FOREIGN KEY ("series_id", "tenant_id") REFERENCES "series"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breeder_events" ADD CONSTRAINT "breeder_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breeder_events" ADD CONSTRAINT "breeder_events_breeder_id_tenant_id_fkey" FOREIGN KEY ("breeder_id", "tenant_id") REFERENCES "breeders"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
