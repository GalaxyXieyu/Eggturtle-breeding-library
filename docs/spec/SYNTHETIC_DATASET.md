# SYNTHETIC_DATASET

## Purpose

This dataset seeds deterministic, UX-focused synthetic/abnormal records for local and CI validation.

Primary goals:
- Cover description edge cases (very long text and empty string)
- Cover image edge cases (no image and multiple images)
- Validate tenant-scoped uniqueness behavior
- Generate featured product and public share records
- Verify cross-tenant isolation with readback checks

## Seed Script

Path:
- `scripts/seed/synthetic_dataset.ts`

Safety defaults:
- Dry-run by default (no writes)
- Requires `--confirm` for writes
- Refuses to run when `DATABASE_URL` looks like production
- Production override requires explicit `--i-know-what-im-doing`

Determinism/idempotency:
- Stable tenant slugs and product codes
- Product upsert key: `(tenantId, code)`
- Featured upsert key: `(tenantId, productId)`
- Public share upsert key: `(tenantId, productId)`
- Share tokens are deterministic from `tenantSlug + code`
- Synthetic image keys are deterministic: `synthetic/<normalized-code>/<index>`

## Default Tenants

Primary synthetic tenant:
- slug: `ux-sandbox`
- name: `UX Sandbox`

Mirror tenant for isolation checks:
- slug: `ux-sandbox-shadow`
- name: `UX Sandbox Shadow`

Owner user (created/upserted for both tenants):
- `synthetic.owner@ux-sandbox.local`

## Dataset Contents

Primary tenant (`ux-sandbox`) products:
- `SYN-LONG-DESC-001`
  - long description payload
  - 1 image
  - featured
- `SYN-EMPTY-DESC-001`
  - empty description (`""`)
  - 1 image
  - public share
- `SYN-NO-IMAGE-001`
  - no image rows
- `SYN-MULTI-IMAGE-001`
  - multiple images (deterministic order, first image main)
  - featured
  - public share
- `SYN-COMMON-001`
  - same code also seeded in mirror tenant (allowed)
  - 1 image
  - public share
- `SYN-COLLIDE-001`
  - canonical near-collision code

Planned near-collision variants (expected skip):
- `syn collide 001`
- `SYN_COLLIDE_001`

Mirror tenant (`ux-sandbox-shadow`) products:
- `SYN-COMMON-001`
  - same code as primary tenant by design

## Near-Collision Policy

The script normalizes code with:
- lowercase
- non-alphanumeric characters removed

Example:
- `SYN-COLLIDE-001`
- `syn collide 001`
- `SYN_COLLIDE_001`

All normalize to the same key and are treated as near-collisions.

Behavior:
- Planned near-collision variants are skipped
- If existing tenant data already has conflicting normalized codes, candidate records are skipped and logged

## Cross-Tenant Isolation Readback Checks

After `--confirm`, the script verifies:
- `SYN-COMMON-001` exists once in primary tenant
- `SYN-COMMON-001` exists once in mirror tenant
- `featured_products.tenant_id` always matches related `products.tenant_id`
- `public_shares.tenant_id` always matches related `products.tenant_id`

If any isolation check fails, script exits with error.

## Commands

Dry-run (recommended first):

```bash
ts-node scripts/seed/synthetic_dataset.ts
```

Write synthetic dataset:

```bash
ts-node scripts/seed/synthetic_dataset.ts --confirm
```

Write + clean duplicate/stale synthetic image keys:

```bash
ts-node scripts/seed/synthetic_dataset.ts --confirm --dedupe
```

Override defaults:

```bash
ts-node scripts/seed/synthetic_dataset.ts \
  --confirm \
  --tenant-slug ux-sandbox \
  --tenant-name "UX Sandbox" \
  --mirror-tenant-slug ux-sandbox-shadow \
  --mirror-tenant-name "UX Sandbox Shadow" \
  --owner-email synthetic.owner@ux-sandbox.local
```

Production override (dangerous, explicit opt-in only):

```bash
ts-node scripts/seed/synthetic_dataset.ts --confirm --i-know-what-im-doing
```
