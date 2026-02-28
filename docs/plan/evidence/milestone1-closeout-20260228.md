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

## Acceptance Checklist (minimal)
- API tests green for relevant modules (`scripts/api-tests/*`).
- Seed script runs without leaking secrets (PR#9).
- Admin can manage tenant members (PR#10/#11).
- Web can browse Series/Breeders RO pages (PR#8).

## Rollback Plan (minimal)
- Roll back by reverting merge commits for the specific PR(s) if needed.
- Subscription enforcement can be softened by removing guard application (if an urgent unblock is needed), but prefer revert PR#12 as a whole to keep behavior consistent.
