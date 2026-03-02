# RELEASE_CHECKLIST_ADMIN

## 1) Preflight (must pass)
- Repo on latest main:
  - `git fetch origin main --quiet`
  - `git rev-list --left-right --count origin/main...main` (expect `0 0`)
- DB migration is up-to-date:
  - `DATABASE_URL=postgres://eggturtle:eggturtle@localhost:30001/eggturtle pnpm --filter @eggturtle/api exec prisma migrate status`
- Security toggles:
  - `NEXT_PUBLIC_SUPER_ADMIN_ENABLED=false` (default)
  - `ADMIN_SUPER_EMAIL_ALLOWLIST` set explicitly for ops accounts

## 2) API acceptance
- Lint/build:
  - `pnpm -r lint`
  - `pnpm -r build`
- Start API for acceptance:
  - `NODE_ENV=development AUTH_DEV_CODE_ENABLED=true PORT=30011 DATABASE_URL=postgres://eggturtle:eggturtle@localhost:30001/eggturtle node apps/api/dist/main.js`
- Full API tests (write-confirmed):
  - `pnpm api-tests -- --api-base http://localhost:30011 --confirm-writes --clear-token-cache --super-admin-email synthetic.superadmin@local.test`
- Pass criteria:
  - runner summary `runner.done` and no failed assertions

## 3) Admin UI checklist
- Start admin:
  - `NODE_ENV=development ADMIN_API_BASE_URL=http://localhost:30011 NEXT_PUBLIC_API_BASE_URL=http://localhost:30011 ADMIN_SUPER_EMAIL_ALLOWLIST=<allowlisted-email> NEXT_PUBLIC_SUPER_ADMIN_ENABLED=false pnpm --filter @eggturtle/admin dev`
- Checklist (manual):
  1. Allowlisted login -> `/dashboard` (总览)
  2. `/dashboard/tenants` list visible
  3. `/dashboard/memberships` upsert role success
  4. `/dashboard/audit-logs` can see `admin.tenants.members.upsert`
  5. Non-allowlisted email login gets denied (403 message)

## 4) Rollback runbook
- Fast rollback (no code deploy):
  1. Set `ADMIN_SUPER_EMAIL_ALLOWLIST` to empty or strict minimal list
  2. Keep `NEXT_PUBLIC_SUPER_ADMIN_ENABLED=false`
  3. Restart admin service
- Code rollback (if regression after deploy):
  1. Identify culprit commit from release window
  2. `git revert <commit>` (or rollback deployment artifact)
  3. Redeploy API/admin
  4. Re-run section 2 + section 3 acceptance commands
- DB rollback policy:
  - Prefer forward-fix for applied migrations; do not hot-delete migration records in prod.

## 5) Post-rollback validation
- Health checks:
  - `curl -sS http://localhost:30011/health`
  - `curl -sS -I http://localhost:30020/login`
- Re-run API tests and spot-check admin UI checklist items 1/4/5.
