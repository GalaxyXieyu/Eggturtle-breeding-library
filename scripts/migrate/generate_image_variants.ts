#!/usr/bin/env ts-node
// @ts-nocheck

import { mkdir, writeFile } from 'node:fs/promises';
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

const { PrismaClient } = loadPrismaRuntime();
const { LocalDiskStorageProvider, S3StorageProvider } = loadStorageRuntime();
const { buildWebpVariantKey, resizeToWebpMaxEdge } = loadImageVariantsRuntime();

const VARIANT_SIZES = [320, 640, 1200];

type CliArgs = {
  confirm: boolean;
  tenantSlug?: string;
};

type ItemReport = {
  imageId: string;
  productId: string;
  productCode: string;
  key: string;
  variantsGenerated: number[];
  variantsSkipped: number[];
  status: 'success' | 'would_generate' | 'error';
  reason: string | null;
};

function parseArgs(argv: string[]): CliArgs {
  let confirm = false;
  let tenantSlug: string | undefined;

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

  return {
    confirm,
    tenantSlug: tenantSlug?.trim()
  };
}

function printHelpAndExit(code: number): never {
  const lines = [
    'Usage: ts-node scripts/migrate/generate_image_variants.ts [options]',
    '',
    'Generate 320px, 640px, and 1200px WebP variants for existing product images.',
    '',
    'Options:',
    '  --tenant-slug <slug>  Target specific tenant (optional, processes all if omitted)',
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

  // Check if S3 config exists, use S3 even if STORAGE_PROVIDER is not set
  if (process.env.S3_ENDPOINT || process.env.S3_BUCKET) {
    console.info('Detected S3/MinIO configuration, using S3 storage provider');
    return new S3StorageProvider();
  }

  return new LocalDiskStorageProvider();
}

function toTimestampLabel(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date();
  const prisma = new PrismaClient();

  console.info('Generate image variants migration plan:');
  console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
  console.info(`- tenant: ${args.tenantSlug ?? 'ALL'}`);
  console.info(`- variant sizes: ${VARIANT_SIZES.join(', ')}px`);

  try {
    const storageProvider = args.confirm ? createStorageProvider() : null;

    const whereClause: any = {};
    if (args.tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: args.tenantSlug },
        select: { id: true }
      });

      if (!tenant) {
        throw new Error(`Tenant not found for slug: ${args.tenantSlug}`);
      }

      whereClause.tenantId = tenant.id;
    }

    const images = await prisma.productImage.findMany({
      where: whereClause,
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        tenantId: true,
        productId: true,
        key: true,
        product: {
          select: {
            code: true
          }
        }
      }
    });

    const itemReports: ItemReport[] = [];
    let totalVariantsGenerated = 0;
    let totalVariantsSkipped = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const image of images) {
      const variantsGenerated: number[] = [];
      const variantsSkipped: number[] = [];

      try {
        // Check if this is a managed storage key
        const normalizedKey = image.key.replace(/\\/g, '/').replace(/^\/+/, '');
        if (!normalizedKey.startsWith(`${image.tenantId}/`)) {
          itemReports.push({
            imageId: image.id,
            productId: image.productId,
            productCode: image.product.code,
            key: image.key,
            variantsGenerated: [],
            variantsSkipped: [],
            status: 'error',
            reason: 'Not a managed storage key'
          });
          errorCount += 1;
          continue;
        }

        // Get original image
        let originalBuffer: Buffer | null = null;
        if (args.confirm) {
          try {
            const originalObject = await storageProvider.getObject(image.key);
            originalBuffer = originalObject.body;
          } catch (error) {
            itemReports.push({
              imageId: image.id,
              productId: image.productId,
              productCode: image.product.code,
              key: image.key,
              variantsGenerated: [],
              variantsSkipped: [],
              status: 'error',
              reason: `Failed to fetch original: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
            errorCount += 1;
            continue;
          }
        }

        // Generate variants
        for (const maxEdge of VARIANT_SIZES) {
          const variantKey = buildWebpVariantKey(image.key, maxEdge);

          // Check if variant already exists
          if (args.confirm) {
            try {
              await storageProvider.getObject(variantKey);
              variantsSkipped.push(maxEdge);
              totalVariantsSkipped += 1;
              continue;
            } catch (error) {
              // Variant doesn't exist, proceed to generate
            }

            // Generate and upload variant
            try {
              const resized = await resizeToWebpMaxEdge({ body: originalBuffer, maxEdge });
              await storageProvider.putObject({
                key: variantKey,
                body: resized.body,
                contentType: resized.contentType,
                metadata: {
                  tenantId: image.tenantId,
                  productId: image.productId,
                  source: 'migration-generate-variants',
                  originalKey: image.key,
                  maxEdge: String(maxEdge)
                }
              });

              variantsGenerated.push(maxEdge);
              totalVariantsGenerated += 1;
            } catch (error) {
              console.error(`Failed to generate ${maxEdge}px variant for ${image.key}:`, error);
            }
          } else {
            // Dry-run mode
            variantsGenerated.push(maxEdge);
          }
        }

        itemReports.push({
          imageId: image.id,
          productId: image.productId,
          productCode: image.product.code,
          key: image.key,
          variantsGenerated,
          variantsSkipped,
          status: args.confirm ? 'success' : 'would_generate',
          reason: null
        });

        successCount += 1;
      } catch (error) {
        errorCount += 1;
        itemReports.push({
          imageId: image.id,
          productId: image.productId,
          productCode: image.product.code,
          key: image.key,
          variantsGenerated,
          variantsSkipped,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const report = {
      mode: args.confirm ? 'write' : 'dry-run',
      startedAt: startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      tenantSlug: args.tenantSlug ?? 'ALL',
      variantSizes: VARIANT_SIZES,
      summary: {
        totalImages: images.length,
        successCount,
        errorCount,
        totalVariantsGenerated,
        totalVariantsSkipped
      },
      items: itemReports
    };

    const reportPath = resolve('out', `generate_image_variants-${toTimestampLabel(startedAt)}.json`);

    await mkdir(resolve('out'), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.info('Generate variants migration complete');
    console.info(`- total images: ${images.length}`);
    console.info(`- success: ${successCount}`);
    console.info(`- errors: ${errorCount}`);
    console.info(`- variants generated: ${totalVariantsGenerated}`);
    console.info(`- variants skipped (already exist): ${totalVariantsSkipped}`);
    console.info(`- report: ${reportPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Generate variants migration failed');
  console.error(error);
  process.exitCode = 1;
});
