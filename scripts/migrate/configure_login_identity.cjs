#!/usr/bin/env node

const path = require('path');
const { randomBytes, scryptSync } = require('node:crypto');

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
const ACCOUNT_PATTERN = /^[a-z][a-z0-9_-]{2,30}[a-z0-9]$/;

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] ?? null;
}

function requireArg(flag) {
  const value = readArg(flag);
  if (!value) {
    throw new Error(`Missing required argument: ${flag}`);
  }
  return value;
}

function normalizeAccount(value) {
  const normalized = value.trim().toLowerCase();
  if (!ACCOUNT_PATTERN.test(normalized)) {
    throw new Error(`Invalid account: ${value}`);
  }
  return normalized;
}

function hashPassword(password) {
  const pepper = process.env.AUTH_PASSWORD_PEPPER ?? process.env.AUTH_CODE_PEPPER ?? '';
  const salt = randomBytes(16);
  const derived = scryptSync(`${password}:${pepper}`, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function main() {
  const write = process.argv.includes('--write');
  const tenantSlug = requireArg('--tenant-slug');
  const account = normalizeAccount(requireArg('--account'));
  const password = requireArg('--password');
  const phoneNumber = readArg('--phone');
  const displayName = readArg('--display-name');
  const nextEmail = `${account}@${ACCOUNT_EMAIL_DOMAIN}`;

  const membership = await prisma.tenantMember.findFirst({
    where: {
      role: 'OWNER',
      tenant: {
        slug: tenantSlug,
      },
    },
    include: {
      tenant: true,
      user: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (!membership) {
    throw new Error(`Owner membership not found for tenant slug: ${tenantSlug}`);
  }

  const conflictingAccount = await prisma.user.findUnique({ where: { account } });
  if (conflictingAccount && conflictingAccount.id !== membership.userId) {
    throw new Error(`Account ${account} is already used by user ${conflictingAccount.id}`);
  }

  const conflictingEmail = await prisma.user.findUnique({ where: { email: nextEmail } });
  if (conflictingEmail && conflictingEmail.id !== membership.userId) {
    throw new Error(`Email ${nextEmail} is already used by user ${conflictingEmail.id}`);
  }

  const existingPhoneBinding = phoneNumber
    ? await prisma.userPhoneBinding.findUnique({
        where: { phoneNumber },
      })
    : null;

  console.log(JSON.stringify({
    write,
    tenantSlug: membership.tenant.slug,
    tenantId: membership.tenant.id,
    userId: membership.user.id,
    current: {
      email: membership.user.email,
      account: membership.user.account,
      name: membership.user.name,
      phoneNumber: existingPhoneBinding?.userId === membership.user.id ? phoneNumber : null,
    },
    next: {
      email: nextEmail,
      account,
      name: displayName ?? membership.user.name ?? account,
      phoneNumber: phoneNumber ?? null,
    },
    rebindingFromUserId:
      existingPhoneBinding && existingPhoneBinding.userId !== membership.user.id
        ? existingPhoneBinding.userId
        : null,
  }, null, 2));

  if (!write) {
    console.log('Preview complete. Re-run with --write to apply.');
    return;
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (existingPhoneBinding && existingPhoneBinding.userId !== membership.user.id) {
      await tx.userPhoneBinding.delete({
        where: { phoneNumber },
      });
    }

    if (phoneNumber) {
      await tx.userPhoneBinding.upsert({
        where: { userId: membership.user.id },
        update: {
          phoneNumber,
          updatedAt: now,
        },
        create: {
          userId: membership.user.id,
          phoneNumber,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    await tx.user.update({
      where: { id: membership.user.id },
      data: {
        email: nextEmail,
        account,
        name: displayName ?? membership.user.name ?? account,
        passwordHash: hashPassword(password),
        passwordUpdatedAt: now,
      },
    });
  });

  console.log('Identity updated successfully.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
