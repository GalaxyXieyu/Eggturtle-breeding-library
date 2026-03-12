# Development Lane

## Use This Lane

Choose development when the request primarily changes product behavior, code, contracts, tests, or documentation tied to code changes.

Typical examples:

- build or fix API endpoints in `apps/api`
- build or fix user-facing flows in `apps/web`
- build or fix super-admin UI in `apps/admin`
- update shared contracts or types in `packages/shared`
- add or adjust test coverage, validation, or refactors

## Repo Surfaces Inspected

- `README.md`
- `docs/README.md`
- `apps/api/`
- `apps/web/`
- `apps/admin/`
- `packages/shared/`
- `scripts/api-tests/`

## Typical Commands

- `pnpm --filter @eggturtle/api dev`
- `pnpm --filter @eggturtle/web dev`
- `pnpm --filter @eggturtle/admin dev`
- `pnpm -r lint`
- `pnpm -r build`
- `pnpm api-tests`
- `pnpm api-tests:gate`

## Output Expectations

- Name the touched code areas first.
- Validate as narrowly as possible before broader checks.
- Update existing docs when behavior or runbook expectations change.
- Prefer small, root-cause fixes over broad rewrites.

## Do Not Use This Lane For

- local environment bring-up, deploy pipeline repair, runtime health recovery, or domain hardening -> use operations
- routine tenant governance, super-admin bootstrap, or migration/import execution without meaningful code changes -> use business operations

## Handoff Rules

- If an incident starts in operations but the root cause is a code defect, move the primary owner to development after stabilization.
- If an operator workflow exposes a missing page or API, capture the gap and hand off to development with the exact missing path, route, or command.
