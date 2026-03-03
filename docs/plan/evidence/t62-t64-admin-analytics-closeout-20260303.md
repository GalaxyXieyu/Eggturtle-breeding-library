# T62-T64 Admin Analytics Closeout (2026-03-03)

## Scope

- T62: Activity dashboard (`DAU/WAU/MAU/active tenants/retention`) API + UI.
- T63: Usage dashboard (cross-tenant TopN + tenant detail) API + UI.
- T64: Revenue dashboard (`MRR/ARR/upgrade/downgrade/churn`) API + UI.

## Delivered

- API:
  - `GET /admin/analytics/activity/overview` (wired to dashboard page).
  - `GET /admin/analytics/usage/overview` (new).
  - `GET /admin/tenants/:tenantId/usage` (new).
  - `GET /admin/analytics/revenue/overview` (new).
- Admin UI:
  - `/dashboard/analytics` + `/dashboard/analytics/activity` activity view.
  - `/dashboard/usage` usage TopN + tenant detail + alerts.
  - `/dashboard/billing` + `/dashboard/analytics/revenue` revenue view.
- Contracts:
  - Added shared schemas/types for usage and revenue analytics.
- Docs:
  - Added metric definitions in `docs/spec/ADMIN_ANALYTICS_METRICS.md`.
  - Updated API-view mapping in `docs/api-views.md`.

## Verification

Executed on local workspace:

```bash
pnpm --filter @eggturtle/shared build
pnpm --filter @eggturtle/api build
pnpm --filter @eggturtle/admin build
pnpm --filter @eggturtle/shared lint
pnpm --filter @eggturtle/api lint
pnpm --filter @eggturtle/admin lint
pnpm api-tests -- --only admin --clear-token-cache --confirm-writes
```

Observed result summary:

- `shared/api/admin` build all passed.
- `shared/api/admin` lint all passed.
- `api-tests admin` passed minimal checks in current env.
- Current env note: super-admin positive path was skipped because no super-admin email was provided in runtime flags/env.

## Known limitations (v0)

- Revenue uses plan-to-price mapping (not real order ledger).
- Upgrade/downgrade trend is inferred from consecutive plan update audit events.
- Usage limit interpretation follows current subscription fields and existing product-limit behavior.
