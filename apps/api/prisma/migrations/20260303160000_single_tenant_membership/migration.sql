-- Enforce single-tenant membership per user.
-- Keep the earliest membership for each user and remove the rest.
WITH ranked_memberships AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "user_id"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS rn
  FROM "tenant_members"
)
DELETE FROM "tenant_members" AS tm
USING ranked_memberships AS rm
WHERE tm."id" = rm."id"
  AND rm.rn > 1;

-- Replace non-unique user index with a unique constraint index.
DROP INDEX IF EXISTS "tenant_members_user_id_idx";
CREATE UNIQUE INDEX "tenant_members_user_id_key" ON "tenant_members"("user_id");
