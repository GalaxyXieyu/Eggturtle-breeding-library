# API Acceptance Matrix

Status: active  
Updated: 2026-02-28

This matrix maps API module acceptance criteria to executable scenarios in `scripts/api-tests/`, using `docs/spec/API_TEST_SCENARIOS.md` as the source of truth.

## 1. Environment Prerequisites

- `NODE_ENV=development`
- `AUTH_DEV_CODE_ENABLED=true`
- API base URL reachable (default: `http://localhost:30011`)
- Run with write confirmation: `--confirm-writes`

## 2. Module Acceptance Matrix (T26.4)

| Module | Scenario | Endpoint / Action | Expected Status | Source |
| --- | --- | --- | --- | --- |
| auth | health check | `GET /health` | `200` | `API_TEST_SCENARIOS.md` §3.1(1) |
| auth | request login code | `POST /auth/request-code` | `201` | `API_TEST_SCENARIOS.md` §3.1(2) |
| auth | verify login code | `POST /auth/verify-code` | `201` | `API_TEST_SCENARIOS.md` §3.1(2) |
| auth | current user | `GET /me` | `200` | `API_TEST_SCENARIOS.md` §3.1(3) |
| auth | switch tenant (optional) | `POST /auth/switch-tenant` | `201` | `API_TEST_SCENARIOS.md` §3.1(4) |
| auth | current tenant (optional) | `GET /tenants/current` | `200` | `API_TEST_SCENARIOS.md` §3.1(4) |
| products | create product | `POST /products` | `201` | `API_TEST_SCENARIOS.md` §3.2(1) |
| products | list products | `GET /products?page=1&pageSize=20` | `200` | `API_TEST_SCENARIOS.md` §3.2(2) |
| series | list series | `GET /series?page=1&pageSize=10` | `200` | `API_TEST_SCENARIOS.md` §3.3(1) |
| series | invalid pagination guard | `GET /series?page=0&pageSize=10` | `400 INVALID_REQUEST_PAYLOAD` | `API_TEST_SCENARIOS.md` §3.3(2) |
| series | missing series guard | `GET /series/:id` (unknown id) | `404 SERIES_NOT_FOUND` | `API_TEST_SCENARIOS.md` §3.3(3) |
| breeders | list breeders | `GET /breeders?page=1&pageSize=10` | `200` | `API_TEST_SCENARIOS.md` §3.4(1) |
| breeders | invalid by-code guard | `GET /breeders/by-code/%20%20` | `400 INVALID_REQUEST_PAYLOAD` | `API_TEST_SCENARIOS.md` §3.4(2) |
| breeders | missing breeder detail guard | `GET /breeders/:id` (unknown id) | `404 BREEDER_NOT_FOUND` | `API_TEST_SCENARIOS.md` §3.4(3) |
| breeders | events timeline guard | `GET /breeders/:id/events` (unknown id) | `404 BREEDER_NOT_FOUND` | `API_TEST_SCENARIOS.md` §3.4(3) |
| breeders | family-tree guard | `GET /breeders/:id/family-tree` (unknown id) | `404 BREEDER_NOT_FOUND` | `API_TEST_SCENARIOS.md` §3.4(3) |
| breeders | optional positive timeline shape | `GET /breeders/:id/events` (existing id) | `200` | `API_TEST_SCENARIOS.md` §3.4(4) |
| breeders | optional positive family-tree shape | `GET /breeders/:id/family-tree` (existing id) | `200` | `API_TEST_SCENARIOS.md` §3.4(4) |
| images | upload image | `POST /products/:id/images` | `201` | `API_TEST_SCENARIOS.md` §3.5(1) |
| images | set main image | `PUT /products/:pid/images/:iid/main` | `200` | `API_TEST_SCENARIOS.md` §3.5(2) |
| images | reorder images | `PUT /products/:pid/images/reorder` | `200` | `API_TEST_SCENARIOS.md` §3.5(2) |
| images | read image content | `GET /products/:pid/images/:iid/content` | `200` or `302` | `API_TEST_SCENARIOS.md` §3.5(3) |
| images | delete image | `DELETE /products/:pid/images/:iid` | `200` | `API_TEST_SCENARIOS.md` §3.5(4) |
| featured | add featured product | `POST /featured-products` | `201` | `API_TEST_SCENARIOS.md` §3.6(2) |
| featured | list featured products | `GET /featured-products` | `200` | `API_TEST_SCENARIOS.md` §3.6(3) |
| featured | reorder featured products | `PUT /featured-products/reorder` | `200` | `API_TEST_SCENARIOS.md` §3.6(4) |
| featured | delete featured product | `DELETE /featured-products/:id` | `200` | `API_TEST_SCENARIOS.md` §3.6(4) |
| shares | create share | `POST /shares` | `201` | `API_TEST_SCENARIOS.md` §3.7(1) |
| shares | open share entry | `GET /s/:shareToken` | `302` | `API_TEST_SCENARIOS.md` §3.7(2) |
| shares | read public share payload | `GET /shares/:sid/public?...` | `200` | `API_TEST_SCENARIOS.md` §3.7(3) |
| admin | tenant role denied | `GET /admin/tenants` (tenant token) | `403` | `API_TEST_SCENARIOS.md` §3.8(1) |
| admin | super-admin positive (optional) | `GET /admin/tenants` (super-admin token) | `200` (required only with `--require-super-admin-pass`) | `API_TEST_SCENARIOS.md` §3.8(2) |

## 3. Core Negative Assertions

| Actor | Endpoint | Expected Status | Source |
| --- | --- | --- | --- |
| VIEWER | `POST /products` | `403 FORBIDDEN` | `API_TEST_SCENARIOS.md` §4 |
| VIEWER | `POST /featured-products` | `403 FORBIDDEN` | `API_TEST_SCENARIOS.md` §4 |
| VIEWER | `POST /shares` | `403 FORBIDDEN` | `API_TEST_SCENARIOS.md` §4 |
| Tenant role | `GET /admin/tenants` | `403 FORBIDDEN` | `API_TEST_SCENARIOS.md` §4 |
| Tenant-scoped read | `GET /series?page=0&pageSize=10` | `400 INVALID_REQUEST_PAYLOAD` | `API_TEST_SCENARIOS.md` §4 |
| Tenant-scoped read | `GET /breeders/by-code/%20%20` | `400 INVALID_REQUEST_PAYLOAD` | `API_TEST_SCENARIOS.md` §4 |
| Tenant-scoped read | `GET /breeders/:id` (unknown id) | `404 BREEDER_NOT_FOUND` | `API_TEST_SCENARIOS.md` §4 |

## 4. Full Run Command (T26.5)

```bash
NODE_ENV=development \
AUTH_DEV_CODE_ENABLED=true \
pnpm api-tests -- \
  --confirm-writes \
  --clear-token-cache \
  --json \
  --only auth,products,series,breeders,images,featured,shares,admin
```

This command executes real requests for the full module set and emits JSONL logs suitable for evidence collection.
