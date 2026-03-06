#!/usr/bin/env node

const path = require('path');

let PrismaClient;
try {
  ({ PrismaClient } = require('@prisma/client'));
} catch {
  ({ PrismaClient } = require(require.resolve('@prisma/client', {
    paths: [path.join(process.cwd(), 'apps/api')],
  })));
}

const prisma = new PrismaClient();
const ACCOUNT_EMAIL_DOMAIN = 'account.eggturtle.local';
const PHONE_SHADOW_EMAIL_DOMAIN = 'phone.eggturtle.local';
const ACCOUNT_PATTERN = /^[a-z][a-z0-9_-]{2,30}[a-z0-9]$/;

function normalizeAccount(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return ACCOUNT_PATTERN.test(normalized) ? normalized : null;
}

function emailLocalPart(email) {
  const atIndex = email.indexOf('@');
  return atIndex === -1 ? email : email.slice(0, atIndex);
}

function deriveLegacyAccount(user) {
  const current = normalizeAccount(user.account);
  if (current) {
    return current;
  }

  if (user.email.endsWith(`@${ACCOUNT_EMAIL_DOMAIN}`)) {
    return normalizeAccount(emailLocalPart(user.email));
  }

  const nameCandidate = normalizeAccount(user.name);
  if (nameCandidate) {
    return nameCandidate;
  }

  if (!user.email.endsWith(`@${PHONE_SHADOW_EMAIL_DOMAIN}`)) {
    return normalizeAccount(emailLocalPart(user.email));
  }

  return null;
}

function makeUniqueAccount(base, usedAccounts) {
  if (!usedAccounts.has(base)) {
    usedAccounts.add(base);
    return base;
  }

  let index = 2;
  while (index < 1000) {
    const suffix = `-${index}`;
    const trimmedBase = base.slice(0, 32 - suffix.length).replace(/[-_]+$/g, '') || 'user';
    const candidate = `${trimmedBase}${suffix}`;
    if (!usedAccounts.has(candidate)) {
      usedAccounts.add(candidate);
      return candidate;
    }
    index += 1;
  }

  throw new Error(`Unable to allocate unique account for base "${base}"`);
}

async function main() {
  const write = process.argv.includes('--write');
  const users = await prisma.user.findMany({
    include: {
      phoneBinding: {
        select: {
          phoneNumber: true,
        },
      },
      tenantMembers: {
        include: {
          tenant: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const usedAccounts = new Set(
    users.map((user) => normalizeAccount(user.account)).filter(Boolean),
  );

  const plans = [];
  for (const user of users) {
    const current = normalizeAccount(user.account);
    const derived = deriveLegacyAccount(user);
    if (!derived || current === derived) {
      continue;
    }

    const finalAccount = makeUniqueAccount(derived, usedAccounts);
    if (finalAccount === current) {
      continue;
    }

    plans.push({
      id: user.id,
      email: user.email,
      currentAccount: current,
      nextAccount: finalAccount,
      name: user.name,
      phoneNumber: user.phoneBinding?.phoneNumber ?? null,
      tenantSlug: user.tenantMembers[0]?.tenant.slug ?? null,
    });
  }

  if (plans.length === 0) {
    console.log('No user accounts need backfill.');
    return;
  }

  console.table(
    plans.map((plan) => ({
      id: plan.id,
      nextAccount: plan.nextAccount,
      currentAccount: plan.currentAccount,
      phoneNumber: plan.phoneNumber,
      tenantSlug: plan.tenantSlug,
      email: plan.email,
      name: plan.name,
    })),
  );

  if (!write) {
    console.log(`Preview complete: ${plans.length} user(s) will be updated. Re-run with --write to apply.`);
    return;
  }

  for (const plan of plans) {
    await prisma.user.update({
      where: { id: plan.id },
      data: { account: plan.nextAccount },
    });
  }

  console.log(`Applied account backfill for ${plans.length} user(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
