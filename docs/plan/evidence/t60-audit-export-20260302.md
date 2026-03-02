# T60 Audit Logs Export (CSV) - API + UI

- API PR: (pending)
- UI PR: https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/47

## Scope

- API: `GET /admin/audit-logs/export` returns CSV for super-admin.
- UI: adds "Export CSV" entry on `/dashboard/audit-logs` using current filters.

## API Contract

Endpoint:
- `GET /admin/audit-logs/export`

Query (allowlist):
- `tenantId` (optional)
- `actorUserId` (optional)
- `action` (optional)
- `from` + `to` (required)
- `limit` (optional; default 2000)

Safety limits:
- Requires `from` and `to`
- Max time window: 31 days
- Max rows: `limit` (default 2000)

Response headers:
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="audit-logs-<iso>.csv"`
- `X-Export-Row-Count: <n>`
- `X-Export-Truncated: 0|1`

Audit:
- Records action: `admin.audit-logs.export`

## UI Contract

Frontend call path:
- `GET /api/proxy/admin/audit-logs/export?...`

Proxy passthrough:
- `Content-Disposition`, `X-Export-Row-Count`, `X-Export-Truncated`

## Verification

API build/lint (worktree `wt-t60-audit-export-api`):
- `pnpm --filter @eggturtle/shared build` PASS
- `pnpm --filter @eggturtle/api lint` PASS
- `pnpm --filter @eggturtle/api build` PASS

Logs:
- `out/t60-audit-export/20260302-211600/shared-build.log`
- `out/t60-audit-export/20260302-211600/api-lint.log`
- `out/t60-audit-export/20260302-211600/api-build.log`

UI build (PR #47):
- `pnpm --filter @eggturtle/admin build` (see PR evidence doc)

## Notes

- `out/` is gitignored; this evidence file is tracked so the workflow is reviewable.
