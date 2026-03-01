#!/bin/sh
set -eu

cd /app

: "${PORT:=80}"
: "${API_PORT:=30011}"
: "${NODE_ENV:=production}"
: "${PRISMA_MIGRATE_ON_BOOT:=true}"
: "${PRISMA_SEED_ON_BOOT:=true}"
: "${INTERNAL_API_BASE_URL:=http://127.0.0.1:${API_PORT}}"
: "${WEB_BUILD_ON_BOOT:=auto}"

export NODE_ENV
export INTERNAL_API_BASE_URL

web_build_required() {
  case "${WEB_BUILD_ON_BOOT}" in
    true)
      return 0
      ;;
    false)
      return 1
      ;;
    auto)
      ;;
    *)
      echo "[web] unknown WEB_BUILD_ON_BOOT=${WEB_BUILD_ON_BOOT}, fallback to auto"
      ;;
  esac

  if [ ! -f /app/apps/web/.next/BUILD_ID ]; then
    echo "[web] missing /app/apps/web/.next/BUILD_ID"
    return 0
  fi

  if [ ! -d /app/apps/web/.next/server ] || [ ! -d /app/apps/web/.next/static ]; then
    echo "[web] incomplete /app/apps/web/.next artifacts"
    return 0
  fi

  if find \
    /app/apps/web/app \
    /app/apps/web/lib \
    /app/apps/web/public \
    /app/apps/web/next.config.mjs \
    /app/apps/web/package.json \
    /app/packages/shared/src \
    /app/packages/shared/styles \
    -type f \
    -newer /app/apps/web/.next/BUILD_ID \
    -print \
    -quit 2>/dev/null | grep -q .; then
    echo "[web] source changes detected after latest build"
    return 0
  fi

  return 1
}

if [ "${PRISMA_MIGRATE_ON_BOOT}" = "true" ]; then
  pnpm --filter @eggturtle/api prisma:deploy
fi

if [ "${PRISMA_SEED_ON_BOOT}" = "true" ]; then
  pnpm --filter @eggturtle/api prisma:seed
fi

if [ -n "${BOOTSTRAP_OWNER_EMAIL:-}" ] && [ -n "${BOOTSTRAP_OWNER_PASSWORD:-}" ]; then
  (
  cd /app/apps/api
  node <<'NODE'
const { PrismaClient, TenantMemberRole } = require('@prisma/client');
const { randomBytes, scryptSync } = require('node:crypto');

const prisma = new PrismaClient();

function hashPassword(password, pepper) {
  const salt = randomBytes(16);
  const derived = scryptSync(`${password}:${pepper}`, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function main() {
  const email = process.env.BOOTSTRAP_OWNER_EMAIL;
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
  const tenantSlug = process.env.BOOTSTRAP_TENANT_SLUG || 'eggturtle-demo';
  const tenantName = process.env.BOOTSTRAP_TENANT_NAME || 'Eggturtle Demo Tenant';
  const pepper = process.env.AUTH_PASSWORD_PEPPER || process.env.AUTH_CODE_PEPPER || '';

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: tenantName },
    create: {
      slug: tenantSlug,
      name: tenantName
    }
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashPassword(password, pepper),
      passwordUpdatedAt: new Date()
    },
    create: {
      email,
      passwordHash: hashPassword(password, pepper),
      passwordUpdatedAt: new Date()
    }
  });

  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id
      }
    },
    update: { role: TenantMemberRole.OWNER },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: TenantMemberRole.OWNER
    }
  });

  console.info('[bootstrap-owner] ensured owner account', { email, tenantSlug });
}

main()
  .catch((error) => {
    console.error('[bootstrap-owner] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE
  )
fi

if web_build_required; then
  echo "[web] rebuilding Next.js artifacts"
  pnpm --filter @eggturtle/shared build
  pnpm --filter @eggturtle/web build
else
  echo "[web] reusing existing Next.js build"
fi

PORT="${API_PORT}" node /app/apps/api/dist/main.js &
API_PID=$!

stop_api() {
  kill "${API_PID}" >/dev/null 2>&1 || true
}

trap stop_api INT TERM EXIT

cd /app/apps/web
exec pnpm --filter @eggturtle/web exec next start -p "${PORT}"
