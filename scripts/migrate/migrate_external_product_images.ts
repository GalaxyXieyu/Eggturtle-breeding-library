#!/usr/bin/env ts-node
// @ts-nocheck

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve } from 'node:path';

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

function loadImageVariantsRuntime() {
  try {
    return require('../../apps/api/src/images/image-variants');
  } catch {
    return require('../../apps/api/dist/images/image-variants');
  }
}

const dotenv = loadDotenvRuntime();
const { PrismaClient } = loadPrismaRuntime();
const { LocalDiskStorageProvider, S3StorageProvider } = loadStorageRuntime();
const { buildWebpVariantKey, resizeToWebpMaxEdge } = loadImageVariantsRuntime();

const VARIANT_SIZES = [320, 640, 1200];
const IMAGE_CONTENT_TYPE_TO_EXTENSION = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg'
};

for (const file of [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/api/.env'),
  resolve(process.cwd(), 'apps/api/.env.local')
]) {
  dotenv.config({ path: file, override: false });
}

function normalizeContentType(value) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const [mainType] = normalized.split(';');
  return mainType?.trim() || null;
}

function inferExtensionFromContentType(contentType) {
  const normalized = normalizeContentType(contentType);
  if (!normalized) return null;
  return IMAGE_CONTENT_TYPE_TO_EXTENSION[normalized] ?? null;
}

function normalizeExtension(value) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const extension = normalized.startsWith('.') ? normalized : `.${normalized}`;
  return /^\.[a-z0-9]+$/.test(extension) ? extension : null;
}

function inferExtensionFromUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return normalizeExtension(extname(parsed.pathname));
  } catch {
    return normalizeExtension(extname(url));
  }
}

function chooseManagedImageExtension({ url, contentType, downloadedContentType }) {
  return (
    inferExtensionFromContentType(downloadedContentType) ||
    inferExtensionFromContentType(contentType) ||
    inferExtensionFromUrl(url) ||
    '.img'
  );
}

function buildManagedImageKey(tenantId, productId, imageId, extension) {
  return `${tenantId}/products/${productId}/${imageId}${extension}`;
}

function isManagedStorageKey(tenantId, key) {
  const normalized = String(key || '').replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized.startsWith(`${tenantId}/`);
}

function isHttpUrl(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized.startsWith('http://') || normalized.startsWith('https://');
}

function parsePositiveInt(raw, flag) {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return value;
}

function parseArgs(argv) {
  let confirm = false;
  let tenantSlug;
  let productId;
  let imageId;
  let onlyMain = false;
  let limit;
  let concurrency = 4;
  let timeoutMs = 20000;
  let skipVariants = false;
  let selfHealManaged = false;

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
    if (arg === '--product-id') {
      productId = argv[++i];
      if (!productId) throw new Error('--product-id requires a value.');
      continue;
    }
    if (arg === '--image-id') {
      imageId = argv[++i];
      if (!imageId) throw new Error('--image-id requires a value.');
      continue;
    }
    if (arg === '--only-main') {
      onlyMain = true;
      continue;
    }
    if (arg === '--limit') {
      limit = parsePositiveInt(argv[++i], '--limit');
      continue;
    }
    if (arg === '--concurrency') {
      concurrency = parsePositiveInt(argv[++i], '--concurrency');
      continue;
    }
    if (arg === '--timeout-ms') {
      timeoutMs = parsePositiveInt(argv[++i], '--timeout-ms');
      continue;
    }
    if (arg === '--skip-variants') {
      skipVariants = true;
      continue;
    }
    if (arg === '--self-heal-managed') {
      selfHealManaged = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      const help = [
        'Usage: ts-node scripts/migrate/migrate_external_product_images.ts [options]',
        '',
        'Download legacy external product images into managed storage and update product_images rows.',
        'Default mode is dry-run; add --confirm to execute writes.',
        '',
        'Options:',
        '  --tenant-slug <slug>     Only process one tenant',
        '  --product-id <id>        Only process one product',
        '  --image-id <id>          Only process one product image row',
        '  --only-main              Only process main images',
        '  --limit <n>              Limit candidate count',
        '  --concurrency <n>        Parallel workers (default 4)',
        '  --timeout-ms <n>         Per-image download timeout in ms (default 20000)',
        '  --skip-variants          Do not generate 320/640/1200 variants',
        '  --self-heal-managed      Also re-download managed rows with http urls into current storage provider',
        '  --confirm                Execute writes'
      ].join('\n');
      console.info(help);
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    confirm,
    tenantSlug,
    productId,
    imageId,
    onlyMain,
    limit,
    concurrency,
    timeoutMs,
    skipVariants,
    selfHealManaged
  };
}

function createStorageProvider() {
  const provider = (process.env.STORAGE_PROVIDER ?? 'local').trim().toLowerCase();
  if (provider === 's3') return new S3StorageProvider();
  return new LocalDiskStorageProvider();
}

function isStorageObjectMissingError(error) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error;
  if (candidate.status === 404 || candidate.statusCode === 404 || candidate.response?.statusCode === 404) {
    return true;
  }
  const tag = `${candidate.name ?? ''} ${candidate.message ?? ''}`.toLowerCase();
  return tag.includes('not found') || tag.includes('nosuchkey');
}

async function storageObjectExists(storageProvider, key) {
  try {
    await storageProvider.getObject(key);
    return true;
  } catch (error) {
    if (isStorageObjectMissingError(error)) return false;
    throw error;
  }
}

async function downloadImageBinary(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }
    const contentType = normalizeContentType(response.headers.get('content-type'));
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`Unsupported content-type: ${contentType ?? '<empty>'}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error('Downloaded image is empty.');
    }
    return { body: Buffer.from(arrayBuffer), contentType };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Download timeout after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  if (items.length === 0) return;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;
  const runners = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function toTimestampLabel(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const startedAt = new Date();
  const reportDir = resolve(process.cwd(), 'out/migration-reports');

  console.info('External product image migration plan:');
  console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
  console.info(`- tenant: ${args.tenantSlug ?? 'ALL'}`);
  console.info(`- productId: ${args.productId ?? 'ANY'}`);
  console.info(`- imageId: ${args.imageId ?? 'ANY'}`);
  console.info(`- onlyMain: ${args.onlyMain ? 'yes' : 'no'}`);
  console.info(`- limit: ${args.limit ?? 'ALL'}`);
  console.info(`- concurrency: ${args.concurrency}`);
  console.info(`- timeoutMs: ${args.timeoutMs}`);
  console.info(`- variants: ${args.skipVariants ? 'skip' : VARIANT_SIZES.join(', ')}px`);
  console.info(`- selfHealManaged: ${args.selfHealManaged ? 'yes' : 'no'}`);

  try {
    let tenantId;
    if (args.tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: args.tenantSlug }, select: { id: true } });
      if (!tenant) throw new Error(`Tenant not found for slug: ${args.tenantSlug}`);
      tenantId = tenant.id;
    }

    const whereClause = {};
    if (tenantId) whereClause.tenantId = tenantId;
    if (args.productId) whereClause.productId = args.productId;
    if (args.imageId) whereClause.id = args.imageId;
    if (args.onlyMain) whereClause.isMain = true;

    const rows = await prisma.productImage.findMany({
      where: whereClause,
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        tenantId: true,
        productId: true,
        key: true,
        url: true,
        contentType: true,
        sizeBytes: true,
        isMain: true,
        product: { select: { code: true } }
      }
    });

    const tenantIds = Array.from(new Set(rows.map((row) => row.tenantId)));
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, slug: true }
    });
    const tenantSlugById = new Map(tenants.map((tenant) => [tenant.id, tenant.slug]));

    const externalHttpCandidates = rows.filter(
      (row) => !isManagedStorageKey(row.tenantId, row.key) && isHttpUrl(row.url)
    );
    const selfHealManagedCandidates = args.selfHealManaged
      ? rows.filter((row) => isManagedStorageKey(row.tenantId, row.key) && isHttpUrl(row.url))
      : [];
    const candidates = [...externalHttpCandidates, ...selfHealManagedCandidates];
    const slicedCandidates = args.limit ? candidates.slice(0, args.limit) : candidates;

    console.info(`- scanned rows: ${rows.length}`);
    console.info(`- external/http candidates: ${externalHttpCandidates.length}`);
    console.info(`- self-heal managed candidates: ${selfHealManagedCandidates.length}`);
    console.info(`- processing rows: ${slicedCandidates.length}`);

    if (slicedCandidates.length === 0) {
      console.info('No external image rows matched the filters.');
      return;
    }

    const storageProvider = args.confirm ? createStorageProvider() : null;
    const items = [];
    let migratedCount = 0;
    let wouldMigrateCount = 0;
    let errorCount = 0;
    let variantGeneratedCount = 0;
    let variantSkippedCount = 0;

    await mapWithConcurrency(slicedCandidates, args.concurrency, async (row) => {
      const base = {
        imageId: row.id,
        tenantId: row.tenantId,
        tenantSlug: tenantSlugById.get(row.tenantId) ?? null,
        productId: row.productId,
        productCode: row.product?.code ?? null,
        isMain: Boolean(row.isMain),
        oldKey: row.key,
        newKey: null,
        sourceUrl: row.url ?? null,
        contentType: normalizeContentType(row.contentType),
        sizeBytes: row.sizeBytes?.toString?.() ?? null,
        status: 'skipped',
        reason: null,
        variantsGenerated: [],
        variantsSkipped: []
      };

      try {
        const plannedExtension = chooseManagedImageExtension({ url: row.url, contentType: row.contentType });
        const managedKey = buildManagedImageKey(row.tenantId, row.productId, row.id, plannedExtension);
        base.newKey = managedKey;

        if (!args.confirm) {
          base.status = 'would_migrate';
          base.reason = 'dry-run';
          items.push(base);
          wouldMigrateCount += 1;
          return;
        }

        const downloaded = await downloadImageBinary(row.url, args.timeoutMs);
        const finalExtension = chooseManagedImageExtension({
          url: row.url,
          contentType: row.contentType,
          downloadedContentType: downloaded.contentType
        });
        const finalManagedKey = buildManagedImageKey(row.tenantId, row.productId, row.id, finalExtension);
        base.newKey = finalManagedKey;

        const targetExists = await storageObjectExists(storageProvider, finalManagedKey);
        if (!targetExists) {
          await storageProvider.putObject({
            key: finalManagedKey,
            body: downloaded.body,
            contentType: downloaded.contentType,
            metadata: {
              source: 'migration-external-product-images',
              oldKey: row.key,
              sourceUrl: row.url,
              productImageId: row.id,
              productId: row.productId,
              tenantId: row.tenantId
            }
          });
        }

        if (!args.skipVariants) {
          for (const maxEdge of VARIANT_SIZES) {
            const variantKey = buildWebpVariantKey(finalManagedKey, maxEdge);
            const variantExists = await storageObjectExists(storageProvider, variantKey);
            if (variantExists) {
              base.variantsSkipped.push(maxEdge);
              variantSkippedCount += 1;
              continue;
            }
            const resized = await resizeToWebpMaxEdge({ body: downloaded.body, maxEdge });
            await storageProvider.putObject({
              key: variantKey,
              body: resized.body,
              contentType: resized.contentType,
              metadata: {
                source: 'migration-external-product-images.variant',
                originalKey: finalManagedKey,
                productImageId: row.id,
                productId: row.productId,
                tenantId: row.tenantId,
                maxEdge: String(maxEdge)
              }
            });
            base.variantsGenerated.push(maxEdge);
            variantGeneratedCount += 1;
          }
        }

        const signedUrl = await storageProvider.getSignedUrl(finalManagedKey);
        await prisma.productImage.update({
          where: { id: row.id },
          data: {
            key: finalManagedKey,
            url: signedUrl,
            contentType: downloaded.contentType,
            sizeBytes: BigInt(downloaded.body.length)
          }
        });

        base.contentType = downloaded.contentType;
        base.sizeBytes = String(downloaded.body.length);
        base.status = 'migrated';
        base.reason = targetExists ? 'managed object already existed; db row updated' : null;
        items.push(base);
        migratedCount += 1;
      } catch (error) {
        base.status = 'error';
        base.reason = error instanceof Error ? error.message : String(error);
        items.push(base);
        errorCount += 1;
      }
    });

    await mkdir(reportDir, { recursive: true });
    const reportPath = resolve(reportDir, `external-product-images-${toTimestampLabel(startedAt)}.json`);
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          startedAt: startedAt.toISOString(),
          finishedAt: new Date().toISOString(),
          args,
          summary: {
            scannedRows: rows.length,
            externalHttpCandidates: externalHttpCandidates.length,
            selfHealManagedCandidates: selfHealManagedCandidates.length,
            processedRows: slicedCandidates.length,
            migratedCount,
            wouldMigrateCount,
            errorCount,
            variantGeneratedCount,
            variantSkippedCount
          },
          items
        },
        null,
        2
      ),
      'utf8'
    );

    console.info('Done.');
    console.info(`- migrated: ${migratedCount}`);
    console.info(`- would migrate: ${wouldMigrateCount}`);
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
