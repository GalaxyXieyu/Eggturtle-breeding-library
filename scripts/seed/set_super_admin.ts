#!/usr/bin/env ts-node
// @ts-nocheck

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadPrismaRuntime() {
  try {
    return require('@prisma/client');
  } catch {
    return require('../../apps/api/node_modules/@prisma/client');
  }
}

const { PrismaClient } = loadPrismaRuntime();

const ACCOUNT_EMAIL_DOMAIN = 'account.eggturtle.local';
const PHONE_PATTERN = /^1\d{10}$/;

type CliArgs = {
  login: string | null;
  userId: string | null;
  enable: boolean;
  confirm: boolean;
  forceProd: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  let login: string | null = null;
  let userId: string | null = null;
  let enable = true;
  let confirm = false;
  let forceProd = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--login') {
      login = requireValue(argv, index, arg).trim();
      index += 1;
      continue;
    }

    if (arg === '--user-id') {
      userId = requireValue(argv, index, arg).trim();
      index += 1;
      continue;
    }

    if (arg === '--disable') {
      enable = false;
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

  if (!login && !userId) {
    throw new Error('Provide --login <account|phone|email> or --user-id <id>.');
  }

  return {
    login,
    userId,
    enable,
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
    'Usage: pnpm --filter @eggturtle/api super-admin:set -- --login <account|phone|email> [options]',
    '',
    'Options:',
    '  --login <value>             Resolve user by account / phone / email',
    '  --user-id <id>              Resolve user by exact user id',
    '  --disable                   Revoke super-admin instead of granting it',
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

async function findTargetUser(prisma: InstanceType<typeof PrismaClient>, args: CliArgs) {
  if (args.userId) {
    return prisma.user.findUnique({
      where: { id: args.userId },
      include: {
        phoneBinding: {
          select: {
            phoneNumber: true
          }
        }
      }
    });
  }

  const login = args.login!.trim().toLowerCase();

  if (PHONE_PATTERN.test(login)) {
    const binding = await prisma.userPhoneBinding.findUnique({
      where: {
        phoneNumber: login
      },
      include: {
        user: {
          include: {
            phoneBinding: {
              select: {
                phoneNumber: true
              }
            }
          }
        }
      }
    });

    return binding?.user ?? null;
  }

  if (login.includes('@')) {
    return prisma.user.findUnique({
      where: {
        email: login
      },
      include: {
        phoneBinding: {
          select: {
            phoneNumber: true
          }
        }
      }
    });
  }

  return prisma.user.findFirst({
    where: {
      OR: [
        {
          account: login
        },
        {
          email: `${login}@${ACCOUNT_EMAIL_DOMAIN}`
        }
      ]
    },
    include: {
      phoneBinding: {
        select: {
          phoneNumber: true
        }
      }
    }
  });
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
    const user = await findTargetUser(prisma, args);

    if (!user) {
      throw new Error('Target user not found.');
    }

    console.info('Set super-admin flag');
    console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
    console.info(`- action: ${args.enable ? 'grant' : 'revoke'}`);
    console.info(`- userId: ${user.id}`);
    console.info(`- account: ${user.account ?? '(none)'}`);
    console.info(`- email: ${user.email}`);
    console.info(`- phone: ${user.phoneBinding?.phoneNumber ?? '(none)'}`);
    console.info(`- current: ${user.isSuperAdmin ? 'super-admin' : 'regular-user'}`);

    if (!args.confirm) {
      console.info('No data changed. Re-run with --confirm to write.');
      return;
    }

    const updated = await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        isSuperAdmin: args.enable
      },
      include: {
        phoneBinding: {
          select: {
            phoneNumber: true
          }
        }
      }
    });

    console.info('Updated user');
    console.info(`- account: ${updated.account ?? '(none)'}`);
    console.info(`- email: ${updated.email}`);
    console.info(`- phone: ${updated.phoneBinding?.phoneNumber ?? '(none)'}`);
    console.info(`- isSuperAdmin: ${updated.isSuperAdmin}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Set super-admin failed');
  console.error(error);
  process.exitCode = 1;
});
