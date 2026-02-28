# Pre-release Checklist (2026-02-28)

## Scope
Pre-release verification for Milestone 1 closeout and Membership/Subscription v1 rollout readiness.

Related PRs:
- PR#12 (backend subscription/enforcement): https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/12
- PR#13 (admin UI subscription/quota): https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/13

## Evidence Paths
- Milestone closeout doc: `docs/plan/evidence/milestone1-closeout-20260228.md`
- UX smoke doc: `docs/plan/evidence/ux-smoke-20260228.md`
- UI screenshots (local): `out/ui-smoke/20260228-150719/`

## Release Verify Checklist
- [ ] Confirm main branch is up to date and no unreviewed hotfix is pending.
- [ ] Confirm env defaults are safe for release (`SUPER_ADMIN_ENABLED=false` unless explicitly required by runbook).
- [ ] Confirm smoke data prerequisites are ready (tenant, series/breeders seed, membership test tenant).

### 1) Static quality gates
Run from repo root:

```bash
pnpm lint
pnpm build
```

- [ ] `pnpm lint` passes.
- [ ] `pnpm build` passes.

### 2) API test gates (key modules)
Run from repo root:

```bash
pnpm api-tests -- --only auth,series,breeders,admin,subscription --clear-token-cache
```

Optional full gate:

```bash
pnpm api-tests:gate
```

- [ ] Key-module api-tests pass (`auth/series/breeders/admin/subscription`).
- [ ] No unexpected 5xx/timeout in test output.

### 3) Manual UX gates (admin + web)
- [ ] Admin: login -> `/dashboard/tenants` -> tenant detail -> memberships write path -> audit log visible.
- [ ] Web: login -> tenant select -> series list -> breeder detail/events/family-tree -> featured/share path.
- [ ] Evidence captured in `docs/plan/evidence/ux-smoke-20260228.md` and local screenshot directory.

## Rollback Plan (PR#12/#13 + gating toggles)
If release gate fails or production behavior is unsafe, rollback in this order.

### A. Revert merge commits for PR#12 and PR#13
Find merge commits:

```bash
git log --oneline --merges --grep "Merge pull request #12"
git log --oneline --merges --grep "Merge pull request #13"
```

Revert (example):

```bash
git revert -m 1 <merge_commit_for_pr12>
git revert -m 1 <merge_commit_for_pr13>
```

- [ ] Open rollback PR with both revert commits.
- [ ] Run `pnpm lint && pnpm build` on rollback branch before merge.

### B. Restore gating toggles to safe defaults
- [ ] Ensure `SUPER_ADMIN_ENABLED=false` in target environment.
- [ ] Ensure `SUPER_ADMIN_EMAILS` is restricted to explicit allowlist or emptied per runbook.
- [ ] Revert any temporary release-day gating override used for smoke or debugging.

### C. Post-rollback verification
Run:

```bash
pnpm lint
pnpm build
pnpm api-tests -- --only auth,series,breeders,admin --clear-token-cache
```

- [ ] Admin and web core read paths are healthy.
- [ ] Subscription write paths are disabled/reverted as expected.
- [ ] Rollback evidence is linked in this doc and taskboard entry T33.
