UPDATE "products"
SET "type" = 'breeder'
WHERE "type" IS NULL
   OR BTRIM("type") = '';

ALTER TABLE "products"
ALTER COLUMN "type" SET DEFAULT 'breeder';

ALTER TABLE "products"
ALTER COLUMN "type" SET NOT NULL;
