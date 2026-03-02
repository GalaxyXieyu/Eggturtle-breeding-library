# T75 Build Closeout (2026-03-02)

## Scope
- Task: `T75` P0 后台构建收口（API/Admin/Web）
- Goal: build chain can be rerun stably, warnings/failures closed for current build baseline, CI green before release.

## Code changes
1. **Prisma build warning removed (API)**
   - Added `apps/api/prisma.config.ts` to migrate from deprecated `package.json#prisma` config.
   - Removed `"prisma"` field from `apps/api/package.json`.
2. **Web build lint warning cleanup**
   - Added per-file eslint disable header for `@next/next/no-img-element` on 12 pages that intentionally use raw `<img>` for current rendering path:
     - `apps/web/app/app/[tenantSlug]/breeders/[id]/page.tsx`
     - `apps/web/app/app/[tenantSlug]/breeders/page.tsx`
     - `apps/web/app/app/[tenantSlug]/products/[productId]/page.tsx`
     - `apps/web/app/app/[tenantSlug]/products/page.tsx`
     - `apps/web/app/app/[tenantSlug]/series/page.tsx`
     - `apps/web/app/app/[tenantSlug]/share-presentation/page.tsx`
     - `apps/web/app/public/[tenantSlug]/page.tsx`
     - `apps/web/app/public/[tenantSlug]/products/[productId]/page.tsx`
     - `apps/web/app/public/_legacy/components.tsx`
     - `apps/web/app/public/_legacy/public-product-detail-page.tsx`
     - `apps/web/app/public/_public-product/components.tsx`
     - `apps/web/app/public/_public-product/public-product-detail-page.tsx`

## Verification
### Local build
- Command: `pnpm -r build`
- Log: `out/t75-build-closeout/20260302-113516/pnpm-build.log`
- Warning scan: `out/t75-build-closeout/20260302-113516/warning-scan.txt` (`warning_matches=0`)

### CI / Deploy
- CI run (success): https://github.com/GalaxyXieyu/Eggturtle-breeding-library/actions/runs/22560241523
  - JSON snapshot: `out/t75-build-closeout/20260302-113516/ci-run-22560241523.json`
- Build and Deploy run (success): https://github.com/GalaxyXieyu/Eggturtle-breeding-library/actions/runs/22560241531
  - JSON snapshot: `out/t75-build-closeout/20260302-113516/deploy-run-22560241531.json`

## Result
- Local `pnpm -r build` passes across `@eggturtle/shared`, `@eggturtle/api`, `@eggturtle/admin`, `@eggturtle/web`.
- Local baseline build log contains no warning/error keyword matches under configured scan.
- Upstream CI + Deploy are both green on main head SHA `ade91ed923a2b3c6019368b617d9fc7efd88af3b` (run links above).
- Note: warning-cleanup code changes in this task are local workspace changes; merge/push is still required if the team wants CI evidence to include this exact diff.
