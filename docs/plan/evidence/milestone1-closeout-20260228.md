# Milestone 1 Closeout (2026-02-28)

## Scope
Milestone 1 (Series/Breeders read-only) closeout + hygiene items required before wider rollout.

## Shipped PRs
- PR#7 series/breeders read-only (API + shared contracts + api-tests): https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/7
- PR#8 web entry pages + seed demo data: https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/8
- PR#9 security hotfix (redact DATABASE_URL in seed logs): https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/9

## Admin Ops PRs (supporting)
- PR#10 remove tenant member endpoint: https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/10
- PR#11 admin UI remove member action: https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/11

## Membership/Subscription v1
- PR#12 backend subscription (schema + admin API + enforcement + api-tests): https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/12
- PR#13 admin UI subscription/quota config: https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/13

## Demo and Screenshot Placeholders
- Demo URL (to fill): `TODO: https://...`
- UX smoke index doc: `docs/plan/evidence/ux-smoke-20260228.md`
- Screenshot root (local): `out/ui-smoke/20260228-150719/`
- Screenshot index placeholder:
  - `01-web-login.png`
  - `02-web-tenant-select.png`
  - `03-web-series-list.png`
  - `04-web-breeder-detail.png`
  - `05-admin-login.png`
  - `06-admin-tenants.png`
  - `07-admin-memberships.png`
  - `08-admin-audit-logs.png`

## Acceptance Checklist
- [ ] `pnpm lint` passes on release candidate.
- [ ] `pnpm build` passes on release candidate.
- [ ] Key API tests pass (`auth,series,breeders,admin,subscription`).
- [ ] Web read-only milestone flows pass (series/breeders/detail/events/family-tree).
- [ ] Admin core flows pass (login, tenants, memberships, audit logs).
- [ ] Smoke evidence (screenshots + notes) is linked and reproducible.
- [ ] Rollback owner and commands confirmed before release decision.

## Rollback Plan (minimal)
- Prefer full revert for membership/subscription rollout by reverting PR#12 and PR#13 merge commits.
- Restore gating toggles to safe defaults (`SUPER_ADMIN_ENABLED=false`, strict/empty allowlist as runbook requires).
- Re-run `pnpm lint && pnpm build` and key api-tests after rollback.
- Detailed SOP: `docs/plan/evidence/pre-release-checklist-20260228.md`.
