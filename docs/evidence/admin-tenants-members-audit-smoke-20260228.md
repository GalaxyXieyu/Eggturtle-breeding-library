# Admin Tenants/Memberships/Audit Smoke (2026-02-28)

## Scope

- PR branch: `feat/t30-32-admin-pages`
- Areas: admin login/session, tenants list/detail, memberships actions, audit-log filters
- Auth model: session cookie on server + admin API access through `/api/proxy/admin/*`

## Local Validation Commands

Run from repo root:

```bash
pnpm -r lint && pnpm -r build
```

Expected result:

- Command exits `0`
- `apps/admin` routes compile (including `/dashboard/*`, `/api/auth/*`, `/api/proxy/admin/*`)

## Local Run Commands (for manual smoke + screenshots)

Terminal A (API):

```bash
pnpm --filter @eggturtle/api dev
```

Terminal B (Admin):

```bash
ADMIN_API_BASE_URL=http://localhost:30011 \
NEXT_PUBLIC_API_BASE_URL=http://localhost:30011 \
ADMIN_SUPER_EMAIL_ALLOWLIST=synthetic.superadmin@local.test \
pnpm --filter @eggturtle/admin dev
```

## Screenshot URLs

1. Login page: `http://localhost:30020/login`
2. Dashboard overview: `http://localhost:30020/dashboard`
3. Tenants list: `http://localhost:30020/dashboard/tenants`
4. Tenant detail (open from list "View details"): `http://localhost:30020/dashboard/tenants/<tenantId>`
5. Memberships list/action page: `http://localhost:30020/dashboard/memberships`
6. Memberships preset filter from tenant detail: `http://localhost:30020/dashboard/memberships?tenantId=<tenantId>`
7. Audit logs with filters: `http://localhost:30020/dashboard/audit-logs`

## Smoke Checklist

- Login flow:
  - Request code works for allowlisted email
  - Verify code sets cookie and redirects to `/dashboard`
  - Sign-out clears session and returns to `/login`
- Tenants:
  - Loading / empty / error states render cleanly
  - Tenant detail opens and displays profile + members + recent logs
- Memberships:
  - Tenant selector loads
  - Add/update member role works and shows action message (with audit id)
- Audit logs:
  - Filters (tenant/user/action/time range) apply without runtime errors
  - Pagination previous/next works
- Security:
  - No access token persisted in client storage
  - Admin data requests are proxied via `/api/proxy/admin/*`
