# Business Operations Lane

## Use This Lane

Choose business operations when the request primarily concerns super-admin governance, tenant operations, audits, back-office checks, data movement, or operator-facing runbooks rather than product code changes.

Typical examples:

- bootstrap or grant super-admin access
- inspect tenant, revenue, usage, billing, or audit views in the back office
- run data import, export, migration, or backfill workflows
- execute a product upload or other operator-run procedure with explicit confirmation rules
- verify operator-facing business outcomes after a script or admin action

## Repo Surfaces Inspected

- `apps/admin/README.md`
- `apps/admin/components/dashboard/nav-config.ts`
- `apps/admin/app/dashboard/page.tsx`
- `apps/admin/app/dashboard/tenant-management/page.tsx`
- `apps/admin/app/dashboard/tenants/page.tsx`
- `apps/admin/app/dashboard/tenants/[tenantId]/page.tsx`
- `apps/admin/app/dashboard/analytics/page.tsx`
- `apps/admin/app/dashboard/billing/page.tsx`
- `apps/admin/app/dashboard/usage/page.tsx`
- `apps/admin/app/dashboard/settings/platform-branding/page.tsx`
- `apps/admin/app/dashboard/settings/tenant-branding/page.tsx`
- `apps/admin/app/dashboard/settings/audit-logs/page.tsx`
- `scripts/seed/bootstrap_super_admin.ts`
- `scripts/seed/set_super_admin.ts`
- `scripts/migrate/`
- `../eggturtle-data-ops/SKILL.md`
- `../openclaw-product-upload.skill.md`

## Current Limits Observed

- The inspected `apps/admin/app/dashboard/*` tree exposes data, tenant, billing, usage, analytics, and settings routes.
- I did not find a dedicated in-app dashboard route for bulk product import/upload or carousel management in the inspected tree.
- For bulk import/export, image migration, or other write-heavy flows, prefer the script path and the focused data-ops skill over ad-hoc UI assumptions.

## Typical Commands

- `pnpm --filter @eggturtle/api super-admin:set -- --login <account|phone|email> --confirm`
- `pnpm --filter @eggturtle/api super-admin:bootstrap -- --account <admin> --email <email> --password '<temporary-password>' --confirm`
- use the migration scripts under `scripts/migrate/` with the guardrails documented in `../eggturtle-data-ops/SKILL.md`

## Output Expectations

- State whether the task is read-only, dry-run, or write-intent.
- Name the exact admin screen, CLI command, or migration script being used.
- Confirm the business result with readback, audit evidence, or generated reports.
- Escalate missing UI/API capability as a development gap instead of inventing unsupported manual steps.

## Do Not Use This Lane For

- feature implementation, component refactors, or API/schema changes -> use development
- container/deploy/runtime recovery or CI/CD debugging -> use operations

## Handoff Rules

- If the desired operator flow does not exist in `apps/admin` or the API, hand off to development with the missing screen or endpoint.
- If the workflow also needs rollout, credentials, or environment fixes, bring in operations as a secondary lane.
