# API Tests (TypeScript)

`scripts/api-tests/` contains TypeScript API interface tests executed with `ts-node`.

## Goals

- Split scenarios by module (`auth`, `products`, `images`, `featured`, `shares`, `admin`, `account-matrix`)
- Keep logs concise by default, with optional JSONL output for debugging (`--json`)
- Safe by default: no write requests are sent unless `--confirm-writes` is provided

## Quick Commands

```bash
# Dry-run plan only (no network requests)
pnpm api-tests

# Run default modules (auth/products/images/featured/shares/admin)
pnpm api-tests -- --confirm-writes

# Run selected modules only
pnpm api-tests -- --confirm-writes --only auth,products,shares

# Clear local token cache before execution
pnpm api-tests -- --confirm-writes --clear-token-cache

# JSONL logs for CI or machine parsing
pnpm api-tests -- --confirm-writes --json

# Allow non-local API base explicitly
pnpm api-tests -- --api-base https://staging.example.com --allow-remote --confirm-writes
```

## Full Run Evidence Harness

Use the harness to run the full module suite with real requests and save reproducible artifacts under `out/t26-api-full-run/<timestamp>/`.

```bash
NODE_ENV=development AUTH_DEV_CODE_ENABLED=true \
  scripts/api-tests/evidence-harness.sh
```

Behavior:

- checks `NODE_ENV` and `AUTH_DEV_CODE_ENABLED`
- validates API connectivity via `GET /health`
- optional API auto-start with `AUTO_START_API=1`
- writes `command.sh`, `events.jsonl`, `summary.json`, and `summary.md`

## Account Matrix (OWNER/ADMIN/EDITOR/VIEWER)

`account-matrix` replaces the previous bash matrix smoke flow.

```bash
# Existing tenant
pnpm api-tests -- \
  --only account-matrix \
  --confirm-writes \
  --owner-email owner@example.com \
  --admin-email admin@example.com \
  --editor-email editor@example.com \
  --viewer-email viewer@example.com \
  --tenant-id <tenant-id>

# Provision tenant + memberships via super-admin
pnpm api-tests -- \
  --only account-matrix \
  --confirm-writes \
  --provision \
  --super-admin-email super@example.com \
  --owner-email owner@example.com \
  --admin-email admin@example.com \
  --editor-email editor@example.com \
  --viewer-email viewer@example.com
```

## CLI Flags

- `--api-base <url>`: API base URL (default: `http://localhost:30011`)
- `--allow-remote`: allow non-local API URL
- `--confirm-writes`: execute write scenarios
- `--json`: emit JSONL logs
- `--clear-token-cache`: clear `.data/api-tests/token-cache.json` before the run
- `--only <list>`: comma-separated module names
- `--tenant-id <id>`: use existing tenant for tenant-scoped modules
- `--tenant-slug <slug>` / `--tenant-name <name>`: tenant metadata when auto-creating tenant
- `--email <email>`: base email for non-matrix modules
- `--owner-email / --admin-email / --editor-email / --viewer-email`: role emails for matrix
- `--super-admin-email <email>`: super-admin checks/provisioning
- `--provision`: create tenant and assign role memberships using `/admin/*`
- `--require-super-admin-pass`: fail if super-admin positive check is not 2xx

## Runtime Notes

- Requires dev code auth flow (`AUTH_DEV_CODE_ENABLED=true`) for login automation.
- Login base tokens are cached in `.data/api-tests/token-cache.json` for 1 hour to reduce repeated auth churn.
- `--clear-token-cache` removes the cache file before module execution.
- Runner executes all selected modules and prints a consolidated failure summary at the end.
- Uses Node 22 global `fetch` and `FormData`.
- Designed for low-noise logs by default; use `--json` for full event trails.
