# T73 share domain closeout - 2026-03-08

## Scope
- Task: unify tenant/admin-generated share links to `https://xuanyuku.cn`
- Repo: `/Users/apple/coding/Eggturtle-breeding-library`
- Focused chain only: share-presentation -> tenant floating share button -> `apps/web/lib/tenant-share.ts`

## Findings
- `apps/web/app/app/[tenantSlug]/share-presentation/page.tsx` generates the copyable share URL via `createTenantFeedShareLink()` and reads `share.permanentUrl`.
- `apps/web/components/tenant-floating-share-button.tsx` also uses `createTenantFeedShareLink()` and opens/copies `share.permanentUrl`.
- The shared permanent-link builder lived in `apps/web/lib/tenant-share.ts` and previously preferred `window.location.origin`, so links could inherit the current admin/app origin instead of the public share domain.
- Public share page routing itself stays at `/public/s/[shareToken]...`; this task only closes the absolute domain origin used when admin-side share links are generated.

## Change made
- Added `DEFAULT_PUBLIC_SHARE_ORIGIN = 'https://xuanyuku.cn'` in `apps/web/lib/tenant-share.ts`.
- Added `resolvePublicShareOrigin()` that reads `NEXT_PUBLIC_PUBLIC_APP_ORIGIN` and trims a trailing slash.
- Changed `buildTenantSharePermanentUrl()` to always emit an absolute URL on the configured public share origin, defaulting to `https://xuanyuku.cn`.
- Documented the new env in `apps/web/.env.example`.

## Verification
- `pnpm --filter @eggturtle/web lint`
- Result: pass, warnings only from existing `<img>` usage; no new lint error introduced by this change.

## Notes / residual risk
- API-returned `response.share.entryUrl` is left untouched; current admin sharing entry points copy/open `permanentUrl`, which is now unified.
- If an environment needs a different public share host, set `NEXT_PUBLIC_PUBLIC_APP_ORIGIN` explicitly.
- Browser-level/manual online click-through on production was not run in this pass.
