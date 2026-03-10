#!/usr/bin/env ts-node
// @ts-nocheck

import { createRequire } from 'node:module';
import { randomBytes, scryptSync } from 'node:crypto';

const require = createRequire(import.meta.url);

function loadPrismaRuntime() {
  try {
    return require('@prisma/client');
  } catch {
    return require('../../apps/api/node_modules/@prisma/client');
  }
}

const { PrismaClient } = loadPrismaRuntime();

type CliArgs = {
  account: string;
  email: string;
  password: string;
  name: string;
  confirm: boolean;
  forceProd: boolean;
};

const DEFAULT_ACCOUNT = 'admin';
const DEFAULT_EMAIL = 'admin@local.test';
const DEFAULT_NAME = 'Platform Admin';

function parseArgs(argv: string[]): CliArgs {
  let account = DEFAULT_ACCOUNT;
  let email = DEFAULT_EMAIL;
  let password = '';
  let name = DEFAULT_NAME;
  let confirm = false;
  let forceProd = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--account') {
      account = requireValue(argv, index, arg).trim().toLowerCase();
      index += 1;
      continue;
    }

    if (arg === '--email') {
      email = requireValue(argv, index, arg).trim().toLowerCase();
      index += 1;
      continue;
    }

    if (arg === '--password') {
      password = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--name') {
      name = requireValue(argv, index, arg).trim();
      index += 1;
      continue;
    }

    if (arg === '--confirm') {
      confirm = true;
      continue;
    }

    if (arg === '--i-know-what-im-doing') {
      forceProd = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!password || password.length < 8) {
    throw new Error('--password is required and must be at least 8 characters.');
  }

  if (!/^[a-z][a-z0-9_-]{2,30}[a-z0-9]$/.test(account)) {
    throw new Error('--account must be 4-32 chars and match account naming rules.');
  }

  if (!email.includes('@')) {
    throw new Error('--email must be a valid email.');
  }

  return {
    account,
    email,
    password,
    name: name || DEFAULT_NAME,
    confirm,
    forceProd
  };
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function printHelpAndExit(code: number): never {
  const lines = [
    'Usage: pnpm --filter @eggturtle/api super-admin:bootstrap -- --password <temp-password> [options]',
    '',
    'Options:',
    `  --account <account>         Bootstrap account name (default: ${DEFAULT_ACCOUNT})`,
    `  --email <email>             Bootstrap email (default: ${DEFAULT_EMAIL})`,
    '  --password <password>       Temporary bootstrap password (required)',
    `  --name <name>               Display name (default: ${DEFAULT_NAME})`,
    '  --confirm                   Execute write operations (default is dry-run)',
    '  --i-know-what-im-doing      Override prod URL safety check',
    '  -h, --help                  Show help'
  ];

  if (code === 0) {
    console.info(lines.join('\n'));
  } else {
    console.error(lines.join('\n'));
  }

  process.exit(code);
}

function looksLikeProductionDatabaseUrl(databaseUrl: string): boolean {
  const lower = databaseUrl.toLowerCase();
  const prodKeywordHit = ['prod', 'production', 'primary', 'master'].some((keyword) =>
    lower.includes(keyword)
  );

  let hostname = '';
  try {
    hostname = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    // Ignore parse errors and fall back to keyword-only detection.
  }

  const isLocalHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local');

  const riskyHostHit = [
    'rds.amazonaws.com',
    'neon.tech',
    'supabase.co',
    'render.com',
    'railway.app',
    'aliyuncs.com'
  ].some((domain) => hostname.includes(domain));

  if (riskyHostHit) {
    return true;
  }

  if (!hostname) {
    return prodKeywordHit;
  }

  return prodKeywordHit && !isLocalHost;
}

function hashPassword(password: string) {
  const pepper = process.env.AUTH_PASSWORD_PEPPER ?? process.env.AUTH_CODE_PEPPER ?? '';
  const salt = randomBytes(16);
  const derived = scryptSync(`${password}:${pepper}`, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  if (looksLikeProductionDatabaseUrl(databaseUrl) && !args.forceProd) {
    throw new Error(
      'Refusing to run because DATABASE_URL looks like production. Use --i-know-what-im-doing to override.'
    );
  }

  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: args.email },
          { account: args.account }
        ]
      },
      select: {
        id: true,
        email: true,
        account: true,
        isSuperAdmin: true
      }
    });

    console.info('Bootstrap super-admin');
    console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
    console.info(`- account: ${args.account}`);
    console.info(`- email: ${args.email}`);
    console.info(`- existingUser: ${existing ? existing.id : '(none)'}`);

    if (!args.confirm) {
      console.info('No data changed. Re-run with --confirm to write.');
      return;
    }

    const user = existing
      ? await prisma.user.update({
          where: {
            id: existing.id
          },
          data: {
            account: args.account,
            email: args.email,
            name: args.name,
            isSuperAdmin: true,
            passwordHash: hashPassword(args.password),
            passwordUpdatedAt: null
          }
        })
      : await prisma.user.create({
          data: {
            account: args.account,
            email: args.email,
            name: args.name,
            isSuperAdmin: true,
            passwordHash: hashPassword(args.password),
            passwordUpdatedAt: null
          }
        });

    console.info('Bootstrap admin ready');
    console.info(`- userId: ${user.id}`);
    console.info(`- account: ${user.account ?? '(none)'}`);
    console.info(`- email: ${user.email}`);
    console.info(`- isSuperAdmin: ${user.isSuperAdmin}`);
    console.info('- nextStep: sign in once and change password immediately');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Bootstrap super-admin failed');
  console.error(error);
  process.exitCode = 1;
});
