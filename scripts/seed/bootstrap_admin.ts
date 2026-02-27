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

const { PrismaClient, TenantMemberRole } = loadPrismaRuntime();

type CliArgs = {
  tenantSlug: string;
  editorEmail: string;
  viewerEmail: string;
  confirm: boolean;
  forceProd: boolean;
};

const DEFAULT_TENANT_SLUG = 'turtle-album';
const DEFAULT_EDITOR_EMAIL = 'editor@turtlealbum.local';
const DEFAULT_VIEWER_EMAIL = 'viewer@turtlealbum.local';

function parseArgs(argv: string[]): CliArgs {
  let tenantSlug = DEFAULT_TENANT_SLUG;
  let editorEmail = DEFAULT_EDITOR_EMAIL;
  let viewerEmail = DEFAULT_VIEWER_EMAIL;
  let confirm = false;
  let forceProd = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--confirm') {
      confirm = true;
      continue;
    }

    if (arg === '--i-know-what-im-doing') {
      forceProd = true;
      continue;
    }

    if (arg === '--tenant-slug') {
      tenantSlug = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--editor-email') {
      editorEmail = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--viewer-email') {
      viewerEmail = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!tenantSlug.trim()) {
    throw new Error('--tenant-slug cannot be empty.');
  }

  if (!editorEmail.includes('@')) {
    throw new Error('--editor-email must be a valid email.');
  }

  if (!viewerEmail.includes('@')) {
    throw new Error('--viewer-email must be a valid email.');
  }

  return {
    tenantSlug: tenantSlug.trim(),
    editorEmail: editorEmail.trim().toLowerCase(),
    viewerEmail: viewerEmail.trim().toLowerCase(),
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
    'Usage: ts-node scripts/seed/bootstrap_admin.ts [options]',
    '',
    'Options:',
    `  --tenant-slug <slug>        Target tenant slug (default: ${DEFAULT_TENANT_SLUG})`,
    `  --editor-email <email>      Editor user email (default: ${DEFAULT_EDITOR_EMAIL})`,
    `  --viewer-email <email>      Viewer user email (default: ${DEFAULT_VIEWER_EMAIL})`,
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
    const tenant = await prisma.tenant.findUnique({
      where: { slug: args.tenantSlug },
      select: { id: true, slug: true, name: true }
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${args.tenantSlug}. Import tenant first.`);
    }

    console.info('Bootstrap permission-test users');
    console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
    console.info(`- tenant: ${tenant.slug} (${tenant.id})`);
    console.info(`- editor: ${args.editorEmail}`);
    console.info(`- viewer: ${args.viewerEmail}`);

    if (!args.confirm) {
      console.info('No data changed. Re-run with --confirm to write.');
      return;
    }

    const editor = await prisma.user.upsert({
      where: { email: args.editorEmail },
      update: { name: 'TurtleAlbum Editor' },
      create: {
        email: args.editorEmail,
        name: 'TurtleAlbum Editor'
      }
    });

    const viewer = await prisma.user.upsert({
      where: { email: args.viewerEmail },
      update: { name: 'TurtleAlbum Viewer' },
      create: {
        email: args.viewerEmail,
        name: 'TurtleAlbum Viewer'
      }
    });

    await prisma.tenantMember.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: editor.id
        }
      },
      update: { role: TenantMemberRole.EDITOR },
      create: {
        tenantId: tenant.id,
        userId: editor.id,
        role: TenantMemberRole.EDITOR
      }
    });

    await prisma.tenantMember.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: viewer.id
        }
      },
      update: { role: TenantMemberRole.VIEWER },
      create: {
        tenantId: tenant.id,
        userId: viewer.id,
        role: TenantMemberRole.VIEWER
      }
    });

    console.info('Bootstrap complete');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Bootstrap failed');
  console.error(error);
  process.exitCode = 1;
});
