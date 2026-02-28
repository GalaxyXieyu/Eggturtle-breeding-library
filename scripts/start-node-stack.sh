#!/bin/sh
set -eu

cd /app

: "${PORT:=80}"
: "${API_PORT:=30011}"
: "${NODE_ENV:=production}"
: "${PRISMA_MIGRATE_ON_BOOT:=true}"
: "${PRISMA_SEED_ON_BOOT:=true}"
: "${INTERNAL_API_BASE_URL:=http://127.0.0.1:${API_PORT}}"

export NODE_ENV
export INTERNAL_API_BASE_URL

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

PORT="${API_PORT}" node /app/apps/api/dist/main.js &
API_PID=$!

stop_api() {
  kill "${API_PID}" >/dev/null 2>&1 || true
}

trap stop_api INT TERM EXIT

cd /app/apps/web
exec pnpm --filter @eggturtle/web exec next start -p "${PORT}"
