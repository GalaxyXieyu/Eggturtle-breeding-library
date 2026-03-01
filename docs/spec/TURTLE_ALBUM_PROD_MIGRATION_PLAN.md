# Turtle Album Production API -> EggTurtle DB Migration Plan

## 1) Scope and Safety

Goal: migrate legacy `turtle_album` production data into EggTurtle in a repeatable and safe way.

Mandatory safety rules implemented in scripts:

1. Default mode is **dry-run**.
2. Any write requires `--confirm`.
3. Any production target requires **both** `--env=prod` and `--confirm-prod`.
4. No credentials are stored in repo files.

Primary scripts:

- Export from legacy API: `scripts/migrate/turtle_album_prod_api_export.ts`
- Import into EggTurtle DB: `scripts/migrate/turtle_album_prod_import.ts`

Output convention:

- Plan and audit docs: `out/migrate/turtle_album_prod/`
- Run artifacts: `out/migrate/turtle_album_prod/<run-id>/`

---

## 2) Data Sources

### Legacy source (`/Volumes/DATABASE/code/turtle_album`)

Read-only source through production API endpoints:

- `POST /api/auth/login`
- `GET /api/auth/verify`
- `GET /api/admin/series?include_inactive=true` (fallback: `/api/series`)
- `GET /api/products?page=...&limit=500`
- `GET /api/breeders?limit=1000`
- `GET /api/breeders/{id}/events?limit=100&cursor=...`
- `GET /api/featured-products`

### EggTurtle target (`/Volumes/DATABASE/code/Eggturtle-breeding-library/apps/api/prisma/schema.prisma`)

Write targets:

- `User`
- `Tenant`
- `TenantMember`
- `Series`
- `Product`
- `Breeder`
- `BreederEvent`
- `ProductImage`
- `FeaturedProduct`
- `PublicShare` (synthetic from share seeds)

---

## 3) Entity Mapping

| Legacy | EggTurtle | Mapping strategy |
|---|---|---|
| `users` (single admin login identity) | `User` + `TenantMember(OWNER)` | Upsert by email (`--admin-email`), then owner membership in target tenant |
| implicit single tenant | `Tenant` | One tenant upsert by `--tenant-slug`/`--tenant-name` (default `turtle-album`) |
| `series` | `Series` | Upsert by `(tenantId, code)`; fallback generated code if missing |
| `products` | `Product` | Upsert by `(tenantId, code)` |
| breeder-like products (`seriesId+sex`) | `Breeder` | Upsert by `(tenantId, code)`; link to mapped `Series` |
| `breeder_events` timeline | `BreederEvent` | Insert if not existing (same tenant+breeder+type+date+note) |
| `product_images` | `ProductImage` | Upsert by derived deterministic key: `sha1(legacyImageId|url)` |
| `featured_products` | `FeaturedProduct` | Upsert by `(tenantId, productId)` |
| (no direct share table) | `PublicShare` | Synthetic shares from `shareSeeds` (default from featured products) |

Notes:

- Legacy has no real tenant isolation; migration collapses all data into one tenant.
- Legacy breeder event extra fields (`maleCode`, `eggCount`, mate change fields) are preserved in `BreederEvent.note` as tagged metadata lines.

---

## 4) Execution Steps (Local -> Staging -> Prod)

## 4.1 Export from legacy production API

Dry-run (no files written):

```bash
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_api_export.ts \
  --api-base-url "$TURTLE_ALBUM_API_BASE_URL" \
  --username "$TURTLE_ALBUM_API_USERNAME" \
  --password "$TURTLE_ALBUM_API_PASSWORD"
```

Write export artifact:

```bash
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_api_export.ts \
  --api-base-url "$TURTLE_ALBUM_API_BASE_URL" \
  --username "$TURTLE_ALBUM_API_USERNAME" \
  --password "$TURTLE_ALBUM_API_PASSWORD" \
  --confirm
```

Expected artifact:

- `out/migrate/turtle_album_prod/<run-id>/export.json`
- `out/migrate/turtle_album_prod/<run-id>/summary.json`

## 4.2 Import into local dev DB (recommended first target)

Dry-run:

```bash
set -a; source apps/api/.env; set +a
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_import.ts \
  --input out/migrate/turtle_album_prod/<run-id>/export.json \
  --env dev \
  --tenant-slug turtle-album \
  --tenant-name "Turtle Album"
```

Write + readback report:

```bash
set -a; source apps/api/.env; set +a
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_import.ts \
  --input out/migrate/turtle_album_prod/<run-id>/export.json \
  --env dev \
  --tenant-slug turtle-album \
  --tenant-name "Turtle Album" \
  --confirm
```

Expected report files (same folder by default):

- `import-report-<run-id>.json`
- `import-report-<run-id>.md`

## 4.3 Staging rehearsal

1. Point `DATABASE_URL` to staging.
2. Run dry-run with `--env staging`.
3. Run write with `--confirm`.
4. Check readback report + UI spot checks.

## 4.4 Production cutover

1. Point `DATABASE_URL` to production.
2. Dry-run must include production guards:

```bash
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_import.ts \
  --input out/migrate/turtle_album_prod/<run-id>/export.json \
  --env prod \
  --confirm-prod
```

3. Actual write (two-step guard):

```bash
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_import.ts \
  --input out/migrate/turtle_album_prod/<run-id>/export.json \
  --env prod \
  --confirm \
  --confirm-prod
```

---

## 5) Verification Checklist

After each write run:

1. Open generated import report, verify all `imported*Present` checks are `PASS`.
2. SQL/API check tenant-scoped counts for series/breeders/products/images/events/featured/shares.
3. UI check in `apps/web` under `/app/<tenantSlug>`:
   - series list
   - breeders list + breeder detail timeline
   - products list/detail images
   - featured products page
   - public share page

---

## 6) Rollback and Idempotency

- Scripts are idempotent by business keys where possible:
  - series/product/breeder upsert by `(tenantId, code)`
  - featured/share upsert by `(tenantId, productId)`
  - image key deterministic hash
- In production, rollback recommendation:
  1. keep DB snapshot before migration
  2. if critical mismatch, restore snapshot instead of ad-hoc partial deletes

---

## 7) Required Environment Variable Names (sample only)

Do not commit real values.

```dotenv
# legacy source API
TURTLE_ALBUM_API_BASE_URL=
TURTLE_ALBUM_API_USERNAME=
TURTLE_ALBUM_API_PASSWORD=

# eggturtle target db
DATABASE_URL=

# imported owner user
EGGTURTLE_MIGRATION_ADMIN_EMAIL=
```

---

## 8) Known Gaps / Assumptions

1. Legacy system has no true tenant table; migration uses a single target tenant.
2. Legacy has no first-class share table; shares are synthesized from featured products.
3. If legacy series code is missing (public series fallback), importer generates stable codes.
4. `BreederEvent` structured fields beyond `eventType/eventDate/note` are folded into note text metadata.
