WITH ranked_batches AS (
  SELECT
    id,
    tenant_id,
    female_product_id,
    egg_event_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY tenant_id, female_product_id, egg_event_id
      ORDER BY created_at ASC, id ASC
    ) AS keep_id
  FROM sale_batches
),
duplicate_batches AS (
  SELECT id, keep_id
  FROM ranked_batches
  WHERE id <> keep_id
)
UPDATE sale_allocations AS allocation
SET sale_batch_id = duplicate.keep_id
FROM duplicate_batches AS duplicate
WHERE allocation.sale_batch_id = duplicate.id;

WITH ranked_batches AS (
  SELECT
    id,
    tenant_id,
    female_product_id,
    egg_event_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY tenant_id, female_product_id, egg_event_id
      ORDER BY created_at ASC, id ASC
    ) AS keep_id
  FROM sale_batches
),
duplicate_batches AS (
  SELECT id, keep_id
  FROM ranked_batches
  WHERE id <> keep_id
)
UPDATE sale_subject_media AS media
SET sale_batch_id = duplicate.keep_id
FROM duplicate_batches AS duplicate
WHERE media.sale_batch_id = duplicate.id;

WITH ranked_batches AS (
  SELECT
    id,
    tenant_id,
    female_product_id,
    egg_event_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY tenant_id, female_product_id, egg_event_id
      ORDER BY created_at ASC, id ASC
    ) AS keep_id
  FROM sale_batches
),
duplicate_batches AS (
  SELECT id, keep_id
  FROM ranked_batches
  WHERE id <> keep_id
)
UPDATE product_certificates AS certificate
SET sale_batch_id = duplicate.keep_id
FROM duplicate_batches AS duplicate
WHERE certificate.sale_batch_id = duplicate.id;

WITH ranked_batches AS (
  SELECT
    id,
    tenant_id,
    female_product_id,
    egg_event_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY tenant_id, female_product_id, egg_event_id
      ORDER BY created_at ASC, id ASC
    ) AS keep_id
  FROM sale_batches
),
aggregated AS (
  SELECT
    keep_id,
    SUM(batch.sold_quantity)::INT AS sold_quantity_sum,
    GREATEST(MAX(batch.planned_quantity), SUM(batch.sold_quantity)::INT, 1) AS planned_quantity_next,
    MIN(batch.price_low) AS price_low_min,
    MAX(batch.price_high) AS price_high_max
  FROM sale_batches AS batch
  INNER JOIN ranked_batches AS ranked ON ranked.id = batch.id
  GROUP BY keep_id
)
UPDATE sale_batches AS target
SET
  sold_quantity = aggregated.sold_quantity_sum,
  planned_quantity = aggregated.planned_quantity_next,
  price_low = COALESCE(aggregated.price_low_min, target.price_low),
  price_high = COALESCE(aggregated.price_high_max, target.price_high),
  status = CASE
    WHEN aggregated.sold_quantity_sum >= aggregated.planned_quantity_next THEN 'SOLD'
    WHEN aggregated.sold_quantity_sum > 0 THEN 'PARTIAL'
    ELSE 'OPEN'
  END
FROM aggregated
WHERE target.id = aggregated.keep_id;

WITH ranked_media AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, sale_batch_id
      ORDER BY is_primary DESC, created_at DESC, id DESC
    ) AS row_no
  FROM sale_subject_media
  WHERE is_primary = TRUE
)
UPDATE sale_subject_media AS media
SET is_primary = FALSE
FROM ranked_media AS ranked
WHERE media.id = ranked.id
  AND ranked.row_no > 1;

WITH ranked_batches AS (
  SELECT
    id,
    tenant_id,
    female_product_id,
    egg_event_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY tenant_id, female_product_id, egg_event_id
      ORDER BY created_at ASC, id ASC
    ) AS keep_id
  FROM sale_batches
),
duplicate_batches AS (
  SELECT id, keep_id
  FROM ranked_batches
  WHERE id <> keep_id
)
DELETE FROM sale_batches AS batch
USING duplicate_batches AS duplicate
WHERE batch.id = duplicate.id;

CREATE UNIQUE INDEX "sale_batches_tenant_female_egg_event_key"
ON "sale_batches"("tenant_id", "female_product_id", "egg_event_id");
