# Super-Admin Backoffice Integration Plan

Status: planning (implementation in progress)
Updated: 2026-02-27

## Goal

Build a global super-admin backoffice that can manage all tenants, without introducing Clerk.
Keep a hard separation between:
- Tenant app: `apps/web` routes under `/app/[tenantSlug]/...`
- Public pages: `apps/web` routes under `/public/...`
- Super-admin UI: `apps/admin` routes under `/dashboard/...`
- Legacy `apps/web/app/admin` is deprecated and should only redirect to admin app.

## Guardrails (Non-Negotiable)

- Super-admin is disabled by default.
- Access requires BOTH:
  - `SUPER_ADMIN_ENABLED=true`
  - requester email is in `SUPER_ADMIN_EMAILS` allowlist (comma-separated)
- All super-admin API routes are under `/admin/...`.
- All super-admin actions are audit-logged with `actorUserId` and `targetTenantId` where applicable.
- No secrets (MinIO keys, tokens) are stored in repo or docs.

## Admin UI Strategy (Template Reuse)

We reuse the UI/layout patterns from:
- `Kiranism/next-shadcn-dashboard-starter` (MIT)

We DO NOT adopt:
- Clerk auth / organizations / billing

We aim for a 1:1 visual structure (sidebar/table/form) but connect data via our own API.

## Route Plan

- Admin UI (Next.js app):
  - `apps/admin`
  - base path: `/dashboard/*`
  - local dev port: `30020`

- Admin API (NestJS app):
  - `apps/api`
  - base path: `/admin/*`

## Minimal Feature Set (MVP)

1) Tenants
- list tenants
- create tenant (slug, name)

2) Users
- list users

3) Membership
- grant or update membership by (tenantId, userEmail, role)

4) Audit
- view audit logs, filter by tenantId

## Directory Hygiene

- Keep all admin UI components under `apps/admin/app/...` and `apps/admin/lib/...`.
- Shared primitives (if needed) stay in `packages/shared` or `apps/admin` only.
- Do not import admin components into `apps/web`.

## Storage Note (Images / MinIO)

- MinIO is local docker and must bind to localhost only (no external interface exposure).
- Buckets/objects must remain private.
- Images are served through API (proxy or signed URL) to enforce auth (for example `/products/:pid/images/:iid/content`).
- During migration, skip invalid images (404 / non-image / per-image > 10MB) and use a single placeholder image if needed.
