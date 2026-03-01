#!/usr/bin/env ts-node
// @ts-nocheck

import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

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
  input: string;
  env: 'dev' | 'staging' | 'prod';
  confirm: boolean;
  confirmProd: boolean;
  tenantSlug: string;
  tenantName: string;
  adminEmail: string;
  skipShares: boolean;
  reportDir: string | null;
};

type ExportedSeries = {
  legacyId: string;
  code: string | null;
  name: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type ExportedProduct = {
  legacyId: string;
  code: string | null;
  description: string | null;
  seriesLegacyId: string | null;
  sex: string | null;
  sireCode: string | null;
  damCode: string | null;
  mateCode: string | null;
  excludeFromBreeding: boolean;
  inStock: boolean;
  isFeatured: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type ExportedProductImage = {
  legacyId: string;
  legacyProductId: string;
  url: string | null;
  type: string | null;
  sortOrder: number;
  createdAt: string | null;
};

type ExportedBreeder = {
  legacyId: string;
  code: string | null;
  description: string | null;
  seriesLegacyId: string | null;
  sex: string | null;
  sireCode: string | null;
  damCode: string | null;
  mateCode: string | null;
  excludeFromBreeding: boolean;
  inStock: boolean;
  isFeatured: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type ExportedBreederEvent = {
  legacyId: string;
  legacyBreederId: string;
  eventType: string | null;
  eventDate: string | null;
  maleCode: string | null;
  eggCount: number | null;
  note: string | null;
  oldMateCode: string | null;
  newMateCode: string | null;
  createdAt: string | null;
};

type ExportedFeaturedProduct = {
  legacyId: string;
  legacyProductId: string;
  sortOrder: number;
  isActive: boolean;
};

type ExportedShareSeed = {
  legacyProductId: string;
  strategy: 'featured_product';
};

type ExportPayload = {
  version: number;
  exportedAt: string;
  source: {
    apiBaseUrl?: string;
    [key: string]: unknown;
  };
  tenant?: {
    suggestedSlug?: string;
    suggestedName?: string;
  };
  counts?: Record<string, number>;
  validationIssues?: string[];
  users?: Array<{ username?: string; role?: string; legacyId?: string | null }>;
  series: ExportedSeries[];
  products: ExportedProduct[];
  productImages: ExportedProductImage[];
  breeders: ExportedBreeder[];
  breederEvents: ExportedBreederEvent[];
  featuredProducts: ExportedFeaturedProduct[];
  shareSeeds: ExportedShareSeed[];
};

type ImportCounters = {
  seriesCreated: number;
  seriesUpdated: number;
  seriesSkippedNoCode: number;

  productsCreated: number;
  productsUpdated: number;
  productsSkippedNoCode: number;

  breedersCreated: number;
  breedersUpdated: number;
  breedersSkippedNoCode: number;
  breedersSkippedNoSeries: number;

  eventsCreated: number;
  eventsSkippedInvalidDate: number;
  eventsSkippedNoBreeder: number;
  eventsSkippedExisting: number;

  imagesCreated: number;
  imagesUpdated: number;
  imagesSkippedNoProduct: number;
  imagesSkippedEmptyUrl: number;

  featuredCreated: number;
  featuredUpdated: number;
  featuredSkippedNoProduct: number;

  sharesCreated: number;
  sharesUpdated: number;
  sharesSkippedNoProduct: number;
};

type ImportResult = {
  tenantId: string;
  adminUserId: string;
  counters: ImportCounters;
  importedSeriesIds: string[];
  importedProductIds: string[];
  importedBreederIds: string[];
  featuredProductIds: string[];
  sharedProductIds: string[];
};

const DEFAULT_TENANT_SLUG = 'turtle-album';
const DEFAULT_TENANT_NAME = 'Turtle Album';
const DEFAULT_ADMIN_EMAIL = 'admin@turtlealbum.local';

function parseArgs(argv: string[]): CliArgs {
  let input = '';
  let env: CliArgs['env'] = 'dev';
  let confirm = false;
  let confirmProd = false;
  let tenantSlug = DEFAULT_TENANT_SLUG;
  let tenantName = DEFAULT_TENANT_NAME;
  let adminEmail = process.env.EGGTURTLE_MIGRATION_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;
  let skipShares = false;
  let reportDir: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--input') {
      input = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--env') {
      const value = requireValue(argv, index, arg);
      if (value !== 'dev' && value !== 'staging' && value !== 'prod') {
        throw new Error('--env must be one of: dev, staging, prod.');
      }
      env = value;
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

    if (arg === '--report-dir') {
      reportDir = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--skip-shares') {
      skipShares = true;
      continue;
    }

    if (arg === '--confirm') {
      confirm = true;
      continue;
    }

    if (arg === '--confirm-prod') {
      confirmProd = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!input.trim()) {
    throw new Error('--input is required.');
  }

  if (!tenantSlug.trim()) {
    throw new Error('--tenant-slug cannot be empty.');
  }

  if (!tenantName.trim()) {
    throw new Error('--tenant-name cannot be empty.');
  }

  if (!adminEmail.includes('@')) {
    throw new Error('--admin-email must be a valid email address.');
  }

  return {
    input: input.trim(),
    env,
    confirm,
    confirmProd,
    tenantSlug: tenantSlug.trim(),
    tenantName: tenantName.trim(),
    adminEmail: adminEmail.trim().toLowerCase(),
    skipShares,
    reportDir: reportDir ? reportDir.trim() : null
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
    'Usage: ts-node scripts/migrate/turtle_album_prod_import.ts [options]',
    '',
    'Required:',
    '  --input <path>              Path to export.json generated by turtle_album_prod_api_export.ts',
    '',
    'Options:',
    '  --env <dev|staging|prod>    Target environment label (default: dev)',
    `  --tenant-slug <slug>        Target tenant slug (default: ${DEFAULT_TENANT_SLUG})`,
    `  --tenant-name <name>        Target tenant name (default: ${DEFAULT_TENANT_NAME})`,
    `  --admin-email <email>       Owner user email (default: ${DEFAULT_ADMIN_EMAIL})`,
    '  --skip-shares               Skip synthetic share creation from shareSeeds',
    '  --report-dir <path>         Write import report files to this directory',
    '  --confirm                   Execute DB write operations (default is dry-run)',
    '  --confirm-prod              Required when --env=prod or target DB looks production',
    '  -h, --help                  Show help',
    '',
    'Safety rails:',
    '- Default mode is dry-run.',
    '- Any production target requires both --env=prod and --confirm-prod.',
    '- Script refuses to touch prod-like DATABASE_URL without both flags.'
  ];

  const output = lines.join('\n');
  if (code === 0) {
    console.info(output);
  } else {
    console.error(output);
  }

  process.exit(code);
}

function parsePayload(inputPath: string): ExportPayload {
  const absolutePath = resolve(inputPath);
  const raw = readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<ExportPayload>;

  if (!Array.isArray(parsed.series)) {
    throw new Error(`Invalid payload in ${absolutePath}: series must be an array.`);
  }
  if (!Array.isArray(parsed.products)) {
    throw new Error(`Invalid payload in ${absolutePath}: products must be an array.`);
  }
  if (!Array.isArray(parsed.productImages)) {
    throw new Error(`Invalid payload in ${absolutePath}: productImages must be an array.`);
  }
  if (!Array.isArray(parsed.breeders)) {
    throw new Error(`Invalid payload in ${absolutePath}: breeders must be an array.`);
  }
  if (!Array.isArray(parsed.breederEvents)) {
    throw new Error(`Invalid payload in ${absolutePath}: breederEvents must be an array.`);
  }
  if (!Array.isArray(parsed.featuredProducts)) {
    throw new Error(`Invalid payload in ${absolutePath}: featuredProducts must be an array.`);
  }

  return {
    version: parsed.version ?? 1,
    exportedAt: parsed.exportedAt ?? '',
    source: parsed.source ?? {},
    tenant: parsed.tenant,
    counts: parsed.counts,
    validationIssues: Array.isArray(parsed.validationIssues) ? parsed.validationIssues : [],
    users: Array.isArray(parsed.users) ? parsed.users : [],
    series: parsed.series,
    products: parsed.products,
    productImages: parsed.productImages,
    breeders: parsed.breeders,
    breederEvents: parsed.breederEvents,
    featuredProducts: parsed.featuredProducts,
    shareSeeds: Array.isArray(parsed.shareSeeds) ? parsed.shareSeeds : []
  };
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeCode(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeSex(value: unknown): string | null {
  const sex = normalizeString(value)?.toLowerCase();
  if (sex === 'male' || sex === 'female') {
    return sex;
  }
  return null;
}

function normalizeSortOrder(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
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
    return prodKeywordHit;
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

  return prodKeywordHit && !isLocalHost;
}

function validateSafety(args: CliArgs, databaseUrl: string): void {
  const dbLooksProd = looksLikeProductionDatabaseUrl(databaseUrl);

  if (args.env === 'prod' && !args.confirmProd) {
    throw new Error('--env=prod requires --confirm-prod.');
  }

  if (dbLooksProd) {
    if (args.env !== 'prod') {
      throw new Error(
        'DATABASE_URL looks like production, but --env is not prod. Use --env=prod --confirm-prod.'
      );
    }

    if (!args.confirmProd) {
      throw new Error('DATABASE_URL looks like production. --confirm-prod is required.');
    }
  }
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

function deriveImageKey(legacyImageId: string, url: string): string {
  return `legacy/${createHash('sha1').update(`${legacyImageId}|${url}`).digest('hex')}`;
}

function buildShareToken(tenantSlug: string, productId: string): string {
  const digest = createHash('sha1').update(`${tenantSlug}:${productId}`).digest('hex').slice(0, 32);
  return `ta-${digest}`;
}

function toIsoOrNull(value: unknown): string | null {
  const candidate = normalizeString(value);
  if (!candidate) {
    return null;
  }

  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function buildEventNote(event: ExportedBreederEvent): string | null {
  const parts: string[] = [];

  const note = normalizeString(event.note);
  if (note) {
    parts.push(note);
  }

  const metadata: string[] = [];
  if (normalizeString(event.maleCode)) {
    metadata.push(`maleCode=${normalizeString(event.maleCode)}`);
  }
  if (typeof event.eggCount === 'number' && Number.isFinite(event.eggCount)) {
    metadata.push(`eggCount=${event.eggCount}`);
  }
  if (normalizeString(event.oldMateCode)) {
    metadata.push(`oldMateCode=${normalizeString(event.oldMateCode)}`);
  }
  if (normalizeString(event.newMateCode)) {
    metadata.push(`newMateCode=${normalizeString(event.newMateCode)}`);
  }
  if (normalizeString(event.legacyId)) {
    metadata.push(`legacyEventId=${normalizeString(event.legacyId)}`);
  }

  if (metadata.length > 0) {
    parts.push(`[legacy ${metadata.join(', ')}]`);
  }

  const combined = parts.join('\n').trim();
  return combined || null;
}

function normalizeEventType(value: unknown): string {
  const normalized = normalizeString(value)?.toLowerCase();
  if (!normalized) {
    return 'legacy_event';
  }

  if (normalized === 'mating' || normalized === 'egg' || normalized === 'change_mate') {
    return normalized;
  }

  return normalized.slice(0, 40);
}

function formatRunId(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function sanitizeForSeriesCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function prepareSeriesCodes(series: ExportedSeries[]): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>();

  for (const [index, item] of series.entries()) {
    const legacyId = normalizeString(item.legacyId);
    if (!legacyId) {
      continue;
    }

    const explicitCode = normalizeCode(item.code);
    const byName = normalizeString(item.name) ? `SER-${sanitizeForSeriesCode(item.name!)}` : null;
    const fallback = `SER-${createHash('sha1').update(`${legacyId}:${index}`).digest('hex').slice(0, 10).toUpperCase()}`;

    let candidate = explicitCode ?? byName ?? fallback;
    if (!candidate) {
      continue;
    }

    candidate = candidate.slice(0, 120);
    if (!candidate) {
      continue;
    }

    if (used.has(candidate)) {
      let suffix = 2;
      let nextCandidate = `${candidate}-${suffix}`;
      while (used.has(nextCandidate)) {
        suffix += 1;
        nextCandidate = `${candidate}-${suffix}`;
      }
      candidate = nextCandidate;
    }

    used.add(candidate);
    map.set(legacyId, candidate);
  }

  return map;
}

function uniqueCodes(values: Array<string | null | undefined>): string[] {
  const result = new Set<string>();
  for (const value of values) {
    const code = normalizeCode(value);
    if (!code) {
      continue;
    }
    result.add(code);
  }
  return Array.from(result);
}

function printPlan(args: CliArgs, payload: ExportPayload, databaseUrl: string): void {
  console.info('Import plan:');
  console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
  console.info(`- env: ${args.env}`);
  console.info(`- input: ${resolve(args.input)}`);
  console.info(`- tenant: ${args.tenantSlug} (${args.tenantName})`);
  console.info(`- admin email: ${args.adminEmail}`);
  console.info(`- skip shares: ${args.skipShares ? 'yes' : 'no'}`);
  console.info(`- database: ${databaseUrl}`);
  console.info('- payload counts:');
  console.info(`  - series: ${payload.series.length}`);
  console.info(`  - products: ${payload.products.length}`);
  console.info(`  - productImages: ${payload.productImages.length}`);
  console.info(`  - breeders: ${payload.breeders.length}`);
  console.info(`  - breederEvents: ${payload.breederEvents.length}`);
  console.info(`  - featuredProducts: ${payload.featuredProducts.length}`);
  console.info(`  - shareSeeds: ${payload.shareSeeds.length}`);
  console.info(`  - users: ${(payload.users ?? []).length}`);

  if ((payload.validationIssues ?? []).length > 0) {
    console.info(`- payload validation issues: ${(payload.validationIssues ?? []).length}`);
  }
}

async function runDryRun(prisma: InstanceType<typeof PrismaClient>, args: CliArgs, payload: ExportPayload) {
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: args.tenantSlug },
    select: { id: true }
  });

  const existingAdmin = await prisma.user.findUnique({
    where: { email: args.adminEmail },
    select: { id: true }
  });

  const seriesCodes = uniqueCodes(payload.series.map((item) => item.code));
  const productCodes = uniqueCodes(payload.products.map((item) => item.code));
  const breederCodes = uniqueCodes(payload.breeders.map((item) => item.code));

  let existingSeriesCount = 0;
  let existingProductsCount = 0;
  let existingBreedersCount = 0;

  if (existingTenant && seriesCodes.length > 0) {
    existingSeriesCount = await prisma.series.count({
      where: {
        tenantId: existingTenant.id,
        code: { in: seriesCodes }
      }
    });
  }

  if (existingTenant && productCodes.length > 0) {
    existingProductsCount = await prisma.product.count({
      where: {
        tenantId: existingTenant.id,
        code: { in: productCodes }
      }
    });
  }

  if (existingTenant && breederCodes.length > 0) {
    existingBreedersCount = await prisma.breeder.count({
      where: {
        tenantId: existingTenant.id,
        code: { in: breederCodes }
      }
    });
  }

  console.info('Dry-run summary:');
  console.info(`- tenant exists: ${existingTenant ? 'yes' : 'no'}`);
  console.info(`- admin user exists: ${existingAdmin ? 'yes' : 'no'}`);

  console.info(`- series upsert target: ${seriesCodes.length}`);
  console.info(`  - likely create: ${Math.max(0, seriesCodes.length - existingSeriesCount)}`);
  console.info(`  - likely update: ${existingSeriesCount}`);

  console.info(`- products upsert target: ${productCodes.length}`);
  console.info(`  - likely create: ${Math.max(0, productCodes.length - existingProductsCount)}`);
  console.info(`  - likely update: ${existingProductsCount}`);

  console.info(`- breeders upsert target: ${breederCodes.length}`);
  console.info(`  - likely create: ${Math.max(0, breederCodes.length - existingBreedersCount)}`);
  console.info(`  - likely update: ${existingBreedersCount}`);

  console.info(`- product images to process: ${payload.productImages.length}`);
  console.info(`- breeder events to process: ${payload.breederEvents.length}`);
  console.info(`- featured products to process: ${payload.featuredProducts.length}`);
  console.info(
    `- shares to process: ${args.skipShares ? 0 : payload.shareSeeds.length || payload.featuredProducts.length}`
  );
  console.info('No data changed. Re-run with --confirm to write.');
}

function createEmptyCounters(): ImportCounters {
  return {
    seriesCreated: 0,
    seriesUpdated: 0,
    seriesSkippedNoCode: 0,

    productsCreated: 0,
    productsUpdated: 0,
    productsSkippedNoCode: 0,

    breedersCreated: 0,
    breedersUpdated: 0,
    breedersSkippedNoCode: 0,
    breedersSkippedNoSeries: 0,

    eventsCreated: 0,
    eventsSkippedInvalidDate: 0,
    eventsSkippedNoBreeder: 0,
    eventsSkippedExisting: 0,

    imagesCreated: 0,
    imagesUpdated: 0,
    imagesSkippedNoProduct: 0,
    imagesSkippedEmptyUrl: 0,

    featuredCreated: 0,
    featuredUpdated: 0,
    featuredSkippedNoProduct: 0,

    sharesCreated: 0,
    sharesUpdated: 0,
    sharesSkippedNoProduct: 0
  };
}

async function runWrite(
  prisma: InstanceType<typeof PrismaClient>,
  args: CliArgs,
  payload: ExportPayload
): Promise<ImportResult> {
  const counters = createEmptyCounters();
  const seriesCodeMap = prepareSeriesCodes(payload.series);

  const importedSeriesIds = new Set<string>();
  const importedProductIds = new Set<string>();
  const importedBreederIds = new Set<string>();
  const featuredProductIds = new Set<string>();
  const sharedProductIds = new Set<string>();

  const result = await prisma.$transaction(async (tx) => {
    const sourceUsername = normalizeString(payload.users?.[0]?.username) ?? 'Turtle Album Admin';

    const adminUser = await tx.user.upsert({
      where: { email: args.adminEmail },
      update: { name: sourceUsername },
      create: {
        email: args.adminEmail,
        name: sourceUsername
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

    const seriesLegacyIdToId = new Map<string, string>();

    for (const sourceSeries of payload.series) {
      const legacySeriesId = normalizeString(sourceSeries.legacyId);
      if (!legacySeriesId) {
        continue;
      }

      const code = normalizeCode(seriesCodeMap.get(legacySeriesId));
      if (!code) {
        counters.seriesSkippedNoCode += 1;
        continue;
      }

      const existing = await tx.series.findUnique({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code
          }
        },
        select: { id: true }
      });

      const upserted = await tx.series.upsert({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code
          }
        },
        update: {
          name: normalizeString(sourceSeries.name) ?? code,
          description: normalizeString(sourceSeries.description),
          sortOrder: normalizeSortOrder(sourceSeries.sortOrder, 0),
          isActive: sourceSeries.isActive !== false
        },
        create: {
          tenantId: tenant.id,
          code,
          name: normalizeString(sourceSeries.name) ?? code,
          description: normalizeString(sourceSeries.description),
          sortOrder: normalizeSortOrder(sourceSeries.sortOrder, 0),
          isActive: sourceSeries.isActive !== false
        }
      });

      if (existing) {
        counters.seriesUpdated += 1;
      } else {
        counters.seriesCreated += 1;
      }

      seriesLegacyIdToId.set(legacySeriesId, upserted.id);
      importedSeriesIds.add(upserted.id);
    }

    const productLegacyIdToId = new Map<string, string>();
    const productLegacyIdToCode = new Map<string, string>();
    const productLegacyIdToSeriesLegacyId = new Map<string, string | null>();

    for (const sourceProduct of payload.products) {
      const legacyProductId = normalizeString(sourceProduct.legacyId);
      if (!legacyProductId) {
        continue;
      }

      const code = normalizeCode(sourceProduct.code);
      if (!code) {
        counters.productsSkippedNoCode += 1;
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

      const upserted = await tx.product.upsert({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code
          }
        },
        update: {
          description: normalizeString(sourceProduct.description),
          name: null
        },
        create: {
          tenantId: tenant.id,
          code,
          name: null,
          description: normalizeString(sourceProduct.description)
        }
      });

      if (existing) {
        counters.productsUpdated += 1;
      } else {
        counters.productsCreated += 1;
      }

      productLegacyIdToId.set(legacyProductId, upserted.id);
      productLegacyIdToCode.set(legacyProductId, code);
      productLegacyIdToSeriesLegacyId.set(legacyProductId, normalizeString(sourceProduct.seriesLegacyId));
      importedProductIds.add(upserted.id);
    }

    const breederLegacyIdToId = new Map<string, string>();

    for (const sourceBreeder of payload.breeders) {
      const legacyBreederId = normalizeString(sourceBreeder.legacyId);
      if (!legacyBreederId) {
        continue;
      }

      const code = normalizeCode(sourceBreeder.code);
      if (!code) {
        counters.breedersSkippedNoCode += 1;
        continue;
      }

      const directSeriesLegacyId = normalizeString(sourceBreeder.seriesLegacyId);
      const fallbackSeriesLegacyId = productLegacyIdToSeriesLegacyId.get(legacyBreederId) ?? null;
      const seriesLegacyId = directSeriesLegacyId ?? fallbackSeriesLegacyId;

      const seriesId = seriesLegacyId ? seriesLegacyIdToId.get(seriesLegacyId) : null;
      if (!seriesId) {
        counters.breedersSkippedNoSeries += 1;
        continue;
      }

      const existing = await tx.breeder.findUnique({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code
          }
        },
        select: { id: true }
      });

      const upserted = await tx.breeder.upsert({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code
          }
        },
        update: {
          seriesId,
          description: normalizeString(sourceBreeder.description),
          sex: normalizeSex(sourceBreeder.sex),
          sireCode: normalizeCode(sourceBreeder.sireCode),
          damCode: normalizeCode(sourceBreeder.damCode),
          mateCode: normalizeCode(sourceBreeder.mateCode),
          isActive: sourceBreeder.inStock !== false,
          name: null
        },
        create: {
          tenantId: tenant.id,
          seriesId,
          code,
          description: normalizeString(sourceBreeder.description),
          sex: normalizeSex(sourceBreeder.sex),
          sireCode: normalizeCode(sourceBreeder.sireCode),
          damCode: normalizeCode(sourceBreeder.damCode),
          mateCode: normalizeCode(sourceBreeder.mateCode),
          isActive: sourceBreeder.inStock !== false,
          name: null
        }
      });

      if (existing) {
        counters.breedersUpdated += 1;
      } else {
        counters.breedersCreated += 1;
      }

      breederLegacyIdToId.set(legacyBreederId, upserted.id);
      importedBreederIds.add(upserted.id);
    }

    const sortedEvents = [...payload.breederEvents].sort((left, right) => {
      const leftDate = toIsoOrNull(left.eventDate) ?? '';
      const rightDate = toIsoOrNull(right.eventDate) ?? '';
      return leftDate.localeCompare(rightDate);
    });

    for (const sourceEvent of sortedEvents) {
      const breederId = breederLegacyIdToId.get(sourceEvent.legacyBreederId);
      if (!breederId) {
        counters.eventsSkippedNoBreeder += 1;
        continue;
      }

      const eventDateIso = toIsoOrNull(sourceEvent.eventDate);
      if (!eventDateIso) {
        counters.eventsSkippedInvalidDate += 1;
        continue;
      }

      const eventDate = new Date(eventDateIso);
      const eventType = normalizeEventType(sourceEvent.eventType);
      const note = buildEventNote(sourceEvent);

      const existing = await tx.breederEvent.findFirst({
        where: {
          tenantId: tenant.id,
          breederId,
          eventType,
          eventDate,
          note
        },
        select: { id: true }
      });

      if (existing) {
        counters.eventsSkippedExisting += 1;
        continue;
      }

      await tx.breederEvent.create({
        data: {
          tenantId: tenant.id,
          breederId,
          eventType,
          eventDate,
          note
        }
      });
      counters.eventsCreated += 1;
    }

    const imagesByProduct = new Map<string, ExportedProductImage[]>();
    for (const image of payload.productImages) {
      const list = imagesByProduct.get(image.legacyProductId) ?? [];
      list.push(image);
      imagesByProduct.set(image.legacyProductId, list);
    }

    for (const [legacyProductId, images] of imagesByProduct.entries()) {
      const productId = productLegacyIdToId.get(legacyProductId);
      if (!productId) {
        counters.imagesSkippedNoProduct += images.length;
        continue;
      }

      const normalizedImages = images
        .map((image, index) => {
          const url = normalizeString(image.url);
          if (!url) {
            counters.imagesSkippedEmptyUrl += 1;
            return null;
          }

          return {
            legacyImageId: normalizeString(image.legacyId) ?? `${legacyProductId}-${index + 1}`,
            url,
            type: normalizeString(image.type),
            sortOrder: normalizeSortOrder(image.sortOrder, index)
          };
        })
        .filter((value): value is NonNullable<typeof value> => value !== null)
        .sort((left, right) => left.sortOrder - right.sortOrder);

      if (normalizedImages.length === 0) {
        continue;
      }

      const preferredMain = normalizedImages.find((image) => image.type?.toLowerCase() === 'main');
      const mainCandidate = preferredMain ?? normalizedImages[0];
      let mainImageId: string | null = null;

      for (const image of normalizedImages) {
        const key = deriveImageKey(image.legacyImageId, image.url);

        const existingImage = await tx.productImage.findFirst({
          where: {
            tenantId: tenant.id,
            productId,
            key
          },
          select: { id: true }
        });

        const isMain = image.legacyImageId === mainCandidate.legacyImageId;

        if (existingImage) {
          const updated = await tx.productImage.update({
            where: { id: existingImage.id },
            data: {
              url: image.url,
              contentType: inferContentType(image.url),
              sortOrder: image.sortOrder,
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
            productId,
            key,
            url: image.url,
            contentType: inferContentType(image.url),
            sortOrder: image.sortOrder,
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
            productId
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

    for (const sourceFeatured of payload.featuredProducts) {
      if (sourceFeatured.isActive === false) {
        continue;
      }

      const productId = productLegacyIdToId.get(sourceFeatured.legacyProductId);
      if (!productId) {
        counters.featuredSkippedNoProduct += 1;
        continue;
      }

      const existing = await tx.featuredProduct.findUnique({
        where: {
          tenantId_productId: {
            tenantId: tenant.id,
            productId
          }
        },
        select: { id: true }
      });

      await tx.featuredProduct.upsert({
        where: {
          tenantId_productId: {
            tenantId: tenant.id,
            productId
          }
        },
        update: {
          sortOrder: normalizeSortOrder(sourceFeatured.sortOrder, 0)
        },
        create: {
          tenantId: tenant.id,
          productId,
          sortOrder: normalizeSortOrder(sourceFeatured.sortOrder, 0)
        }
      });

      if (existing) {
        counters.featuredUpdated += 1;
      } else {
        counters.featuredCreated += 1;
      }

      featuredProductIds.add(productId);
    }

    if (!args.skipShares) {
      const shareSource = payload.shareSeeds.length > 0
        ? payload.shareSeeds
        : payload.featuredProducts
            .filter((item) => item.isActive !== false)
            .map((item) => ({ legacyProductId: item.legacyProductId, strategy: 'featured_product' as const }));

      for (const sourceShare of shareSource) {
        const productId = productLegacyIdToId.get(sourceShare.legacyProductId);
        if (!productId) {
          counters.sharesSkippedNoProduct += 1;
          continue;
        }

        const existing = await tx.publicShare.findUnique({
          where: {
            tenantId_productId: {
              tenantId: tenant.id,
              productId
            }
          },
          select: { id: true }
        });

        await tx.publicShare.upsert({
          where: {
            tenantId_productId: {
              tenantId: tenant.id,
              productId
            }
          },
          update: {
            createdByUserId: adminUser.id
          },
          create: {
            tenantId: tenant.id,
            productId,
            createdByUserId: adminUser.id,
            shareToken: buildShareToken(args.tenantSlug, productId)
          }
        });

        if (existing) {
          counters.sharesUpdated += 1;
        } else {
          counters.sharesCreated += 1;
        }

        sharedProductIds.add(productId);
      }
    }

    return {
      tenantId: tenant.id,
      adminUserId: adminUser.id
    };
  });

  return {
    tenantId: result.tenantId,
    adminUserId: result.adminUserId,
    counters,
    importedSeriesIds: Array.from(importedSeriesIds),
    importedProductIds: Array.from(importedProductIds),
    importedBreederIds: Array.from(importedBreederIds),
    featuredProductIds: Array.from(featuredProductIds),
    sharedProductIds: Array.from(sharedProductIds)
  };
}

async function buildReadbackReport(
  prisma: InstanceType<typeof PrismaClient>,
  args: CliArgs,
  payload: ExportPayload,
  result: ImportResult
): Promise<Record<string, unknown>> {
  const tenantId = result.tenantId;

  const [
    tenantSeriesCount,
    tenantProductCount,
    tenantBreederCount,
    tenantEventCount,
    tenantImageCount,
    tenantFeaturedCount,
    tenantShareCount
  ] = await Promise.all([
    prisma.series.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId } }),
    prisma.breeder.count({ where: { tenantId } }),
    prisma.breederEvent.count({ where: { tenantId } }),
    prisma.productImage.count({ where: { tenantId } }),
    prisma.featuredProduct.count({ where: { tenantId } }),
    prisma.publicShare.count({ where: { tenantId } })
  ]);

  const importedSeriesCount = result.importedSeriesIds.length
    ? await prisma.series.count({
        where: {
          tenantId,
          id: { in: result.importedSeriesIds }
        }
      })
    : 0;

  const importedProductCount = result.importedProductIds.length
    ? await prisma.product.count({
        where: {
          tenantId,
          id: { in: result.importedProductIds }
        }
      })
    : 0;

  const importedBreederCount = result.importedBreederIds.length
    ? await prisma.breeder.count({
        where: {
          tenantId,
          id: { in: result.importedBreederIds }
        }
      })
    : 0;

  const importedEventsCount = result.importedBreederIds.length
    ? await prisma.breederEvent.count({
        where: {
          tenantId,
          breederId: { in: result.importedBreederIds }
        }
      })
    : 0;

  const importedImagesCount = result.importedProductIds.length
    ? await prisma.productImage.count({
        where: {
          tenantId,
          productId: { in: result.importedProductIds }
        }
      })
    : 0;

  const importedFeaturedCount = result.featuredProductIds.length
    ? await prisma.featuredProduct.count({
        where: {
          tenantId,
          productId: { in: result.featuredProductIds }
        }
      })
    : 0;

  const importedSharesCount = result.sharedProductIds.length
    ? await prisma.publicShare.count({
        where: {
          tenantId,
          productId: { in: result.sharedProductIds }
        }
      })
    : 0;

  const verification = {
    importedSeriesPresent: importedSeriesCount >= result.importedSeriesIds.length,
    importedProductsPresent: importedProductCount >= result.importedProductIds.length,
    importedBreedersPresent: importedBreederCount >= result.importedBreederIds.length,
    importedEventsPresent: importedEventsCount >= result.counters.eventsCreated,
    importedImagesPresent: importedImagesCount >= result.counters.imagesCreated,
    importedFeaturedPresent: importedFeaturedCount >= result.featuredProductIds.length,
    importedSharesPresent: importedSharesCount >= result.sharedProductIds.length
  };

  return {
    runId: formatRunId(new Date()),
    importedAt: new Date().toISOString(),
    env: args.env,
    input: resolve(args.input),
    tenant: {
      id: result.tenantId,
      slug: args.tenantSlug,
      name: args.tenantName
    },
    source: payload.source,
    payloadCounts: {
      series: payload.series.length,
      products: payload.products.length,
      productImages: payload.productImages.length,
      breeders: payload.breeders.length,
      breederEvents: payload.breederEvents.length,
      featuredProducts: payload.featuredProducts.length,
      shareSeeds: payload.shareSeeds.length
    },
    counters: result.counters,
    readbackCounts: {
      tenantSeriesCount,
      tenantProductCount,
      tenantBreederCount,
      tenantEventCount,
      tenantImageCount,
      tenantFeaturedCount,
      tenantShareCount,
      importedSeriesCount,
      importedProductCount,
      importedBreederCount,
      importedEventsCount,
      importedImagesCount,
      importedFeaturedCount,
      importedSharesCount
    },
    verification,
    payloadValidationIssues: payload.validationIssues ?? []
  };
}

function printWriteSummary(result: ImportResult, verification: Record<string, unknown>): void {
  const counters = result.counters;
  console.info('Import complete');
  console.info(`- series created/updated/skippedNoCode: ${counters.seriesCreated}/${counters.seriesUpdated}/${counters.seriesSkippedNoCode}`);
  console.info(`- products created/updated/skippedNoCode: ${counters.productsCreated}/${counters.productsUpdated}/${counters.productsSkippedNoCode}`);
  console.info(`- breeders created/updated/skippedNoCode/skippedNoSeries: ${counters.breedersCreated}/${counters.breedersUpdated}/${counters.breedersSkippedNoCode}/${counters.breedersSkippedNoSeries}`);
  console.info(`- events created/skippedNoBreeder/skippedInvalidDate/skippedExisting: ${counters.eventsCreated}/${counters.eventsSkippedNoBreeder}/${counters.eventsSkippedInvalidDate}/${counters.eventsSkippedExisting}`);
  console.info(`- images created/updated/skippedNoProduct/skippedEmptyUrl: ${counters.imagesCreated}/${counters.imagesUpdated}/${counters.imagesSkippedNoProduct}/${counters.imagesSkippedEmptyUrl}`);
  console.info(`- featured created/updated/skippedNoProduct: ${counters.featuredCreated}/${counters.featuredUpdated}/${counters.featuredSkippedNoProduct}`);
  console.info(`- shares created/updated/skippedNoProduct: ${counters.sharesCreated}/${counters.sharesUpdated}/${counters.sharesSkippedNoProduct}`);

  const checks = (verification?.verification ?? {}) as Record<string, boolean>;
  console.info('Readback verification:');
  for (const [key, value] of Object.entries(checks)) {
    console.info(`- ${key}: ${value ? 'PASS' : 'CHECK'}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const payload = parsePayload(args.input);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  validateSafety(args, databaseUrl);
  printPlan(args, payload, databaseUrl);

  const prisma = new PrismaClient();
  try {
    if (!args.confirm) {
      await runDryRun(prisma, args, payload);
      return;
    }

    const importResult = await runWrite(prisma, args, payload);
    const report = await buildReadbackReport(prisma, args, payload, importResult);

    printWriteSummary(importResult, report);

    const reportDir = resolve(args.reportDir ?? dirname(resolve(args.input)));
    mkdirSync(reportDir, { recursive: true });

    const runId = String(report.runId);
    const reportJsonPath = resolve(reportDir, `import-report-${runId}.json`);
    const reportMdPath = resolve(reportDir, `import-report-${runId}.md`);

    writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    const verification = (report.verification ?? {}) as Record<string, boolean>;
    const verificationLines = Object.entries(verification).map(
      ([key, value]) => `- ${key}: ${value ? 'PASS' : 'CHECK'}`
    );

    const md = [
      '# Turtle Album Import Report',
      '',
      `- runId: ${report.runId}`,
      `- importedAt: ${report.importedAt}`,
      `- env: ${report.env}`,
      `- tenant: ${args.tenantSlug} (${args.tenantName})`,
      `- input: ${resolve(args.input)}`,
      '',
      '## Counters',
      '',
      '```json',
      JSON.stringify(report.counters ?? {}, null, 2),
      '```',
      '',
      '## Readback Verification',
      '',
      ...verificationLines,
      '',
      '## Readback Counts',
      '',
      '```json',
      JSON.stringify(report.readbackCounts ?? {}, null, 2),
      '```',
      ''
    ].join('\n');

    writeFileSync(reportMdPath, md, 'utf8');

    console.info(`- report json: ${reportJsonPath}`);
    console.info(`- report md: ${reportMdPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Import failed');
  console.error(error);
  process.exitCode = 1;
});
