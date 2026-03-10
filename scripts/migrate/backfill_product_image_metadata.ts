#!/usr/bin/env ts-node
// @ts-nocheck

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadDotenvRuntime() {
  try {
    return require('dotenv');
  } catch {
    return require('../../apps/api/node_modules/dotenv');
  }
}

function loadPrismaRuntime() {
  try {
    return require('@prisma/client');
  } catch {
    return require('../../apps/api/node_modules/@prisma/client');
  }
}

function loadStorageRuntime() {
  try {
    return {
      LocalDiskStorageProvider: require('../../apps/api/src/storage/local-disk-storage.provider')
        .LocalDiskStorageProvider,
      S3StorageProvider: require('../../apps/api/src/storage/s3-storage.provider').S3StorageProvider
    };
  } catch {
    return {
      LocalDiskStorageProvider: require('../../apps/api/dist/storage/local-disk-storage.provider')
        .LocalDiskStorageProvider,
      S3StorageProvider: require('../../apps/api/dist/storage/s3-storage.provider').S3StorageProvider
    };
  }
}

const dotenv = loadDotenvRuntime();
const { PrismaClient } = loadPrismaRuntime();
const { LocalDiskStorageProvider, S3StorageProvider } = loadStorageRuntime();

for (const file of [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/api/.env'),
  resolve(process.cwd(), 'apps/api/.env.local')
]) {
  dotenv.config({ path: file, override: false });
}

function parseArgs(argv) {
  let confirm = false;
  let tenantSlug;
  let onlyZeroSize = false;
  let limit;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--confirm') {
      confirm = true;
      continue;
    }
    if (arg === '--tenant-slug') {
      tenantSlug = argv[++i];
      if (!tenantSlug) throw new Error('--tenant-slug requires a value.');
      continue;
    }
    if (arg === '--only-zero-size') {
      onlyZeroSize = true;
      continue;
    }
    if (arg === '--limit') {
      const raw = argv[++i];
      if (!raw) throw new Error('--limit requires a value.');
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('--limit must be a positive integer.');
      limit = parsed;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      const help = [
        'Usage: ts-node scripts/migrate/backfill_product_image_metadata.ts [options]',
        '',
        'Re-read managed product image binaries from current storage provider and backfill metadata.',
        'Default mode is dry-run; add --confirm to execute updates.',
        '',
        'Options:',
        '  --tenant-slug <slug>   Filter by tenant',
        '  --only-zero-size       Only process rows with size_bytes=0',
        '  --limit <n>            Limit candidate count',
        '  --confirm              Execute updates'
      ].join('\n');
      console.info(help);
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { confirm, tenantSlug, onlyZeroSize, limit };
}

function createStorageProvider() {
  const provider = (process.env.STORAGE_PROVIDER ?? 'local').trim().toLowerCase();
  if (provider === 's3') return new S3StorageProvider();
  return new LocalDiskStorageProvider();
}

function isManagedStorageKey(tenantId, key) {
  const normalized = String(key || '').replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized.startsWith(`${tenantId}/`);
}

function toTimestampLabel(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const storageProvider = createStorageProvider();
  const reportDir = resolve(process.cwd(), 'out/migration-reports');
  const startedAt = new Date();

  console.info('Backfill product image metadata plan:');
  console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
  console.info(`- tenant: ${args.tenantSlug ?? 'ALL'}`);
  console.info(`- onlyZeroSize: ${args.onlyZeroSize ? 'yes' : 'no'}`);
  console.info(`- limit: ${args.limit ?? 'ALL'}`);

  try {
    let tenantId;
    if (args.tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: args.tenantSlug }, select: { id: true } });
      if (!tenant) throw new Error(`Tenant not found for slug: ${args.tenantSlug}`);
      tenantId = tenant.id;
    }

    const whereClause = {};
    if (tenantId) whereClause.tenantId = tenantId;
    if (args.onlyZeroSize) whereClause.sizeBytes = BigInt(0);

    const rows = await prisma.productImage.findMany({
      where: whereClause,
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        tenantId: true,
        productId: true,
        key: true,
        contentType: true,
        sizeBytes: true,
        product: { select: { code: true } }
      }
    });

    const tenantIds = Array.from(new Set(rows.map((row) => row.tenantId)));
    const tenants = await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, slug: true } });
    const tenantSlugById = new Map(tenants.map((tenant) => [tenant.id, tenant.slug]));

    const candidates = rows.filter((row) => isManagedStorageKey(row.tenantId, row.key));
    const sliced = args.limit ? candidates.slice(0, args.limit) : candidates;

    console.info(`- scanned rows: ${rows.length}`);
    console.info(`- managed candidates: ${candidates.length}`);
    console.info(`- processing rows: ${sliced.length}`);

    const items = [];
    let updatedCount = 0;
    let wouldUpdateCount = 0;
    let errorCount = 0;

    for (const row of sliced) {
      const item = {
        imageId: row.id,
        tenantId: row.tenantId,
        tenantSlug: tenantSlugById.get(row.tenantId) ?? null,
        productId: row.productId,
        productCode: row.product?.code ?? null,
        key: row.key,
        oldContentType: row.contentType ?? null,
        newContentType: row.contentType ?? null,
        oldSizeBytes: row.sizeBytes.toString(),
        newSizeBytes: null,
        status: 'would_update',
        reason: null
      };

      try {
        const object = await storageProvider.getObject(row.key);
        const nextSize = String(object.body.length);
        const nextContentType = object.contentType ?? row.contentType ?? null;
        item.newSizeBytes = nextSize;
        item.newContentType = nextContentType;

        const changed = nextSize !== row.sizeBytes.toString() || (nextContentType ?? null) !== (row.contentType ?? null);
        if (!changed) {
          item.reason = 'no metadata change';
          items.push(item);
          continue;
        }

        if (!args.confirm) {
          item.reason = 'dry-run';
          items.push(item);
          wouldUpdateCount += 1;
          continue;
        }

        await prisma.productImage.update({
          where: { id: row.id },
          data: {
            sizeBytes: BigInt(nextSize),
            contentType: nextContentType
          }
        });
        item.status = 'updated';
        item.reason = null;
        items.push(item);
        updatedCount += 1;
      } catch (error) {
        item.status = 'error';
        item.reason = error instanceof Error ? error.message : String(error);
        items.push(item);
        errorCount += 1;
      }
    }

    await mkdir(reportDir, { recursive: true });
    const reportPath = resolve(reportDir, `backfill-product-image-metadata-${toTimestampLabel(startedAt)}.json`);
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          startedAt: startedAt.toISOString(),
          finishedAt: new Date().toISOString(),
          args,
          summary: {
            scannedRows: rows.length,
            managedCandidates: candidates.length,
            processedRows: sliced.length,
            updatedCount,
            wouldUpdateCount,
            errorCount
          },
          items
        },
        null,
        2
      ),
      'utf8'
    );

    console.info('Done.');
    console.info(`- updated: ${updatedCount}`);
    console.info(`- would update: ${wouldUpdateCount}`);
    console.info(`- errors: ${errorCount}`);
    console.info(`- report: ${reportPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
