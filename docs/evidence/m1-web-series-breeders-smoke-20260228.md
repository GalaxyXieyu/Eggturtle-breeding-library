# Milestone1 Web Series + Breeders Smoke (2026-02-28)

## Goal

Verify Milestone1 web entry pages for series/breeders and confirm synthetic seed data is visible.

## 1) Run migration

```bash
pnpm --filter @eggturtle/api prisma:migrate
```

## 2) Seed synthetic data (write mode)

```bash
pnpm --filter @eggturtle/api exec ts-node ../../scripts/seed/synthetic_dataset.ts --confirm
```

Notes:
- Default behavior is dry-run.
- `--confirm` is required for writes.
- Script refuses production-like `DATABASE_URL` unless explicitly overridden.

## 3) Start API + Web

Terminal A:

```bash
pnpm --filter @eggturtle/api dev
```

Terminal B:

```bash
pnpm --filter @eggturtle/web dev
```

## 4) Manual URLs for screenshots

Assume tenant slug: `ux-sandbox` (default synthetic tenant).

- Series list + search
  - `http://localhost:30010/app/ux-sandbox/series`
- Breeders list + filters (`seriesId` / `search` / `code`)
  - `http://localhost:30010/app/ux-sandbox/breeders`
- Breeder detail + events + family-tree + limitations
  - `http://localhost:30010/app/ux-sandbox/breeders/<BREEDER_ID>`

Tip: open breeders list first, click **Open detail** to get a valid `<BREEDER_ID>` URL for screenshots.

## Expected checks

- Series page shows loading, empty, and populated state behavior.
- Breeders page supports all requested filters and links to detail page.
- Detail page shows breeder profile, events, family-tree nodes, and the limitation text.
- Navigation links work between dashboard, series list, breeders list, and breeder detail.
