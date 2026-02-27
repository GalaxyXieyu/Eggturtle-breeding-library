#!/usr/bin/env ts-node
// @ts-nocheck

import { createHash } from 'node:crypto';
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
  tenantName: string;
  peerTenantSlug: string;
  peerTenantName: string;
  ownerEmail: string;
  confirm: boolean;
  forceProd: boolean;
};

type SyntheticImageInput = {
  slot: string;
  width: number;
  height: number;
  text: string;
  contentType: string;
};

type SyntheticProductInput = {
  code: string;
  name: string;
  description: string | null;
  images: SyntheticImageInput[];
  featuredSortOrder?: number;
  share?: boolean;
};

type SeedCounters = {
  tenantsCreated: number;
  tenantsUpdated: number;
  membershipsCreated: number;
  membershipsUpdated: number;
  productsCreated: number;
  productsUpdated: number;
  imagesCreated: number;
  imagesUpdated: number;
  imagesDeleted: number;
  featuredCreated: number;
  featuredUpdated: number;
  sharesCreated: number;
  sharesReused: number;
  crossTenantIsolationValidated: boolean;
};

const DEFAULT_TENANT_SLUG = 'ux-sandbox';
const DEFAULT_TENANT_NAME = 'UX Sandbox';
const DEFAULT_PEER_TENANT_SLUG = 'turtle-album';
const DEFAULT_PEER_TENANT_NAME = 'Turtle Album';
const DEFAULT_OWNER_EMAIL = 'owner@uxsandbox.local';
const CROSS_TENANT_CODE = 'UX-CROSS-TENANT-0001';

const LONG_DESCRIPTION = [
  'Synthetic long description fixture for UX regression.',
  'This paragraph intentionally contains enough narrative text to verify truncation, wrapping, and card preview behaviors across list and detail views.',
  'The dataset is deterministic, idempotent, and safe to run repeatedly when combined with tenant scoped upserts.',
  'Use this record to validate markdown rendering fallback, copy controls, and share payload serialization in edge layouts.',
  'Lorem ipsum turtle album breeding scenario text repeated for stable volume coverage.',
  'Lorem ipsum turtle album breeding scenario text repeated for stable volume coverage.',
  'Lorem ipsum turtle album breeding scenario text repeated for stable volume coverage.',
  'Lorem ipsum turtle album breeding scenario text repeated for stable volume coverage.',
  'Lorem ipsum turtle album breeding scenario text repeated for stable volume coverage.',
  'Lorem ipsum turtle album breeding scenario text repeated for stable volume coverage.'
].join(' ');

function parseArgs(argv: string[]): CliArgs {
  let tenantSlug = DEFAULT_TENANT_SLUG;
  let tenantName = DEFAULT_TENANT_NAME;
  let peerTenantSlug = DEFAULT_PEER_TENANT_SLUG;
  let peerTenantName = DEFAULT_PEER_TENANT_NAME;
  let ownerEmail = DEFAULT_OWNER_EMAIL;
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

    if (arg === '--tenant-name') {
      tenantName = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--peer-tenant-slug') {
      peerTenantSlug = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--peer-tenant-name') {
      peerTenantName = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--owner-email') {
      ownerEmail = requireValue(argv, index, arg);
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

  if (!peerTenantSlug.trim()) {
    throw new Error('--peer-tenant-slug cannot be empty.');
  }

  if (!peerTenantName.trim()) {
    throw new Error('--peer-tenant-name cannot be empty.');
  }

  if (!ownerEmail.includes('@')) {
    throw new Error('--owner-email must be a valid email.');
  }

  return {
    tenantSlug: tenantSlug.trim(),
    tenantName: tenantName.trim(),
    peerTenantSlug: peerTenantSlug.trim(),
    peerTenantName: peerTenantName.trim(),
    ownerEmail: ownerEmail.trim().toLowerCase(),
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
    'Usage: ts-node scripts/seed/synthetic_dataset.ts [options]',
    '',
    'Options:',
    `  --tenant-slug <slug>        Primary tenant slug (default: ${DEFAULT_TENANT_SLUG})`,
    `  --tenant-name <name>        Primary tenant name (default: ${DEFAULT_TENANT_NAME})`,
    `  --peer-tenant-slug <slug>   Peer tenant slug for isolation checks (default: ${DEFAULT_PEER_TENANT_SLUG})`,
    `  --peer-tenant-name <name>   Peer tenant name for isolation checks (default: ${DEFAULT_PEER_TENANT_NAME})`,
    `  --owner-email <email>       Owner account email (default: ${DEFAULT_OWNER_EMAIL})`,
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

function sanitizeCodeForPath(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function buildExternalImageUrl(input: SyntheticImageInput): string {
  const text = encodeURIComponent(input.text);
  return `https://placehold.co/${input.width}x${input.height}/1f2937/f9fafb.png?text=${text}`;
}

function buildSyntheticImageKey(tenantSlug: string, productCode: string, slot: string): string {
  const safeCode = sanitizeCodeForPath(productCode);
  const safeSlot = sanitizeCodeForPath(slot);
  return `external/synthetic/${tenantSlug}/${safeCode}/${safeSlot}.png`;
}

function buildShareToken(tenantSlug: string, productCode: string): string {
  const value = `${tenantSlug}:${productCode}`;
  const digest = createHash('sha1').update(value).digest('hex');
  return `syn_${digest.slice(0, 32)}`;
}

function buildPrimaryDataset(): SyntheticProductInput[] {
  return [
    {
      code: 'UX-LONG-DESC-0001',
      name: 'Synthetic Long Description',
      description: LONG_DESCRIPTION,
      images: [
        {
          slot: 'main',
          width: 1200,
          height: 900,
          text: 'UX LONG DESC',
          contentType: 'image/png'
        }
      ],
      featuredSortOrder: 10,
      share: true
    },
    {
      code: 'UX-EMPTY-DESC-0001',
      name: 'Synthetic Empty Description',
      description: '',
      images: [
        {
          slot: 'main',
          width: 1200,
          height: 900,
          text: 'UX EMPTY DESC',
          contentType: 'image/png'
        }
      ]
    },
    {
      code: 'UX-NULL-DESC-0001',
      name: 'Synthetic Null Description',
      description: null,
      images: [
        {
          slot: 'main',
          width: 1200,
          height: 900,
          text: 'UX NULL DESC',
          contentType: 'image/png'
        }
      ]
    },
    {
      code: 'UX-NO-IMAGE-0001',
      name: 'Synthetic No Image',
      description: 'Deliberately has no image rows for empty-state and fallback coverage.',
      images: []
    },
    {
      code: 'UX-MULTI-IMAGE-0001',
      name: 'Synthetic Multiple Images',
      description: 'Contains multiple images for reorder and gallery behavior.',
      images: [
        {
          slot: 'main',
          width: 1200,
          height: 900,
          text: 'UX MULTI MAIN',
          contentType: 'image/png'
        },
        {
          slot: 'detail-1',
          width: 1200,
          height: 900,
          text: 'UX MULTI DETAIL 1',
          contentType: 'image/png'
        },
        {
          slot: 'detail-2',
          width: 1200,
          height: 900,
          text: 'UX MULTI DETAIL 2',
          contentType: 'image/png'
        }
      ],
      featuredSortOrder: 20,
      share: true
    },
    {
      code: 'UX-CODE-NEAR-1000A',
      name: 'Synthetic Near Collision A',
      description: 'Near-collision product code variant A.',
      images: []
    },
    {
      code: 'UX-CODE-NEAR-1000a',
      name: 'Synthetic Near Collision lowercase a',
      description: 'Near-collision product code variant lowercase a.',
      images: []
    },
    {
      code: 'UX-CODE-NEAR-1000-A',
      name: 'Synthetic Near Collision with hyphen',
      description: 'Near-collision product code variant with extra hyphen.',
      images: []
    },
    {
      code: CROSS_TENANT_CODE,
      name: 'Synthetic Cross Tenant Shared Code',
      description: 'Same code also seeded in peer tenant to validate tenant isolation behavior.',
      images: [
        {
          slot: 'main',
          width: 1200,
          height: 900,
          text: 'UX CROSS TENANT',
          contentType: 'image/png'
        }
      ],
      featuredSortOrder: 30,
      share: true
    }
  ];
}

function buildPeerDataset(): SyntheticProductInput[] {
  return [
    {
      code: CROSS_TENANT_CODE,
      name: 'Synthetic Cross Tenant Peer Variant',
      description: 'Peer tenant record sharing the same code to confirm isolation.',
      images: [
        {
          slot: 'main',
          width: 1200,
          height: 900,
          text: 'UX PEER TENANT',
          contentType: 'image/png'
        }
      ],
      share: true
    }
  ];
}

function printPlan(args: CliArgs, databaseUrl: string): void {
  const primaryDataset = buildPrimaryDataset();
  const peerDataset = buildPeerDataset();
  const featuredCount = primaryDataset.filter((item) => typeof item.featuredSortOrder === 'number').length;
  const sharedCount = primaryDataset.filter((item) => item.share).length;

  console.info('Synthetic dataset plan:');
  console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
  console.info(`- database: ${databaseUrl}`);
  console.info(`- owner email: ${args.ownerEmail}`);
  console.info(`- primary tenant: ${args.tenantSlug} (${args.tenantName})`);
  console.info(`- peer tenant: ${args.peerTenantSlug} (${args.peerTenantName})`);
  console.info(`- primary products: ${primaryDataset.length}`);
  console.info(`- peer products: ${peerDataset.length}`);
  console.info(`- featured entries in primary tenant: ${featuredCount}`);
  console.info(`- public shares in primary tenant: ${sharedCount}`);
  console.info(`- cross-tenant isolation code: ${CROSS_TENANT_CODE}`);
}

async function runDryRun(prisma: PrismaClient, args: CliArgs): Promise<void> {
  const primaryDataset = buildPrimaryDataset();
  const peerDataset = buildPeerDataset();

  const primaryTenant = await prisma.tenant.findUnique({
    where: { slug: args.tenantSlug },
    select: { id: true }
  });
  const peerTenant = await prisma.tenant.findUnique({
    where: { slug: args.peerTenantSlug },
    select: { id: true }
  });

  const owner = await prisma.user.findUnique({
    where: { email: args.ownerEmail },
    select: { id: true }
  });

  const existingPrimaryCodes =
    primaryTenant === null
      ? new Set<string>()
      : new Set(
          (
            await prisma.product.findMany({
              where: {
                tenantId: primaryTenant.id,
                code: { in: primaryDataset.map((item) => item.code) }
              },
              select: { code: true }
            })
          ).map((item) => item.code)
        );

  const existingPeerCodes =
    peerTenant === null
      ? new Set<string>()
      : new Set(
          (
            await prisma.product.findMany({
              where: {
                tenantId: peerTenant.id,
                code: { in: peerDataset.map((item) => item.code) }
              },
              select: { code: true }
            })
          ).map((item) => item.code)
        );

  const primaryCreateCount = primaryDataset.filter((item) => !existingPrimaryCodes.has(item.code)).length;
  const primaryUpdateCount = primaryDataset.length - primaryCreateCount;
  const peerCreateCount = peerDataset.filter((item) => !existingPeerCodes.has(item.code)).length;
  const peerUpdateCount = peerDataset.length - peerCreateCount;

  let crossTenantAlreadyVisible = false;
  if (primaryTenant && peerTenant) {
    const rows = await prisma.product.findMany({
      where: {
        code: CROSS_TENANT_CODE,
        tenantId: { in: [primaryTenant.id, peerTenant.id] }
      },
      select: { tenantId: true }
    });
    crossTenantAlreadyVisible = new Set(rows.map((row) => row.tenantId)).size === 2;
  }

  console.info('Dry-run summary:');
  console.info(`- owner exists: ${owner ? 'yes' : 'no'}`);
  console.info(`- primary tenant exists: ${primaryTenant ? 'yes' : 'no'}`);
  console.info(`- peer tenant exists: ${peerTenant ? 'yes' : 'no'}`);
  console.info(`- primary products likely create/update: ${primaryCreateCount}/${primaryUpdateCount}`);
  console.info(`- peer products likely create/update: ${peerCreateCount}/${peerUpdateCount}`);
  console.info(`- cross-tenant code already present in both tenants: ${crossTenantAlreadyVisible ? 'yes' : 'no'}`);
  console.info('No data changed. Re-run with --confirm to write.');
}

async function ensureTenantWithOwner(
  tx: any,
  slug: string,
  name: string,
  ownerUserId: string,
  counters: SeedCounters
): Promise<{ id: string; slug: string; name: string }> {
  const existingTenant = await tx.tenant.findUnique({
    where: { slug },
    select: { id: true }
  });

  const tenant = await tx.tenant.upsert({
    where: { slug },
    update: { name },
    create: {
      slug,
      name
    }
  });

  if (existingTenant) {
    counters.tenantsUpdated += 1;
  } else {
    counters.tenantsCreated += 1;
  }

  const existingMembership = await tx.tenantMember.findUnique({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: ownerUserId
      }
    },
    select: { id: true }
  });

  await tx.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: ownerUserId
      }
    },
    update: { role: TenantMemberRole.OWNER },
    create: {
      tenantId: tenant.id,
      userId: ownerUserId,
      role: TenantMemberRole.OWNER
    }
  });

  if (existingMembership) {
    counters.membershipsUpdated += 1;
  } else {
    counters.membershipsCreated += 1;
  }

  return tenant;
}

async function upsertProductRows(
  tx: any,
  tenantId: string,
  products: SyntheticProductInput[],
  counters: SeedCounters
): Promise<Map<string, { id: string; code: string }>> {
  const productMap = new Map<string, { id: string; code: string }>();

  for (const product of products) {
    const existing = await tx.product.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: product.code
        }
      },
      select: { id: true }
    });

    const upserted = await tx.product.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: product.code
        }
      },
      update: {
        name: product.name,
        description: product.description
      },
      create: {
        tenantId,
        code: product.code,
        name: product.name,
        description: product.description
      },
      select: { id: true, code: true }
    });

    if (existing) {
      counters.productsUpdated += 1;
    } else {
      counters.productsCreated += 1;
    }

    productMap.set(product.code, upserted);
  }

  return productMap;
}

async function syncProductImages(
  tx: any,
  tenantSlug: string,
  tenantId: string,
  productId: string,
  productCode: string,
  images: SyntheticImageInput[],
  counters: SeedCounters
): Promise<void> {
  const desired = images.map((image, index) => ({
    key: buildSyntheticImageKey(tenantSlug, productCode, image.slot),
    url: buildExternalImageUrl(image),
    contentType: image.contentType,
    sortOrder: index,
    isMain: index === 0
  }));

  const existingSyntheticImages = await tx.productImage.findMany({
    where: {
      tenantId,
      productId,
      key: {
        startsWith: 'external/synthetic/'
      }
    },
    select: {
      id: true,
      key: true
    }
  });

  const existingByKey = new Map(existingSyntheticImages.map((image) => [image.key, image]));

  for (const image of desired) {
    const existing = existingByKey.get(image.key);

    if (existing) {
      await tx.productImage.update({
        where: { id: existing.id },
        data: {
          url: image.url,
          contentType: image.contentType,
          sortOrder: image.sortOrder,
          isMain: image.isMain
        }
      });
      counters.imagesUpdated += 1;
      continue;
    }

    await tx.productImage.create({
      data: {
        tenantId,
        productId,
        key: image.key,
        url: image.url,
        contentType: image.contentType,
        sortOrder: image.sortOrder,
        isMain: image.isMain
      }
    });
    counters.imagesCreated += 1;
  }

  const desiredKeys = new Set(desired.map((image) => image.key));
  const staleIds = existingSyntheticImages
    .filter((image) => !desiredKeys.has(image.key))
    .map((image) => image.id);

  if (staleIds.length > 0) {
    const result = await tx.productImage.deleteMany({
      where: {
        id: { in: staleIds }
      }
    });
    counters.imagesDeleted += result.count;
  }
}

async function syncFeaturedEntries(
  tx: any,
  tenantId: string,
  dataset: SyntheticProductInput[],
  productMap: Map<string, { id: string; code: string }>,
  counters: SeedCounters
): Promise<void> {
  for (const product of dataset) {
    if (typeof product.featuredSortOrder !== 'number') {
      continue;
    }

    const seededProduct = productMap.get(product.code);
    if (!seededProduct) {
      continue;
    }

    const existing = await tx.featuredProduct.findUnique({
      where: {
        tenantId_productId: {
          tenantId,
          productId: seededProduct.id
        }
      },
      select: { id: true }
    });

    await tx.featuredProduct.upsert({
      where: {
        tenantId_productId: {
          tenantId,
          productId: seededProduct.id
        }
      },
      update: {
        sortOrder: product.featuredSortOrder
      },
      create: {
        tenantId,
        productId: seededProduct.id,
        sortOrder: product.featuredSortOrder
      }
    });

    if (existing) {
      counters.featuredUpdated += 1;
    } else {
      counters.featuredCreated += 1;
    }
  }
}

async function syncPublicShares(
  tx: any,
  tenantSlug: string,
  tenantId: string,
  ownerUserId: string,
  dataset: SyntheticProductInput[],
  productMap: Map<string, { id: string; code: string }>,
  counters: SeedCounters
): Promise<void> {
  for (const product of dataset) {
    if (!product.share) {
      continue;
    }

    const seededProduct = productMap.get(product.code);
    if (!seededProduct) {
      continue;
    }

    const existing = await tx.publicShare.findUnique({
      where: {
        tenantId_productId: {
          tenantId,
          productId: seededProduct.id
        }
      },
      select: { id: true }
    });

    if (existing) {
      counters.sharesReused += 1;
      continue;
    }

    await tx.publicShare.create({
      data: {
        tenantId,
        productId: seededProduct.id,
        createdByUserId: ownerUserId,
        shareToken: buildShareToken(tenantSlug, product.code)
      }
    });
    counters.sharesCreated += 1;
  }
}

async function runWrite(prisma: PrismaClient, args: CliArgs): Promise<void> {
  const primaryDataset = buildPrimaryDataset();
  const peerDataset = buildPeerDataset();

  const counters: SeedCounters = {
    tenantsCreated: 0,
    tenantsUpdated: 0,
    membershipsCreated: 0,
    membershipsUpdated: 0,
    productsCreated: 0,
    productsUpdated: 0,
    imagesCreated: 0,
    imagesUpdated: 0,
    imagesDeleted: 0,
    featuredCreated: 0,
    featuredUpdated: 0,
    sharesCreated: 0,
    sharesReused: 0,
    crossTenantIsolationValidated: false
  };

  await prisma.$transaction(async (tx) => {
    const owner = await tx.user.upsert({
      where: { email: args.ownerEmail },
      update: { name: 'UX Sandbox Owner' },
      create: {
        email: args.ownerEmail,
        name: 'UX Sandbox Owner'
      }
    });

    const primaryTenant = await ensureTenantWithOwner(
      tx,
      args.tenantSlug,
      args.tenantName,
      owner.id,
      counters
    );
    const peerTenant = await ensureTenantWithOwner(
      tx,
      args.peerTenantSlug,
      args.peerTenantName,
      owner.id,
      counters
    );

    const primaryProducts = await upsertProductRows(tx, primaryTenant.id, primaryDataset, counters);
    const peerProducts = await upsertProductRows(tx, peerTenant.id, peerDataset, counters);

    for (const product of primaryDataset) {
      const seededProduct = primaryProducts.get(product.code);
      if (!seededProduct) {
        continue;
      }

      await syncProductImages(
        tx,
        args.tenantSlug,
        primaryTenant.id,
        seededProduct.id,
        product.code,
        product.images,
        counters
      );
    }

    for (const product of peerDataset) {
      const seededProduct = peerProducts.get(product.code);
      if (!seededProduct) {
        continue;
      }

      await syncProductImages(
        tx,
        args.peerTenantSlug,
        peerTenant.id,
        seededProduct.id,
        product.code,
        product.images,
        counters
      );
    }

    await syncFeaturedEntries(tx, primaryTenant.id, primaryDataset, primaryProducts, counters);
    await syncPublicShares(
      tx,
      args.tenantSlug,
      primaryTenant.id,
      owner.id,
      primaryDataset,
      primaryProducts,
      counters
    );
    await syncPublicShares(
      tx,
      args.peerTenantSlug,
      peerTenant.id,
      owner.id,
      peerDataset,
      peerProducts,
      counters
    );

    const isolationRows = await tx.product.findMany({
      where: {
        code: CROSS_TENANT_CODE,
        tenantId: { in: [primaryTenant.id, peerTenant.id] }
      },
      select: {
        tenantId: true
      }
    });

    counters.crossTenantIsolationValidated = new Set(isolationRows.map((item) => item.tenantId)).size === 2;
  });

  console.info('Synthetic dataset seed complete');
  console.info(`- primary tenant: ${args.tenantSlug}`);
  console.info(`- peer tenant: ${args.peerTenantSlug}`);
  console.info(`- tenants created/updated: ${counters.tenantsCreated}/${counters.tenantsUpdated}`);
  console.info(
    `- owner memberships created/updated: ${counters.membershipsCreated}/${counters.membershipsUpdated}`
  );
  console.info(`- products created/updated: ${counters.productsCreated}/${counters.productsUpdated}`);
  console.info(`- images created/updated/deleted: ${counters.imagesCreated}/${counters.imagesUpdated}/${counters.imagesDeleted}`);
  console.info(`- featured entries created/updated: ${counters.featuredCreated}/${counters.featuredUpdated}`);
  console.info(`- public shares created/reused: ${counters.sharesCreated}/${counters.sharesReused}`);
  console.info(
    `- cross-tenant isolation (${CROSS_TENANT_CODE}) validated: ${counters.crossTenantIsolationValidated ? 'yes' : 'no'}`
  );
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

  printPlan(args, databaseUrl);

  const prisma = new PrismaClient();

  try {
    if (!args.confirm) {
      await runDryRun(prisma, args);
      return;
    }

    await runWrite(prisma, args);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Synthetic dataset seed failed');
  console.error(error);
  process.exitCode = 1;
});
