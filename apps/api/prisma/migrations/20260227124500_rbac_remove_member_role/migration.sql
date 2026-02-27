-- Remove legacy MEMBER role from TenantMemberRole and keep existing data.
UPDATE "tenant_members"
SET "role" = 'VIEWER'
WHERE "role" = 'MEMBER';

ALTER TABLE "tenant_members"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TYPE "TenantMemberRole" RENAME TO "TenantMemberRole_old";

CREATE TYPE "TenantMemberRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

ALTER TABLE "tenant_members"
ALTER COLUMN "role" TYPE "TenantMemberRole"
USING (
  CASE
    WHEN "role"::text = 'MEMBER' THEN 'VIEWER'
    ELSE "role"::text
  END
)::"TenantMemberRole";

ALTER TABLE "tenant_members"
ALTER COLUMN "role" SET DEFAULT 'VIEWER';

DROP TYPE "TenantMemberRole_old";
