# Membership/Subscription v1 Evidence

Date: 2026-02-28

## Covered

- Tenant subscription schema + migration
- Admin subscription GET/PUT contracts and API handlers
- Tenant write guard for inactive subscriptions
- Share creation plan gate (configured subscription requires PRO)
- Image upload quota checks (`maxImages`, `maxStorageBytes`)
- API tests for admin subscription + share/image gating paths

## Verification commands

```bash
pnpm -r lint
pnpm -r build

set -a
source /Volumes/DATABASE/code/Eggturtle-breeding-library/apps/api/.env
set +a
pnpm --filter @eggturtle/api prisma:deploy

set -a
source /Volumes/DATABASE/code/Eggturtle-breeding-library/apps/api/.env
set +a
PORT=30111 node apps/api/dist/main.js >/tmp/wt-membership-api-30111.log 2>&1 &
API_PID=$!
pnpm api-tests -- --api-base http://localhost:30111 --allow-remote --confirm-writes --only subscription --super-admin-email synthetic.superadmin@local.test --clear-token-cache --require-super-admin-pass
pnpm api-tests -- --api-base http://localhost:30111 --allow-remote --confirm-writes --only shares,images,admin,subscription --super-admin-email synthetic.superadmin@local.test --clear-token-cache --require-super-admin-pass
kill $API_PID
```

## Result snapshot

- `subscription` module: pass (`checks=10`)
- `shares,images,admin,subscription` subset: pass (`totalChecks=27`)
