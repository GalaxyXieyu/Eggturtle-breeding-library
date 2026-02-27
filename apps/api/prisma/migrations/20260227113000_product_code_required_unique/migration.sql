DO $$
DECLARE
    invalid_code_count INTEGER;
    duplicate_group_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO invalid_code_count
    FROM "products"
    WHERE "code" IS NULL OR btrim("code") = '';

    IF invalid_code_count > 0 THEN
        RAISE EXCEPTION USING
            MESSAGE = format(
                'Migration aborted: found %s product rows with NULL/blank code. Backfill codes before applying NOT NULL + unique constraint (tenant_id, code).',
                invalid_code_count
            );
    END IF;

    SELECT COUNT(*)
    INTO duplicate_group_count
    FROM (
        SELECT "tenant_id", btrim("code")
        FROM "products"
        GROUP BY "tenant_id", btrim("code")
        HAVING COUNT(*) > 1
    ) duplicate_groups;

    IF duplicate_group_count > 0 THEN
        RAISE EXCEPTION USING
            MESSAGE = format(
                'Migration aborted: found %s duplicate product code groups per tenant after trim. Deduplicate before applying unique constraint (tenant_id, code).',
                duplicate_group_count
            );
    END IF;
END $$;

UPDATE "products"
SET "code" = btrim("code")
WHERE "code" <> btrim("code");

ALTER TABLE "products"
ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "products_tenant_id_code_key" ON "products"("tenant_id", "code");
