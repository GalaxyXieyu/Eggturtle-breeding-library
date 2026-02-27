# SCENARIOS_UX_TEST_DATA

## Purpose

Define stable UX test scenarios and exact dataset requirements for:
- Auth and tenant switching flows
- Product list and detail behavior
- Featured products behavior
- Share link behavior
- Role/permission behavior (owner/editor/viewer)

This dataset spec is designed for local and CI smoke validation and for manual UX acceptance.

## Dataset Scope

### Source and target

- Source: TurtleAlbum sqlite (`products`, `product_images`, `users`)
- Target: Eggturtle Postgres via Prisma (`users`, `tenants`, `tenant_members`, `products`, `product_images`)
- Tenant slug for migrated data: `turtle-album`
- Default owner account for migrated tenant: `admin@turtlealbum.local` (OWNER role)

### Required baseline quantities

These counts are minimums for UX coverage:

- `users`: 3 in target tenant context
  - owner: `admin@turtlealbum.local` (OWNER)
  - editor: `editor@turtlealbum.local` (EDITOR)
  - viewer: `viewer@turtlealbum.local` (VIEWER)
- `products`: at least 12 migrated products (real-world style codes)
- `product_images`: at least 12 images (at least 1 image for each sampled product)
- `featured_products`: at least 2 entries (can be created during smoke)
- `public_shares`: at least 1 entry (can be created during smoke)

## Canonical Scenario Set

## S1 - Login and initial tenant state

Goal:
- User can request and verify auth code
- New user starts without selected tenant

Data requirements:
- Auth code flow enabled in local dev (`AUTH_DEV_CODE_ENABLED=true`)
- At least one existing tenant (`turtle-album`) and one owner member

Assertions:
- `POST /auth/request-code` returns `devCode` in local dev
- `POST /auth/verify-code` returns `accessToken`
- API routes requiring tenant should fail before switch (`TENANT_NOT_SELECTED` path)

Edge cases:
- invalid code format (`code` not 6 digits)
- expired or consumed code

## S2 - Tenant switch and tenant-scoped token

Goal:
- User selects `turtle-album` and receives tenant-scoped token

Data requirements:
- User is member of target tenant
- tenant slug is unique and stable: `turtle-album`

Assertions:
- `POST /auth/switch-tenant` succeeds with tenant id or slug
- subsequent calls to `/products`, `/featured-products`, `/shares` are tenant-scoped

Edge cases:
- switch to nonexistent tenant -> not found
- switch to tenant without membership -> forbidden

## S3 - Product list UX (default state)

Goal:
- Product list renders realistic migrated dataset

Data requirements:
- products with mixed description completeness:
  - some `description` non-empty
  - some `description` empty/null
- codes are unique within tenant
- list includes at least one product whose code has hyphen + numeric suffix (for sort and readability checks)

Assertions:
- `/products` returns non-empty list
- pagination metadata is valid (`page`, `pageSize`, `total`, `totalPages`)
- each product has stable `id`, `tenantId`, `code`

Edge cases:
- duplicate code import attempts must upsert, not create duplicates
- blank code rows from source should be skipped during import

## S4 - Product image ordering and main image

Goal:
- UI shows correct main image and image order

Data requirements:
- each tested product has 1+ images
- `sort_order` preserved from source where possible
- one image marked main (`type == main` in source) when available
- after mirror migration, `ProductImage.key` should be managed key `${tenantId}/products/${productId}/...`

Assertions:
- first displayed image matches `isMain=true`
- image order follows `sortOrder` ascending
- `GET /products/:pid/images/:iid/content` streams bytes for managed keys (no redirect to MinIO)
- legacy unmanaged keys still fall back to `url` redirect

Edge cases:
- source image with empty URL -> skipped and logged
- multiple source images marked `main` -> importer resolves to one deterministic main image
- unknown image type -> still imported, main fallback uses first image

## S5 - Featured products UX

Goal:
- Featured list can be created, listed, and reordered

Data requirements:
- at least 2 existing products in same tenant

Assertions:
- `POST /featured-products` adds item
- `GET /featured-products` returns tenant-scoped list
- `PUT /featured-products/reorder` updates sort order
- `GET /products/featured?tenantSlug=turtle-album` returns public featured list

Edge cases:
- duplicate feature add for same product should not create duplicates
- cross-tenant product id must be rejected

## S6 - Public share UX

Goal:
- Share creation and public read path work end-to-end

Data requirements:
- at least 1 product with image in tenant
- `PUBLIC_SHARE_SIGNING_SECRET` configured

Assertions:
- `POST /shares` returns share id + share token + entry url
- `GET /s/:shareToken` returns 302 redirect with signed params
- `GET /shares/:shareId/public?...` returns product payload

Edge cases:
- invalid signature -> unauthorized
- expired signature -> unauthorized
- unknown share token -> not found

## S7 - Role and permission UX

Goal:
- owner/editor/viewer roles produce expected access behavior

Data requirements:
- tenant members:
  - OWNER: can manage tenant + data
  - EDITOR: can create/edit products and featured entries
  - VIEWER: read-only for protected resources

Assertions:
- viewer cannot create product/featured/share write actions that require editor+
- editor can create product and featured entries
- owner has full tenant management behavior

Edge cases:
- user with valid token but no tenant membership should get forbidden on switch or scoped operations

## Migration and Seed Rules

## Import idempotency

Importer must be re-runnable:
- product upsert key: `(tenantId, code)`
- image upsert lookup: `(tenantId, productId, key)` behavior by key
- repeated runs should update existing rows, not create uncontrolled duplicates

## Safety defaults

All write scripts must default to dry-run and require explicit confirm flag:
- default mode: dry-run
- write mode: `--confirm`

Production safety guard:
- scripts refuse when `DATABASE_URL` looks like production
- override only with `--i-know-what-im-doing`

## Non-goals for this phase

- no password migration from legacy users
- no direct migration of legacy auth credentials

## Verification Checklist

After migration and seed:

1. `scripts/migrate/turtle_album_export.py` dry-run works by default
2. `scripts/migrate/turtle_album_export.py --confirm` outputs JSON without secrets
3. `scripts/seed/import_turtle_album.ts` dry-run works by default
4. `scripts/seed/import_turtle_album.ts --confirm` creates/updates tenant data
5. `scripts/migrate/mirror_external_images_to_storage.ts` dry-run works by default
6. `scripts/migrate/mirror_external_images_to_storage.ts --confirm` mirrors eligible images, rewrites `product_images.key/contentType/url`, and writes a report JSON under `out/`
7. `scripts/seed/bootstrap_admin.ts --confirm` creates editor/viewer memberships
8. `pnpm api-tests -- --confirm-writes --only auth,products,featured,shares` passes auth, tenant switch, products, featured, and share checks
9. `pnpm -r lint && pnpm -r build` passes
