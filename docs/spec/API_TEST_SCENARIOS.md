# API Interface Test Scenarios

Status: active  
Updated: 2026-02-27

This document defines categorized API interface scenarios for `scripts/api-tests/` TypeScript scripts.

## 1. Scope and Alignment

These scenarios align with:

- `docs/spec/ACCOUNT_MATRIX_PERMISSIONS.md`
- role-based acceptance baseline (`OWNER / ADMIN / EDITOR / VIEWER` + `super-admin`)
- acceptance matrix (`docs/spec/API_ACCEPTANCE_MATRIX.md`) used for module-level status/code coverage reviews

The scripts are organized by module, not by one monolithic smoke script:

- `auth.ts`
- `products.ts`
- `images.ts`
- `featured.ts`
- `shares.ts`
- `admin.ts`
- `account-matrix.ts`

Runner entry: `scripts/api-tests/run.ts`

## 2. Safety and Execution Policy

- Default mode is dry-run (prints plan only, sends no requests)
- Write scenarios require explicit `--confirm-writes`
- Non-local API is blocked unless `--allow-remote` is passed
- Output is concise by default; `--json` emits JSONL events for troubleshooting
- Auth base token cache is stored at `.data/api-tests/token-cache.json` (1h TTL)
- `--clear-token-cache` clears local cache before execution

## 3. Scenario Catalog

### 3.1 Auth and Identity (`auth`)

1. Health check

- `GET /health` -> `200`
- `status` field should be `ok`

2. Login via dev code flow

- `POST /auth/request-code` -> `201`
- response includes `ok`, `expiresAt`, and `devCode` (dev mode)
- `POST /auth/verify-code` -> `201`
- response includes `accessToken`, `user.id`, `user.email`

3. Current user check

- `GET /me` with token -> `200`

4. Optional tenant switch

- if `--tenant-id` present: `POST /auth/switch-tenant` -> `201`
- `GET /tenants/current` -> `200`

### 3.2 Products (`products`)

1. Create product

- `POST /products` -> `201`
- response includes `product.id`, `product.code`

2. List products

- `GET /products?page=1&pageSize=20` -> `200`
- created product should appear in list payload

### 3.3 Product Images (`images`)

1. Upload image

- fixture product is created first
- `POST /products/:id/images` (multipart `file`) -> `201`

2. Manage image metadata

- `PUT /products/:pid/images/:iid/main` -> `200`
- `PUT /products/:pid/images/reorder` -> `200`

3. Content access

- `GET /products/:pid/images/:iid/content` -> `200` (local storage) or `302` (redirect storage)

4. Delete image

- `DELETE /products/:pid/images/:iid` -> `200`

### 3.4 Featured Products (`featured`)

1. Create fixture products (2)

2. Add featured records

- `POST /featured-products` -> `201`

3. List featured records

- `GET /featured-products` -> `200`
- should contain created featured item ids

4. Reorder and delete

- `PUT /featured-products/reorder` -> `200`
- `DELETE /featured-products/:id` -> `200`

### 3.5 Shares (`shares`)

1. Create share

- fixture product is created first
- `POST /shares` -> `201`
- response includes `share.id`, `share.shareToken`

2. Open share entry

- `GET /s/:shareToken` -> `302`
- `Location` should include signed params: `sid`, `tenantId`, `resourceType`, `resourceId`, `exp`, `sig`

3. Read public payload

- `GET /shares/:sid/public?...` -> `200`
- `shareId` and `product.id` should match created fixture

### 3.6 Admin Access (`admin`)

1. Tenant role denial

- non-super-admin token: `GET /admin/tenants` -> `403 FORBIDDEN`

2. Optional super-admin positive check

- with `--super-admin-email`: `GET /admin/tenants`
- when `--require-super-admin-pass` is set: must be `200`
- otherwise non-200 is warning (environment-dependent)

### 3.7 Account Matrix (`account-matrix`)

This module is the authoritative automated check for role matrix acceptance.

Preconditions:

- `--owner-email --admin-email --editor-email --viewer-email` required
- provide `--tenant-id` OR use `--provision --super-admin-email`

Coverage:

- products write/read matrix
- featured write/read matrix
- shares create + public read matrix
- images content access matrix
- `/admin/*` deny for tenant roles
- optional `/admin/*` positive for super-admin

## 4. Negative Assertions (Core)

Expected denial/error-code checks:

- `VIEWER -> POST /products` -> `403 FORBIDDEN`
- `VIEWER -> POST /featured-products` -> `403 FORBIDDEN`
- `VIEWER -> POST /shares` -> `403 FORBIDDEN`
- `tenant role -> GET /admin/tenants` -> `403 FORBIDDEN`

## 5. Suggested Execution Sets

1. Fast tenant module sweep

```bash
pnpm api-tests -- --confirm-writes --only auth,products,images,featured,shares
```

2. Admin access checks

```bash
pnpm api-tests -- --confirm-writes --only admin --super-admin-email super@example.com
```

3. Full account matrix acceptance

```bash
pnpm api-tests -- \
  --confirm-writes \
  --only account-matrix \
  --owner-email owner@example.com \
  --admin-email admin@example.com \
  --editor-email editor@example.com \
  --viewer-email viewer@example.com \
  --tenant-id <tenant-id>
```

## 6. Logging and Debugging

- Default output: concise event lines suitable for local runs
- `--json`: structured JSONL events (`ts`, `level`, `event`, metadata)
- Runner continues module execution after single-module failure and emits `runner.failed` summary
- Error payload rendering redacts token-like fields to avoid credential leakage in logs
- Recommended for CI artifact collection and flaky-case replay
