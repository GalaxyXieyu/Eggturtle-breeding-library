#!/usr/bin/env ts-node
// @ts-nocheck

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, resolve } from 'node:path';

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
const PLACEHOLDER_CONTENT_TYPE = 'image/jpeg';
const PLACEHOLDER_PATHS = [
  '/Volumes/DATABASE/code/turtle_album/backend/static/images/mg_01.jpg',
  '/Volumes/DATABASE/code/turtle_album/backend/static/images/mg_02.jpg',
  '/Volumes/DATABASE/code/turtle_album/backend/static/images/mg_03.jpg',
  '/Volumes/DATABASE/code/turtle_album/backend/static/images/mg_04.jpg',
  '/Volumes/DATABASE/code/turtle_album/backend/static/images/mg_05.jpg'
];

type CliArgs = {
  confirm: boolean;
  tenantSlug: string;
};

type PlaceholderAsset = {
  path: string;
  fileName: string;
  body: Buffer;
};

type ItemReport = {
  productCode: string;
  productId: string;
  imageId: string;
  key: string;
  placeholderFile: string;
  createdImageRow: boolean;
  deletedImageRows: number;
  status: 'seeded' | 'would_seed' | 'error';
  reason: string | null;
};

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
    'Usage: ts-node scripts/migrate/seed_placeholder_images_to_storage.ts [options]',
    '',
    'Options:',
    `  --tenant-slug <slug>  Target tenant slug (default: ${DEFAULT_TENANT_SLUG})`,
    '  --confirm             Execute write operations (default is dry-run)',
    '  -h, --help            Show help'
  ];

  const text = lines.join('\n');
  if (code === 0) {
    console.info(text);
  } else {
    console.error(text);
  }

  process.exit(code);
}

function createStorageProvider() {
  const provider = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();
  if (provider === 's3') {
    return new S3StorageProvider();
  }

  return new LocalDiskStorageProvider();
}

function buildManagedKey(tenantId: string, productId: string, imageId: string): string {
  return `${tenantId}/products/${productId}/placeholder-${imageId}.jpg`;
}

function buildApiImagePath(productId: string, imageId: string): string {
  return `/products/${productId}/images/${imageId}/content`;
}

function pickPlaceholderAsset(placeholders: PlaceholderAsset[], seed: string): PlaceholderAsset {
  const digest = createHash('sha1').update(seed).digest();
  const index = digest[0] % placeholders.length;
  return placeholders[index];
}

async function loadPlaceholderAssets(): Promise<PlaceholderAsset[]> {
  const assets: PlaceholderAsset[] = [];

  for (const imagePath of PLACEHOLDER_PATHS) {
    const body = await readFile(imagePath);
    assets.push({
      path: imagePath,
      fileName: basename(imagePath),
      body
    });
  }

  return assets;
}

function toTimestampLabel(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date();
  const prisma = new PrismaClient();

  console.info('Seed placeholder image migration plan:');
  console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
  console.info(`- tenant slug: ${args.tenantSlug}`);

  try {
    const placeholders = await loadPlaceholderAssets();
    const storageProvider = args.confirm ? createStorageProvider() : null;

    const tenant = await prisma.tenant.findUnique({
      where: { slug: args.tenantSlug },
      select: { id: true, slug: true, name: true }
    });

    if (!tenant) {
      throw new Error(`Tenant not found for slug: ${args.tenantSlug}`);
    }

    const products = await prisma.product.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ code: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        code: true,
        images: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true
          }
        }
      }
    });

    const itemReports: ItemReport[] = [];
    let createdImageRows = 0;
    let deletedImageRows = 0;
    let seededProducts = 0;
    let erroredProducts = 0;

    for (const product of products) {
      const productSeed = product.code?.trim() || product.id;
      const placeholder = pickPlaceholderAsset(placeholders, productSeed);
      const retainedImage = product.images[0] ?? null;
      const removableImageIds = product.images.slice(1).map((image) => image.id);

      let imageId = retainedImage?.id ?? '<to-be-created>';
      let key =
        retainedImage?.id != null
          ? buildManagedKey(tenant.id, product.id, retainedImage.id)
          : `${tenant.id}/products/${product.id}/placeholder-<to-be-created>.jpg`;

      try {
        if (args.confirm) {
          let createdImageId: string | null = null;

          if (!retainedImage) {
            const created = await prisma.productImage.create({
              data: {
                tenantId: tenant.id,
                productId: product.id,
                key: `${tenant.id}/products/${product.id}/placeholder-pending.jpg`,
                url: '/placeholder-pending',
                contentType: PLACEHOLDER_CONTENT_TYPE,
                sortOrder: 0,
                isMain: true
              },
              select: { id: true }
            });

            createdImageId = created.id;
            imageId = created.id;
            key = buildManagedKey(tenant.id, product.id, imageId);
          }

          const apiUrl = buildApiImagePath(product.id, imageId);

          try {
            await storageProvider.putObject({
              key,
              body: placeholder.body,
              contentType: PLACEHOLDER_CONTENT_TYPE
            });

            await prisma.$transaction(async (tx) => {
              await tx.productImage.update({
                where: { id: imageId },
                data: {
                  key,
                  url: apiUrl,
                  contentType: PLACEHOLDER_CONTENT_TYPE,
                  sortOrder: 0,
                  isMain: true
                }
              });

              if (removableImageIds.length > 0) {
                await tx.productImage.deleteMany({
                  where: {
                    id: { in: removableImageIds }
                  }
                });
              }
            });
          } catch (error) {
            await storageProvider.deleteObject(key).catch(() => undefined);

            if (createdImageId) {
              await prisma.productImage.delete({ where: { id: createdImageId } }).catch(() => undefined);
            }

            throw error;
          }
        }

        itemReports.push({
          productCode: product.code,
          productId: product.id,
          imageId,
          key,
          placeholderFile: placeholder.fileName,
          createdImageRow: !retainedImage,
          deletedImageRows: removableImageIds.length,
          status: args.confirm ? 'seeded' : 'would_seed',
          reason: null
        });

        createdImageRows += retainedImage ? 0 : 1;
        deletedImageRows += removableImageIds.length;
        seededProducts += 1;
      } catch (error) {
        erroredProducts += 1;
        itemReports.push({
          productCode: product.code,
          productId: product.id,
          imageId,
          key,
          placeholderFile: placeholder.fileName,
          createdImageRow: !retainedImage,
          deletedImageRows: removableImageIds.length,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown placeholder seed error.'
        });
      }
    }

    const report = {
      mode: args.confirm ? 'write' : 'dry-run',
      startedAt: startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      tenant,
      placeholders: placeholders.map((asset) => ({
        fileName: asset.fileName,
        path: asset.path,
        bytes: asset.body.length
      })),
      summary: {
        productCount: products.length,
        seededProducts,
        erroredProducts,
        createdImageRows,
        deletedImageRows
      },
      items: itemReports
    };

    const reportPath = resolve('out', `seed_placeholder_images_to_storage-${toTimestampLabel(startedAt)}.json`);

    await mkdir(resolve('out'), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.info('Seed migration complete');
    console.info(`- products: ${products.length}`);
    console.info(`- seeded products: ${seededProducts}`);
    console.info(`- errored products: ${erroredProducts}`);
    console.info(`- created image rows: ${createdImageRows}`);
    console.info(`- deleted image rows: ${deletedImageRows}`);
    console.info(`- report: ${reportPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed placeholder migration failed');
  console.error(error);
  process.exitCode = 1;
});
