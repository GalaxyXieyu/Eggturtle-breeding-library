# Eggturtle SaaS Spec (Top-Level)

Status: active baseline for the Node.js monorepo
Updated: 2026-02-27

## 1. Scope and Positioning

This document is the canonical entry point for current business + technical specs in `docs/spec/`.
It captures decisions already reflected in code and points to deeper sub-specs.

## 2. Canonical Decisions (Aligned With Current Code)

1) API routes have **no `/api` prefix**.
- Example routes: `/auth/request-code`, `/products`, `/shares`, `/s/:shareToken`.
- See: `apps/api/src/main.ts`, `apps/api/src/products/products.controller.ts`, `apps/api/src/shares/shares.controller.ts`.

2) Tenant web app routes use **`/app/[tenantSlug]/...`**.
- See: `apps/web/app/app/[tenantSlug]/page.tsx`, `apps/web/app/app/[tenantSlug]/featured-products/page.tsx`.

3) RBAC has **4 roles** and is **deny-by-default** for tenant resources.
- Roles: `OWNER | ADMIN | EDITOR | VIEWER`.
- Guard behavior: membership required; insufficient role returns forbidden.
- See: `packages/shared/src/tenant.ts`, `apps/api/src/auth/rbac.guard.ts`, `apps/api/src/auth/rbac.policy.ts`.

4) Public share flow is **`shareToken -> 302 signed URL`**.
- Stable entry: `GET /s/:shareToken`.
- Server returns `302` to short-lived signed query URL on web public page.
- Public data endpoint verifies signature and expiry before returning data.
- See: `apps/api/src/shares/shares.controller.ts`, `apps/api/src/shares/shares.service.ts`, `docs/public-share.md`.

5) `Product.code` is **required** and **unique per tenant**.
- Request schema requires non-empty `code`.
- DB enforces `@@unique([tenantId, code])`.
- See: `packages/shared/src/product.ts`, `apps/api/prisma/schema.prisma`.

6) Super-admin backoffice is a **separate guarded surface**.
- **API**: cross-tenant operations live under `/admin/...` (NestJS, guarded).
- **Web UI**: hosted in a separate Next.js app `apps/admin` and uses `/dashboard/...` routes (kept separate from tenant `/app/...`).
- `apps/web/app/admin` is deprecated and now redirects to the standalone admin app origin.
- Disabled by default. It is only active when **both** conditions are met:
  - `SUPER_ADMIN_ENABLED=true`
  - requester email is in `SUPER_ADMIN_EMAILS` (comma-separated allowlist)
- Every `/admin` endpoint still requires regular auth (email-code login + bearer token).
- Tenant RBAC remains unchanged for `/tenants`, `/products`, `/featured-products`, `/shares`.
- Super-admin actions write dedicated audit records with `actorUserId` and `targetTenantId` when applicable.
- See: `apps/api/src/admin/*`, `apps/api/src/auth/super-admin.guard.ts`.

## 3. Route Conventions

- API (NestJS): direct resource paths (for example `/products`, `/featured-products`, `/tenants`, `/audit-logs`).
- Super-admin API: `/admin/...` (cross-tenant operations only, guarded by env + allowlist).
- Web app (authenticated): `/app/[tenantSlug]/...`.
- Super-admin web (separate app): `/dashboard/...` (served by `apps/admin`, local dev port `30020`).
- Public pages:
  - Share redirect entry: `/s/<shareToken>` (API)
  - Public render page: `/public/share?...` (Web)

## 4. Cross-Cutting Rules

- Multi-tenant isolation is mandatory for business tables and service queries.
- Role checks are required for authenticated tenant mutations.
- Audit logs are required for key operations (for example share create/access).
- Signed URL expiration is required for public share access.
- Authenticated product images are delivered through API endpoints (`/products/:pid/images/:iid/content`) instead of direct object URLs.

## 5. Spec Map

- Product and tenant baseline (this doc): `docs/spec/SAAS_SPEC.md`
- AI Phase A business spec: `docs/spec/AI_PHASE_A.md`
- AI architecture/system design: `docs/spec/AI_SYSTEM_DESIGN.md`
- AI quota and billing spec (Phase A): `docs/spec/AI_QUOTA_BILLING.md`

## 6. Legacy Docs Note

Some older docs outside `docs/spec/` still show `/api/...` examples from pre-rebuild discussions.
For implementation and new endpoints, this spec and current code take precedence.
