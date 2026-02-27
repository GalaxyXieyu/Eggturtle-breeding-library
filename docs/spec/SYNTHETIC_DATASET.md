# SYNTHETIC_DATASET

## Purpose

Provide a deterministic synthetic + edge-case dataset for UX and regression validation without touching production data by default.

This seed covers:
- long, empty, and null product descriptions
- products with no image and multiple images
- near-collision product codes (still unique per tenant)
- featured product entries
- public share records
- cross-tenant isolation (same product code in two tenants)

## Script

- Path: `scripts/seed/synthetic_dataset.ts`
- Default mode: dry-run (no writes)
- Write mode: requires `--confirm`
- Production guard: refuses to run on risky/prod-like `DATABASE_URL` unless `--i-know-what-im-doing` is explicitly provided

## Default Seed Topology

- Primary tenant: `ux-sandbox`
- Peer tenant: `turtle-album`
- Shared cross-tenant code: `UX-CROSS-TENANT-0001`
- Owner account (for memberships/shares): `owner@uxsandbox.local`

Primary tenant receives multiple fixtures including:
- `UX-LONG-DESC-0001`
- `UX-EMPTY-DESC-0001`
- `UX-NULL-DESC-0001`
- `UX-NO-IMAGE-0001`
- `UX-MULTI-IMAGE-0001`
- `UX-CODE-NEAR-1000A`
- `UX-CODE-NEAR-1000a`
- `UX-CODE-NEAR-1000-A`
- `UX-CROSS-TENANT-0001`

Peer tenant receives:
- `UX-CROSS-TENANT-0001`

## Usage

```bash
# 1) Dry-run (safe default)
ts-node scripts/seed/synthetic_dataset.ts

# 2) Apply writes
DATABASE_URL=postgres://... ts-node scripts/seed/synthetic_dataset.ts --confirm

# 3) Custom tenant names/slugs
DATABASE_URL=postgres://... ts-node scripts/seed/synthetic_dataset.ts \
  --tenant-slug ux-sandbox \
  --tenant-name "UX Sandbox" \
  --peer-tenant-slug turtle-album \
  --peer-tenant-name "Turtle Album" \
  --owner-email owner@uxsandbox.local \
  --confirm
```

## Safety + Idempotency Notes

- Script is deterministic: product codes, image keys, and share token generation are stable.
- Script uses tenant-scoped upserts and synthetic image key prefixes (`external/synthetic/...`).
- Re-running updates in place instead of creating uncontrolled duplicates.
- No secrets are embedded in script or docs.
