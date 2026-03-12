# Operations Lane

## Use This Lane

Choose operations when the request primarily concerns environment management, runtime health, deployment, CI/CD, release safety, or infrastructure-facing checks.

Typical examples:

- start, stop, or recover the local stack
- verify runtime health or process state
- adjust deployment or container entrypoints
- diagnose CI, GitHub Actions, or domain hardening failures
- update release/runbook procedures without changing core product behavior

## Repo Surfaces Inspected

- `dev.sh`
- `Dockerfile`
- `Dockerfile.node`
- `docker-compose.local.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/lint-build-pr.yml`
- `scripts/deploy/domain_hardening_check.sh`
- `docs/deploy/sealos-domain-hardening.md`
- `docs/deployment/image-thumbnails-deployment.md`
- `docs/deployment/t77-public-attribution-first-product-runbook.md`

## Typical Commands

- `pnpm dev:start`
- `pnpm dev:stop`
- `pnpm dev:status`
- `./dev.sh start`
- `./dev.sh stop`
- `./dev.sh status`
- `CLEAN_ON_START=1 ./dev.sh start`
- `API_HEALTH_URL=http://127.0.0.1:30011/health ./dev.sh start`
- `docker build -f Dockerfile.node -t eggturtle-node:local .`

## Output Expectations

- Separate diagnosis, mitigation, and permanent fix.
- Call out which environments are affected.
- Prefer reversible changes and explicit health checks.
- Record rollback steps for any deploy or runtime mutation.

## Do Not Use This Lane For

- product feature work, UI work, API changes, or schema changes -> use development
- tenant governance, admin bootstrap, operator imports, or write-heavy business workflows -> use business operations

## Handoff Rules

- If the system is unhealthy because of code behavior, stabilize first, then hand off to development for the durable fix.
- If the task changes tenant data, admin access, or migration content, involve business operations as primary or secondary owner.
