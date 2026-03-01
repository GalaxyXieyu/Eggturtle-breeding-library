-- Step 1: extend products with legacy breeder trace id.
ALTER TABLE "products"
ADD COLUMN "legacy_breeder_id" TEXT;

-- Step 2: create product_events (product-centric replacement of breeder_events).
CREATE TABLE "product_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "event_type" VARCHAR(40) NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_events_pkey" PRIMARY KEY ("id")
);

-- Step 3: map breeders to products by normalized code (case-insensitive),
-- prefer exact-case code then most recently updated product.
WITH ranked_matches AS (
    SELECT
        b.id AS breeder_id,
        p.id AS product_id,
        ROW_NUMBER() OVER (
            PARTITION BY b.id
            ORDER BY
                CASE WHEN p.code = b.code THEN 0 ELSE 1 END,
                p.updated_at DESC,
                p.created_at DESC,
                p.id DESC
        ) AS rn
    FROM "breeders" b
    JOIN "products" p
      ON p.tenant_id = b.tenant_id
     AND UPPER(TRIM(p.code)) = UPPER(TRIM(b.code))
),
picked_matches AS (
    SELECT breeder_id, product_id
    FROM ranked_matches
    WHERE rn = 1
)
UPDATE "products" p
SET
    "series_id" = b."series_id",
    "name" = COALESCE(NULLIF(TRIM(b."name"), ''), p."name"),
    "description" = COALESCE(NULLIF(TRIM(b."description"), ''), p."description"),
    "sex" = COALESCE(NULLIF(TRIM(b."sex"), ''), p."sex"),
    "sire_code" = COALESCE(NULLIF(TRIM(b."sire_code"), ''), p."sire_code"),
    "dam_code" = COALESCE(NULLIF(TRIM(b."dam_code"), ''), p."dam_code"),
    "mate_code" = COALESCE(NULLIF(TRIM(b."mate_code"), ''), p."mate_code"),
    "in_stock" = b."is_active",
    "legacy_breeder_id" = b."id",
    "updated_at" = GREATEST(p."updated_at", b."updated_at")
FROM picked_matches m
JOIN "breeders" b ON b."id" = m."breeder_id"
WHERE p."id" = m."product_id";

-- Step 4: create missing products from remaining breeders.
INSERT INTO "products" (
    "id",
    "tenant_id",
    "series_id",
    "legacy_breeder_id",
    "code",
    "name",
    "description",
    "sex",
    "sire_code",
    "dam_code",
    "mate_code",
    "exclude_from_breeding",
    "has_sample",
    "in_stock",
    "popularity_score",
    "is_featured",
    "created_at",
    "updated_at"
)
SELECT
    CONCAT('prd_merge_', b."id") AS id,
    b."tenant_id",
    b."series_id",
    b."id" AS legacy_breeder_id,
    b."code",
    COALESCE(NULLIF(TRIM(b."name"), ''), b."code"),
    NULLIF(TRIM(b."description"), ''),
    NULLIF(TRIM(b."sex"), ''),
    NULLIF(TRIM(b."sire_code"), ''),
    NULLIF(TRIM(b."dam_code"), ''),
    NULLIF(TRIM(b."mate_code"), ''),
    false,
    false,
    b."is_active",
    0,
    false,
    b."created_at",
    b."updated_at"
FROM "breeders" b
LEFT JOIN "products" p
  ON p."tenant_id" = b."tenant_id"
 AND UPPER(TRIM(p."code")) = UPPER(TRIM(b."code"))
WHERE p."id" IS NULL;

-- Step 5: move breeder_events to product_events via legacy_breeder_id mapping.
INSERT INTO "product_events" (
    "id",
    "tenant_id",
    "product_id",
    "event_type",
    "event_date",
    "note",
    "created_at",
    "updated_at"
)
SELECT
    be."id",
    be."tenant_id",
    p."id" AS product_id,
    be."event_type",
    be."event_date",
    be."note",
    be."created_at",
    be."updated_at"
FROM "breeder_events" be
JOIN "products" p
  ON p."tenant_id" = be."tenant_id"
 AND p."legacy_breeder_id" = be."breeder_id";

-- Step 6: indexes and foreign keys for new structure.
CREATE UNIQUE INDEX "products_tenant_id_legacy_breeder_id_key"
ON "products"("tenant_id", "legacy_breeder_id");

CREATE INDEX "product_events_tenant_id_idx"
ON "product_events"("tenant_id");

CREATE INDEX "product_events_tenant_id_product_id_idx"
ON "product_events"("tenant_id", "product_id");

CREATE INDEX "product_events_tenant_id_product_id_event_date_idx"
ON "product_events"("tenant_id", "product_id", "event_date");

ALTER TABLE "product_events"
ADD CONSTRAINT "product_events_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_events"
ADD CONSTRAINT "product_events_product_id_tenant_id_fkey"
FOREIGN KEY ("product_id", "tenant_id") REFERENCES "products"("id", "tenant_id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 7: drop legacy breeder tables after data is merged.
DROP TABLE "breeder_events";
DROP TABLE "breeders";
