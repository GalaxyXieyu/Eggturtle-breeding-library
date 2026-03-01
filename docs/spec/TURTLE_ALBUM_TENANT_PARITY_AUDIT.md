# Tenant Management Parity Audit

## Scope

Compare legacy `turtle_album` tenant/account behavior with EggTurtle multi-tenant UI and backend.

Codebases reviewed:

- Legacy: `/Volumes/DATABASE/code/turtle_album`
- EggTurtle: `/Volumes/DATABASE/code/Eggturtle-breeding-library`

---

## A) Legacy behavior (`turtle_album`)

### What exists

1. **Single global admin login**
   - Username/password login via `POST /api/auth/login`.
   - Token verify via `GET /api/auth/verify`.
   - Frontend route `/admin` -> login page.
2. **No tenant selection, no tenant context switching**
   - After login, user goes directly to global admin pages (`/admin/products`, `/admin/series`, etc.).
3. **Single namespace data model**
   - Products, breeders, series, featured all global to one account space.

### What does not exist

- Tenant table / membership table
- Per-tenant RBAC
- Tenant switch endpoint
- Tenant management page

---

## B) EggTurtle behavior (multi-tenant)

### What exists

1. **User identity + tenant context are separated**
   - Login gives token for user identity.
   - Tenant context selected/switched through `POST /auth/switch-tenant`.
2. **Tenant list + create tenant UX**
   - `/tenant-select` and `/app/[tenantSlug]/tenants` use:
     - `GET /tenants/me`
     - `POST /tenants`
3. **Current tenant resolution flow**
   - `/app` resolves active tenant via `/tenants/current`.
   - If no active tenant in token, it falls back to first membership then switches.
4. **Membership model**
   - `TenantMember` role-based access (`OWNER/EDITOR/VIEWER`).

---

## C) Parity Matrix

| Legacy expectation | Legacy implementation | EggTurtle equivalent | Parity result |
|---|---|---|---|
| Admin can log in and manage all data | Single admin token | User login + tenant switch token | **Partial** (extra tenant step required) |
| One account sees one global dataset | Global namespace | One user can belong to multiple tenants | **Different by design** |
| No tenant setup step | None | Tenant must exist + membership required | **Gap (migration onboarding needed)** |
| No collaborator management | None | Tenant member role model | **Superset in EggTurtle** |

---

## D) Migration Mapping Decision

To preserve operator behavior for migrated legacy users:

1. Create one default tenant (recommended: `turtle-album`).
2. Add imported owner user as `OWNER` of that tenant.
3. Import all legacy data into that single tenant.
4. On first web entry, route user to tenant-selected workspace (`/app/turtle-album`).

Result: user still works in one logical space, while platform remains multi-tenant ready.

---

## E) Practical UX Implications

1. Legacy users will now see tenant concepts in UI (`tenant-select`, `tenant management` page).
2. To minimize confusion, pre-create the tenant and avoid empty-state tenant list.
3. Optional product decision: hide tenant creation button for migrated owner accounts if strict single-tenant behavior is preferred initially.

---

## F) Recommended follow-up

1. Add migration-first onboarding copy in web app: explain why tenant selection appears.
2. Add smoke test case: imported owner login -> `/app` -> auto-enter migrated tenant.
3. Add docs section linking this audit to migration runbook.
