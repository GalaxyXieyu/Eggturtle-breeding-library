#!/usr/bin/env ts-node
// @ts-nocheck

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

function loadPrismaRuntime() {
  try {
    return require('@prisma/client');
  } catch {
    return require('../../apps/api/node_modules/@prisma/client');
  }
}

const { PrismaClient, TenantMemberRole } = loadPrismaRuntime();

type ExportedUser = {
  id: string;
  username: string;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type ExportedProduct = {
  id: string;
  code: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ExportedProductImage = {
  id: string;
  product_id: string;
  url: string;
  type: string | null;
  sort_order: number | null;
  created_at: string | null;
};

type ExportPayload = {
  version: number;
  exported_at: string;
  counts?: Record<string, number>;
  validation_issues?: string[];
  users: ExportedUser[];
  products: ExportedProduct[];
  product_images: ExportedProductImage[];
};

type CliArgs = {
  input: string;
  confirm: boolean;
  forceProd: boolean;
  tenantSlug: string;
  tenantName: string;
  adminEmail: string;
};

type ImportCounters = {
  productsCreated: number;
  productsUpdated: number;
  imagesCreated: number;
  imagesUpdated: number;
  imagesSkippedEmptyUrl: number;
};

const DEFAULT_INPUT = './out/turtle_album_export.json';
const DEFAULT_TENANT_SLUG = 'turtle-album';
const DEFAULT_TENANT_NAME = 'Turtle Album';
const DEFAULT_ADMIN_EMAIL = 'admin@turtlealbum.local';

function parseArgs(argv: string[]): CliArgs {
  let input = DEFAULT_INPUT;
  let confirm = false;
  let forceProd = false;
  let tenantSlug = DEFAULT_TENANT_SLUG;
  let tenantName = DEFAULT_TENANT_NAME;
  let adminEmail = DEFAULT_ADMIN_EMAIL;

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

    if (arg === '--input') {
      input = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--tenant-slug') {
      tenantSlug = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--tenant-name') {
      tenantName = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--admin-email') {
      adminEmail = requireValue(argv, index, arg);
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

  if (!tenantName.trim()) {
    throw new Error('--tenant-name cannot be empty.');
  }

  if (!adminEmail.includes('@')) {
    throw new Error('--admin-email must be a valid email.');
  }

  return {
    input,
    confirm,
    forceProd,
    tenantSlug: tenantSlug.trim(),
    tenantName: tenantName.trim(),
    adminEmail: adminEmail.trim().toLowerCase()
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
    'Usage: ts-node scripts/seed/import_turtle_album.ts [options]',
    '',
    'Options:',
    `  --input <path>              Input export JSON path (default: ${DEFAULT_INPUT})`,
    `  --tenant-slug <slug>        Target tenant slug (default: ${DEFAULT_TENANT_SLUG})`,
    `  --tenant-name <name>        Target tenant name (default: ${DEFAULT_TENANT_NAME})`,
    `  --admin-email <email>       Admin owner email (default: ${DEFAULT_ADMIN_EMAIL})`,
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

function parsePayload(inputPath: string): ExportPayload {
  const absolutePath = resolve(inputPath);
  const raw = readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<ExportPayload>;

  if (!Array.isArray(parsed.products)) {
    throw new Error(`Invalid payload in ${absolutePath}: products must be an array.`);
  }

  if (!Array.isArray(parsed.product_images)) {
    throw new Error(`Invalid payload in ${absolutePath}: product_images must be an array.`);
  }

  if (!Array.isArray(parsed.users)) {
    throw new Error(`Invalid payload in ${absolutePath}: users must be an array.`);
  }

  return {
    version: parsed.version ?? 1,
    exported_at: parsed.exported_at ?? '',
    counts: parsed.counts,
    validation_issues: parsed.validation_issues,
    users: parsed.users,
    products: parsed.products,
    product_images: parsed.product_images
  };
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

function deriveImageKey(url: string): string {
  const hash = createHash('sha1').update(url).digest('hex');
  return `external/${hash}`;
}

function normalizeSortOrder(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function inferContentType(url: string): string | null {
  const normalized = url.toLowerCase();
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (normalized.endsWith('.png')) {
    return 'image/png';
  }
  if (normalized.endsWith('.webp')) {
    return 'image/webp';
  }
  if (normalized.endsWith('.gif')) {
    return 'image/gif';
  }
  return null;
}

function groupImagesByProduct(images: ExportedProductImage[]): Map<string, ExportedProductImage[]> {
  const result = new Map<string, ExportedProductImage[]>();

  for (const image of images) {
    const list = result.get(image.product_id) ?? [];
    list.push(image);
    result.set(image.product_id, list);
  }

  for (const [productId, list] of result.entries()) {
    list.sort((left, right) => {
      const leftSort = normalizeSortOrder(left.sort_order, Number.MAX_SAFE_INTEGER);
      const rightSort = normalizeSortOrder(right.sort_order, Number.MAX_SAFE_INTEGER);

      if (leftSort !== rightSort) {
        return leftSort - rightSort;
      }

      const leftCreated = left.created_at ?? '';
      const rightCreated = right.created_at ?? '';
      if (leftCreated !== rightCreated) {
        return leftCreated.localeCompare(rightCreated);
      }

      return left.id.localeCompare(right.id);
    });

    result.set(productId, list);
  }

  return result;
}

function printPlan(args: CliArgs, payload: ExportPayload, databaseUrl: string): void {
  console.info('Import plan:');
  console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
  console.info(`- input: ${resolve(args.input)}`);
  console.info(`- tenant: ${args.tenantSlug} (${args.tenantName})`);
  console.info(`- admin email: ${args.adminEmail}`);
  console.info(`- database: ${databaseUrl}`);
  console.info(
    `- payload counts: users=${payload.users.length}, products=${payload.products.length}, product_images=${payload.product_images.length}`
  );

  if (payload.validation_issues && payload.validation_issues.length > 0) {
    console.info(`- payload validation issues: ${payload.validation_issues.length}`);
  }
}

async function runDryRun(prisma: PrismaClient, args: CliArgs, payload: ExportPayload): Promise<void> {
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: args.tenantSlug },
    select: { id: true, slug: true, name: true }
  });

  const existingAdminUser = await prisma.user.findUnique({
    where: { email: args.adminEmail },
    select: { id: true, email: true }
  });

  const importedCodes = payload.products.map((product) => product.code.trim()).filter((code) => code.length > 0);
  const uniqueCodes = Array.from(new Set(importedCodes));

  let existingProductsCount = 0;
  if (existingTenant && uniqueCodes.length > 0) {
    existingProductsCount = await prisma.product.count({
      where: {
        tenantId: existingTenant.id,
        code: { in: uniqueCodes }
      }
    });
  }

  console.info('Dry-run summary:');
  console.info(`- tenant exists: ${existingTenant ? 'yes' : 'no'}`);
  console.info(`- admin user exists: ${existingAdminUser ? 'yes' : 'no'}`);
  console.info(`- products to upsert: ${uniqueCodes.length}`);
  console.info(`- products likely create: ${Math.max(0, uniqueCodes.length - existingProductsCount)}`);
  console.info(`- products likely update: ${existingProductsCount}`);
  console.info(`- product images to process: ${payload.product_images.length}`);
  console.info('No data changed. Re-run with --confirm to write.');
}

async function runWrite(prisma: PrismaClient, args: CliArgs, payload: ExportPayload): Promise<void> {
  const imagesByProduct = groupImagesByProduct(payload.product_images);
  const counters: ImportCounters = {
    productsCreated: 0,
    productsUpdated: 0,
    imagesCreated: 0,
    imagesUpdated: 0,
    imagesSkippedEmptyUrl: 0
  };

  const productIdMap = new Map<string, string>();

  await prisma.$transaction(async (tx) => {
    const adminUser = await tx.user.upsert({
      where: { email: args.adminEmail },
      update: { name: 'TurtleAlbum Admin' },
      create: {
        email: args.adminEmail,
        name: 'TurtleAlbum Admin'
      }
    });

    const tenant = await tx.tenant.upsert({
      where: { slug: args.tenantSlug },
      update: { name: args.tenantName },
      create: {
        slug: args.tenantSlug,
        name: args.tenantName
      }
    });

    await tx.tenantMember.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: adminUser.id
        }
      },
      update: { role: TenantMemberRole.OWNER },
      create: {
        tenantId: tenant.id,
        userId: adminUser.id,
        role: TenantMemberRole.OWNER
      }
    });

    for (const legacyProduct of payload.products) {
      const code = legacyProduct.code.trim();
      if (!code) {
        continue;
      }

      const existing = await tx.product.findUnique({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code
          }
        },
        select: { id: true }
      });

      const upsertedProduct = await tx.product.upsert({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code
          }
        },
        update: {
          description: legacyProduct.description ?? null
        },
        create: {
          tenantId: tenant.id,
          code,
          name: null,
          description: legacyProduct.description ?? null
        }
      });

      if (existing) {
        counters.productsUpdated += 1;
      } else {
        counters.productsCreated += 1;
      }

      productIdMap.set(legacyProduct.id, upsertedProduct.id);
    }

    for (const legacyProduct of payload.products) {
      const targetProductId = productIdMap.get(legacyProduct.id);
      if (!targetProductId) {
        continue;
      }

      const importedImages = imagesByProduct.get(legacyProduct.id) ?? [];
      if (importedImages.length === 0) {
        continue;
      }

      const normalizedImages = importedImages
        .map((image, index) => {
          const url = image.url.trim();
          if (!url) {
            counters.imagesSkippedEmptyUrl += 1;
            return null;
          }

          return {
            image,
            url,
            key: deriveImageKey(url),
            sortOrder: normalizeSortOrder(image.sort_order, index)
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((left, right) => left.sortOrder - right.sortOrder);

      if (normalizedImages.length === 0) {
        continue;
      }

      const preferredMain = normalizedImages.find(
        (item) => (item.image.type ?? '').toLowerCase() === 'main'
      );
      const mainCandidate = preferredMain ?? normalizedImages[0];
      let mainImageId: string | null = null;

      for (const item of normalizedImages) {
        const existingImage = await tx.productImage.findFirst({
          where: {
            tenantId: tenant.id,
            productId: targetProductId,
            key: item.key
          },
          select: { id: true }
        });

        const isMain = item.key === mainCandidate.key;

        if (existingImage) {
          const updated = await tx.productImage.update({
            where: { id: existingImage.id },
            data: {
              url: item.url,
              contentType: inferContentType(item.url),
              sortOrder: item.sortOrder,
              isMain
            }
          });
          counters.imagesUpdated += 1;
          if (isMain) {
            mainImageId = updated.id;
          }
          continue;
        }

        const created = await tx.productImage.create({
          data: {
            tenantId: tenant.id,
            productId: targetProductId,
            key: item.key,
            url: item.url,
            contentType: inferContentType(item.url),
            sortOrder: item.sortOrder,
            isMain
          }
        });
        counters.imagesCreated += 1;
        if (isMain) {
          mainImageId = created.id;
        }
      }

      if (mainImageId) {
        await tx.productImage.updateMany({
          where: {
            tenantId: tenant.id,
            productId: targetProductId
          },
          data: {
            isMain: false
          }
        });

        await tx.productImage.update({
          where: { id: mainImageId },
          data: { isMain: true }
        });
      }
    }
  });

  console.info('Import complete');
  console.info(`- tenant: ${args.tenantSlug}`);
  console.info(`- admin owner: ${args.adminEmail}`);
  console.info(`- products created: ${counters.productsCreated}`);
  console.info(`- products updated: ${counters.productsUpdated}`);
  console.info(`- images created: ${counters.imagesCreated}`);
  console.info(`- images updated: ${counters.imagesUpdated}`);
  console.info(`- images skipped empty url: ${counters.imagesSkippedEmptyUrl}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const payload = parsePayload(args.input);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  if (looksLikeProductionDatabaseUrl(databaseUrl) && !args.forceProd) {
    throw new Error(
      'Refusing to run because DATABASE_URL looks like production. Use --i-know-what-im-doing to override.'
    );
  }

  printPlan(args, payload, databaseUrl);

  const prisma = new PrismaClient();
  try {
    if (!args.confirm) {
      await runDryRun(prisma, args, payload);
      return;
    }

    await runWrite(prisma, args, payload);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Import failed');
  console.error(error);
  process.exitCode = 1;
});
