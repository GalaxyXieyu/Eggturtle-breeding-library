#!/usr/bin/env ts-node
// @ts-nocheck

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve } from 'node:path';

const require = createRequire(import.meta.url);

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

const { PrismaClient } = loadPrismaRuntime();
const { LocalDiskStorageProvider, S3StorageProvider } = loadStorageRuntime();

const DEFAULT_TENANT_SLUG = 'turtle-album';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type CliArgs = {
  confirm: boolean;
  tenantSlug: string;
};

type MigrationStatus =
  | 'migrated'
  | 'would_migrate'
  | 'skipped_missing_url'
  | 'skipped_missing_http_url'
  | 'skipped_http_404'
  | 'skipped_http_error'
  | 'skipped_non_image'
  | 'skipped_too_large'
  | 'skipped_invalid_url'
  | 'error';

type ItemReport = {
  imageId: string;
  productId: string;
  previousKey: string;
  nextKey: string | null;
  previousUrl: string;
  nextUrl: string | null;
  status: MigrationStatus;
  reason: string | null;
  contentType: string | null;
  sizeBytes: number | null;
};

type DownloadResult =
  | {
      ok: true;
      body: Buffer;
      contentType: string;
      sizeBytes: number;
    }
  | {
      ok: false;
      status: MigrationStatus;
      reason: string;
    };

class ResponseTooLargeError extends Error {}

function parseArgs(argv: string[]): CliArgs {
  let confirm = false;
  let tenantSlug = DEFAULT_TENANT_SLUG;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--confirm') {
      confirm = true;
      continue;
    }

    if (arg === '--tenant-slug') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--tenant-slug requires a value.');
      }
      tenantSlug = value;
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

  return {
    confirm,
    tenantSlug: tenantSlug.trim()
  };
}

function printHelpAndExit(code: number): never {
  const lines = [
    'Usage: ts-node scripts/migrate/mirror_external_images_to_storage.ts [options]',
    '',
    'Options:',
    `  --tenant-slug <slug>  Target tenant slug (default: ${DEFAULT_TENANT_SLUG})`,
    '  --confirm             Execute write operations (default is dry-run)',
    '  -h, --help            Show help'
  ];

  if (code === 0) {
    console.info(lines.join('\n'));
  } else {
    console.error(lines.join('\n'));
  }

  process.exit(code);
}

function normalizeKey(rawKey: string): string {
  return rawKey.replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

function isManagedStorageKey(tenantId: string, key: string): boolean {
  return normalizeKey(key).startsWith(`${tenantId}/`);
}

function shouldMigrateImage(tenantId: string, key: string): boolean {
  const normalized = normalizeKey(key);
  return normalized.startsWith('external/') || !isManagedStorageKey(tenantId, normalized);
}

function buildManagedKey(tenantId: string, productId: string, imageId: string, extension: string): string {
  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`;
  return `${tenantId}/products/${productId}/imported-${imageId}${normalizedExtension}`;
}

function buildApiImagePath(productId: string, imageId: string): string {
  return `/products/${productId}/images/${imageId}/content`;
}

function extensionFromContentType(contentType: string): string {
  const normalized = contentType.toLowerCase();
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'image/svg+xml': '.svg',
    'image/avif': '.avif',
    'image/heic': '.heic'
  };

  return map[normalized] ?? '';
}

function extensionFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const extension = extname(parsed.pathname).toLowerCase();
    if (!extension) {
      return '';
    }

    if (/^\.[a-z0-9]{1,8}$/.test(extension)) {
      return extension;
    }

    return '';
  } catch {
    return '';
  }
}

function inferExtension(contentType: string, sourceUrl: string): string {
  const fromContentType = extensionFromContentType(contentType);
  if (fromContentType) {
    return fromContentType;
  }

  const fromUrl = extensionFromUrl(sourceUrl);
  if (fromUrl) {
    return fromUrl;
  }

  return '.img';
}

function createStorageProvider() {
  const provider = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();
  if (provider === 's3') {
    return new S3StorageProvider();
  }

  return new LocalDiskStorageProvider();
}

async function downloadImage(url: string): Promise<DownloadResult> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    return {
      ok: false,
      status: 'skipped_http_error',
      reason: error instanceof Error ? error.message : 'Failed to fetch image URL.'
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      status: 'skipped_http_404',
      reason: 'Source returned 404.'
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 'skipped_http_error',
      reason: `Source returned HTTP ${response.status}.`
    };
  }

  const contentTypeHeader = response.headers.get('content-type') ?? '';
  const normalizedContentType = contentTypeHeader.split(';')[0].trim().toLowerCase();

  if (!normalizedContentType.startsWith('image/')) {
    return {
      ok: false,
      status: 'skipped_non_image',
      reason: `Unsupported content-type: ${contentTypeHeader || 'unknown'}.`
    };
  }

  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        status: 'skipped_too_large',
        reason: `Content-Length ${contentLength} exceeds ${MAX_IMAGE_BYTES} bytes.`
      };
    }
  }

  if (!response.body) {
    return {
      ok: false,
      status: 'skipped_http_error',
      reason: 'Response body is empty.'
    };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const next = await reader.read();
      if (next.done) {
        break;
      }

      total += next.value.length;
      if (total > MAX_IMAGE_BYTES) {
        throw new ResponseTooLargeError(`Image exceeds ${MAX_IMAGE_BYTES} bytes.`);
      }

      chunks.push(next.value);
    }
  } catch (error) {
    if (error instanceof ResponseTooLargeError) {
      return {
        ok: false,
        status: 'skipped_too_large',
        reason: error.message
      };
    }

    return {
      ok: false,
      status: 'skipped_http_error',
      reason: error instanceof Error ? error.message : 'Failed to read image response stream.'
    };
  } finally {
    reader.releaseLock();
  }

  return {
    ok: true,
    body: Buffer.from(Buffer.concat(chunks)),
    contentType: normalizedContentType,
    sizeBytes: total
  };
}

function toTimestampLabel(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date();
  const prisma = new PrismaClient();

  console.info('Mirror external image migration plan:');
  console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
  console.info(`- tenant slug: ${args.tenantSlug}`);
  console.info(`- max image size: ${MAX_IMAGE_BYTES} bytes`);

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: args.tenantSlug },
      select: { id: true, slug: true, name: true }
    });

    if (!tenant) {
      throw new Error(`Tenant not found for slug: ${args.tenantSlug}`);
    }

    const images = await prisma.productImage.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        tenantId: true,
        productId: true,
        key: true,
        url: true,
        contentType: true
      }
    });

    const candidates = images.filter((image) => shouldMigrateImage(tenant.id, image.key));
    console.info(`- tenant id: ${tenant.id}`);
    console.info(`- product images scanned: ${images.length}`);
    console.info(`- migration candidates: ${candidates.length}`);

    const storageProvider = args.confirm ? createStorageProvider() : null;
    const itemReports: ItemReport[] = [];

    for (const image of candidates) {
      const previousKey = image.key;
      const previousUrl = image.url?.trim() ?? '';

      if (!previousUrl) {
        itemReports.push({
          imageId: image.id,
          productId: image.productId,
          previousKey,
          nextKey: null,
          previousUrl,
          nextUrl: null,
          status: 'skipped_missing_url',
          reason: 'Source URL is empty.',
          contentType: null,
          sizeBytes: null
        });
        continue;
      }

      let sourceUrl: URL;
      try {
        sourceUrl = new URL(previousUrl);
      } catch {
        itemReports.push({
          imageId: image.id,
          productId: image.productId,
          previousKey,
          nextKey: null,
          previousUrl,
          nextUrl: null,
          status: 'skipped_invalid_url',
          reason: 'Source URL is not a valid URL.',
          contentType: null,
          sizeBytes: null
        });
        continue;
      }

      if (sourceUrl.protocol !== 'http:' && sourceUrl.protocol !== 'https:') {
        itemReports.push({
          imageId: image.id,
          productId: image.productId,
          previousKey,
          nextKey: null,
          previousUrl,
          nextUrl: null,
          status: 'skipped_missing_http_url',
          reason: `Unsupported protocol: ${sourceUrl.protocol}`,
          contentType: null,
          sizeBytes: null
        });
        continue;
      }

      const downloaded = await downloadImage(previousUrl);
      if (!downloaded.ok) {
        itemReports.push({
          imageId: image.id,
          productId: image.productId,
          previousKey,
          nextKey: null,
          previousUrl,
          nextUrl: null,
          status: downloaded.status,
          reason: downloaded.reason,
          contentType: null,
          sizeBytes: null
        });
        continue;
      }

      const extension = inferExtension(downloaded.contentType, previousUrl);
      const nextKey = buildManagedKey(tenant.id, image.productId, image.id, extension);
      const nextUrl = buildApiImagePath(image.productId, image.id);

      try {
        if (args.confirm) {
          await storageProvider.putObject({
            key: nextKey,
            body: downloaded.body,
            contentType: downloaded.contentType
          });

          await prisma.productImage.update({
            where: { id: image.id },
            data: {
              key: nextKey,
              contentType: downloaded.contentType,
              url: nextUrl
            }
          });
        }

        itemReports.push({
          imageId: image.id,
          productId: image.productId,
          previousKey,
          nextKey,
          previousUrl,
          nextUrl,
          status: args.confirm ? 'migrated' : 'would_migrate',
          reason: null,
          contentType: downloaded.contentType,
          sizeBytes: downloaded.sizeBytes
        });
      } catch (error) {
        itemReports.push({
          imageId: image.id,
          productId: image.productId,
          previousKey,
          nextKey,
          previousUrl,
          nextUrl,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown migration error.',
          contentType: downloaded.contentType,
          sizeBytes: downloaded.sizeBytes
        });
      }
    }

    const summary = itemReports.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.status] = (accumulator[item.status] ?? 0) + 1;
      return accumulator;
    }, {});

    const endedAt = new Date();
    const report = {
      mode: args.confirm ? 'write' : 'dry-run',
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name
      },
      limits: {
        maxImageBytes: MAX_IMAGE_BYTES
      },
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      scannedCount: images.length,
      candidateCount: candidates.length,
      processedCount: itemReports.length,
      summary,
      items: itemReports
    };

    const reportName = `mirror_external_images_to_storage-${toTimestampLabel(startedAt)}.json`;
    const reportPath = resolve('out', reportName);

    await mkdir(resolve('out'), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.info('Migration complete');
    console.info(`- report: ${reportPath}`);
    for (const [status, count] of Object.entries(summary).sort()) {
      console.info(`- ${status}: ${count}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Mirror migration failed');
  console.error(error);
  process.exitCode = 1;
});
