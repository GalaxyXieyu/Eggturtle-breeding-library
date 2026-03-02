# T59 Admin /dashboard IA (Navigation Grouping + Placeholder Routes)

- PR: https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/46
- Branch: `feat/admin-dashboard-ia-20260302`

## What Changed

- Sidebar navigation switched from a flat list to governance-domain groups:
  - Overview / Tenants / Memberships / Audit / Analytics / Usage / Billing
  - Adds `matchStrategy: 'exact' | 'prefix'` to avoid parent+child routes highlighting together.
- Added placeholder routes (consistent header/panel/empty state; bilingual copy):
  - `/dashboard/analytics`
  - `/dashboard/analytics/activity`
  - `/dashboard/analytics/revenue`
  - `/dashboard/usage`
  - `/dashboard/billing`
- Breadcrumb readability improved for Chinese (no spaces between mapped segments).
- Naming aligned: `/dashboard/audit-logs` uses "审计日志" consistently.

## Key Files

- Navigation config: `apps/admin/components/dashboard/nav-config.ts`
- Sidebar render: `apps/admin/components/dashboard/dashboard-sidebar.tsx`
- Breadcrumbs: `apps/admin/components/dashboard/dashboard-topbar.tsx`
- Placeholder primitive: `apps/admin/components/dashboard/polish-primitives.tsx`
- Placeholder pages: `apps/admin/app/dashboard/**/page.tsx`

## Verification

Commands:

```bash
pnpm --filter @eggturtle/admin lint
pnpm --filter @eggturtle/admin build
```

Expected result:
- lint: PASS (no ESLint warnings/errors)
- build: PASS (compiled successfully)

Note:
- Full raw logs were generated during the initial PR run under `out/admin-dashboard-ia/20260302/` in the local worktree, but `out/` is intentionally gitignored.

## Manual Check Steps

1) Open `/dashboard` (overview page works as before)
2) Confirm sidebar shows grouped sections and group titles
3) Visit new placeholder pages listed above; confirm consistent empty state + bilingual copy
4) Regression: `/dashboard/tenants`, `/dashboard/tenants/[tenantId]`, `/dashboard/memberships`, `/dashboard/audit-logs` still work
