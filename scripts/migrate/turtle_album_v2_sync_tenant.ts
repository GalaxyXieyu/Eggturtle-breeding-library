#!/usr/bin/env ts-node
// @ts-nocheck

import { createHash } from 'node:crypto';
import { dirname, extname, resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

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

const { PrismaClient, TenantMemberRole } = loadPrismaRuntime();
const { LocalDiskStorageProvider, S3StorageProvider } = loadStorageRuntime();

type CliArgs = {
  input: string;
  env: 'dev' | 'staging' | 'prod';
  confirm: boolean;
  confirmProd: boolean;
  tenantSlug: string;
  tenantName: string;
  adminEmail: string;
  reportDir: string | null;
  legacyImageBaseUrl: string | null;
  skipShares: boolean;
  importImageBinaries: boolean;
  skipImageDownload: boolean;
  imageConcurrency: number;
  imageTimeoutMs: number;
  maxImages: number | null;
  maxImageFailures: number;
};

type ExportPayload = {
  version: number;
  exportedAt: string;
  source: {
    apiBaseUrl?: string;
    [key: string]: unknown;
  };
  users?: Array<{ username?: string; role?: string; legacyId?: string | null }>;
  series: Array<{
    legacyId: string;
    code: string | null;
    name: string | null;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  }>;
  products: Array<{
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
    updatedAt: string | null;
  }>;
  breeders: Array<{
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
  }>;
  breederEvents: Array<{
    legacyId: string;
    legacyBreederId: string;
    eventType: string | null;
    eventDate: string | null;
    maleCode: string | null;
    eggCount: number | null;
    note: string | null;
    oldMateCode: string | null;
    newMateCode: string | null;
  }>;
  productImages: Array<{
    legacyId: string;
    legacyProductId: string;
    url: string | null;
    type: string | null;
    sortOrder: number;
  }>;
  featuredProducts: Array<{
    legacyId: string;
    legacyProductId: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  shareSeeds: Array<{
    legacyProductId: string;
    strategy: 'featured_product';
  }>;
  counts?: Record<string, number>;
  validationIssues?: string[];
};

type SyncCounters = {
  seriesCreated: number;
  seriesUpdated: number;
  productsCreated: number;
  productsUpdated: number;
  productsSkippedNoCode: number;
  eventsCreated: number;
  eventsSkippedExisting: number;
  eventsSkippedNoProduct: number;
  eventsSkippedInvalidDate: number;
  imagesCreated: number;
  imagesUpdated: number;
  imagesSkippedNoProduct: number;
  imagesSkippedNoUrl: number;
  imagesBinaryAttempted: number;
  imagesBinaryUploaded: number;
  imagesBinaryFailed: number;
  imagesBinarySkippedNoHttpUrl: number;
  imagesBinarySkippedManagedExisting: number;
  featuredCreated: number;
  featuredUpdated: number;
  featuredSkippedNoProduct: number;
  sharesCreated: number;
  sharesUpdated: number;
};

type ImageBinaryFailure = {
  imageId: string;
  productId: string;
  key: string;
  url: string;
  reason: string;
};

type PendingImageBinary = {
  imageId: string;
  productId: string;
  sourceUrl: string;
};

const DEFAULT_TENANT_SLUG = 'siri';
const DEFAULT_TENANT_NAME = 'Siri';
const DEFAULT_ADMIN_EMAIL = 'admin@turtlealbum.local';

function parseArgs(argv: string[]): CliArgs {
  let input = '';
  let env: CliArgs['env'] = 'dev';
  let confirm = false;
  let confirmProd = false;
  let tenantSlug = DEFAULT_TENANT_SLUG;
  let tenantName = DEFAULT_TENANT_NAME;
  let adminEmail = process.env.EGGTURTLE_MIGRATION_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;
  let reportDir: string | null = null;
  let legacyImageBaseUrl: string | null = null;
  let skipShares = false;
  let skipImageDownload = false;
  let importImageBinaries = true;
  let imageConcurrency = 3;
  let imageTimeoutMs = 15000;
  let maxImages: number | null = null;
  let maxImageFailures = 0;

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

    if (arg === '--legacy-image-base-url') {
      legacyImageBaseUrl = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--skip-shares') {
      skipShares = true;
      continue;
    }

    if (arg === '--skip-image-download') {
      skipImageDownload = true;
      continue;
    }

    if (arg === '--import-image-binaries') {
      importImageBinaries = true;
      continue;
    }

    if (arg === '--image-concurrency') {
      imageConcurrency = parsePositiveIntegerArg(requireValue(argv, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg === '--image-timeout-ms') {
      imageTimeoutMs = parsePositiveIntegerArg(requireValue(argv, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg === '--max-images') {
      maxImages = parsePositiveIntegerArg(requireValue(argv, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg === '--max-image-failures') {
      maxImageFailures = parseNonNegativeIntegerArg(requireValue(argv, index, arg), arg);
      index += 1;
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

  if (skipImageDownload) {
    importImageBinaries = false;
  }

  return {
    input: input.trim(),
    env,
    confirm,
    confirmProd,
    tenantSlug: tenantSlug.trim(),
    tenantName: tenantName.trim(),
    adminEmail: adminEmail.trim().toLowerCase(),
    reportDir: reportDir ? reportDir.trim() : null,
    legacyImageBaseUrl: legacyImageBaseUrl ? legacyImageBaseUrl.trim() : null,
    skipShares,
    importImageBinaries,
    skipImageDownload,
    imageConcurrency,
    imageTimeoutMs,
    maxImages,
    maxImageFailures
  };
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parsePositiveIntegerArg(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeIntegerArg(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return parsed;
}

function printHelpAndExit(code: number): never {
  const text = [
    'Usage: ts-node scripts/migrate/turtle_album_v2_sync_tenant.ts [options]',
    '',
    'Required:',
    '  --input <path>                Path to export.json generated by turtle_album_prod_api_export.ts',
    '',
    'Options:',
    '  --env <dev|staging|prod>      Target environment label (default: dev)',
    `  --tenant-slug <slug>          Target tenant slug (default: ${DEFAULT_TENANT_SLUG})`,
    `  --tenant-name <name>          Target tenant name (default: ${DEFAULT_TENANT_NAME})`,
    `  --admin-email <email>         OWNER user email (default: ${DEFAULT_ADMIN_EMAIL})`,
    '  --legacy-image-base-url <url> Resolve relative image URLs by this base URL',
    '  --import-image-binaries       Download source image binaries and upload to managed storage (default: enabled)',
    '  --skip-image-download         Disable image binary sync and keep metadata-only URLs',
    '  --image-concurrency <n>       Concurrent image download/upload workers (default: 3)',
    '  --image-timeout-ms <n>        Per-image download timeout in milliseconds (default: 15000)',
    '  --max-images <n>              Limit image binary sync to first N images (smoke run)',
    '  --max-image-failures <n>      Allow up to N image upload failures before failing (default: 0)',
    '  --skip-shares                 Skip tenant_feed share upsert',
    '  --report-dir <path>           Write sync report to directory',
    '  --confirm                     Execute database writes (default is dry-run)',
    '  --confirm-prod                Required when --env=prod or DB looks production',
    '  -h, --help                    Show help'
  ].join('\n');

  if (code === 0) {
    console.info(text);
  } else {
    console.error(text);
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
  if (!Array.isArray(parsed.breeders)) {
    throw new Error(`Invalid payload in ${absolutePath}: breeders must be an array.`);
  }
  if (!Array.isArray(parsed.breederEvents)) {
    throw new Error(`Invalid payload in ${absolutePath}: breederEvents must be an array.`);
  }
  if (!Array.isArray(parsed.productImages)) {
    throw new Error(`Invalid payload in ${absolutePath}: productImages must be an array.`);
  }
  if (!Array.isArray(parsed.featuredProducts)) {
    throw new Error(`Invalid payload in ${absolutePath}: featuredProducts must be an array.`);
  }

  return {
    version: parsed.version ?? 0,
    exportedAt: parsed.exportedAt ?? '',
    source: parsed.source ?? {},
    users: Array.isArray(parsed.users) ? parsed.users : [],
    series: parsed.series,
    products: parsed.products,
    breeders: parsed.breeders,
    breederEvents: parsed.breederEvents,
    productImages: parsed.productImages,
    featuredProducts: parsed.featuredProducts,
    shareSeeds: Array.isArray(parsed.shareSeeds) ? parsed.shareSeeds : [],
    counts: parsed.counts,
    validationIssues: Array.isArray(parsed.validationIssues) ? parsed.validationIssues : []
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

function normalizeSex(value: unknown): 'male' | 'female' | null {
  const normalized = normalizeString(value)?.toLowerCase();
  if (normalized === 'male' || normalized === 'female') {
    return normalized;
  }
  return null;
}

function toIsoOrNull(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const candidate = normalized.includes('T') ? normalized : normalized.replace(' ', 'T');
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function resolveLegacyUrl(rawUrl: string | null | undefined, baseUrl: string | null | undefined): string | null {
  const url = normalizeString(rawUrl);
  if (!url) {
    return null;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const base = normalizeString(baseUrl);
  if (!base) {
    return null;
  }

  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

function deriveImageKey(legacyImageId: string, resolvedUrl: string): string {
  return `external/${createHash('sha1').update(`${legacyImageId}|${resolvedUrl}`).digest('hex')}`;
}

const IMAGE_CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg'
};

function createStorageProvider() {
  const provider = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();
  if (provider === 's3') {
    return new S3StorageProvider();
  }
  return new LocalDiskStorageProvider();
}

function normalizeContentType(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const [mainType] = normalized.split(';');
  return mainType?.trim() || null;
}

function inferExtensionFromContentType(contentType: string | null | undefined): string | null {
  const normalized = normalizeContentType(contentType);
  if (!normalized) {
    return null;
  }
  return IMAGE_CONTENT_TYPE_TO_EXTENSION[normalized] ?? null;
}

function normalizeExtension(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const extension = normalized.startsWith('.') ? normalized : `.${normalized}`;
  return /^\.[a-z0-9]+$/.test(extension) ? extension : null;
}

function inferExtensionFromUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    return normalizeExtension(extname(parsed.pathname));
  } catch {
    return normalizeExtension(extname(url));
  }
}

function chooseManagedImageExtension(
  candidate: { url: string; contentType?: string | null },
  downloadedContentType?: string | null
): string {
  const fromDownloaded = inferExtensionFromContentType(downloadedContentType);
  if (fromDownloaded) {
    return fromDownloaded;
  }
  const fromCandidate = inferExtensionFromContentType(candidate.contentType);
  if (fromCandidate) {
    return fromCandidate;
  }
  const fromUrl = inferExtensionFromUrl(candidate.url);
  if (fromUrl) {
    return fromUrl;
  }
  return '.img';
}

function buildManagedImageKey(
  tenantId: string,
  productId: string,
  imageId: string,
  extension: string
): string {
  return `${tenantId}/products/${productId}/${imageId}${extension}`;
}

function buildImageAccessPath(productId: string, imageId: string): string {
  return `/products/${productId}/images/${imageId}/content`;
}

function isHttpUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('http://') || normalized.startsWith('https://');
}

function isManagedStorageKey(tenantId: string, key: string): boolean {
  const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized.startsWith(`${tenantId}/`);
}

function isStorageObjectMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    name?: string;
    message?: string;
    status?: number;
    statusCode?: number;
    response?: { statusCode?: number };
  };

  if (candidate.status === 404 || candidate.statusCode === 404 || candidate.response?.statusCode === 404) {
    return true;
  }

  const tag = `${candidate.name ?? ''} ${candidate.message ?? ''}`.toLowerCase();
  return tag.includes('not found') || tag.includes('nosuchkey');
}

async function storageObjectExists(storageProvider: any, key: string): Promise<boolean> {
  try {
    await storageProvider.getObject(key);
    return true;
  } catch (error) {
    if (isStorageObjectMissingError(error)) {
      return false;
    }
    throw error;
  }
}

async function downloadImageBinary(
  url: string,
  timeoutMs: number
): Promise<{ body: Buffer; contentType: string }> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal
    });

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

    return {
      body: Buffer.from(arrayBuffer),
      contentType
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Download timeout after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;

  const runners = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const itemIndex = cursor;
      cursor += 1;
      await worker(items[itemIndex], itemIndex);
    }
  });

  await Promise.all(runners);
}

function normalizeEventType(
  value: unknown,
  hasMateTransition: boolean
): 'mating' | 'egg' | 'change_mate' {
  const normalized = normalizeString(value)?.toLowerCase();
  if (normalized === 'egg') {
    return 'egg';
  }
  if (normalized === 'change_mate' || normalized === 'change-mate') {
    return 'change_mate';
  }
  if (hasMateTransition) {
    return 'change_mate';
  }
  return 'mating';
}

function buildEventNote(input: {
  note: string | null;
  maleCode: string | null;
  eggCount: number | null;
  oldMateCode: string | null;
  newMateCode: string | null;
}): string | null {
  const lines: string[] = [];
  const note = normalizeString(input.note);
  if (note) {
    lines.push(note);
  }

  const maleCode = normalizeCode(input.maleCode);
  if (maleCode) {
    lines.push(`#maleCode=${maleCode}`);
  }

  if (typeof input.eggCount === 'number' && Number.isFinite(input.eggCount) && input.eggCount >= 0) {
    lines.push(`#eggCount=${Math.floor(input.eggCount)}`);
  }

  const oldMateCode = normalizeCode(input.oldMateCode);
  if (oldMateCode) {
    lines.push(`#oldMateCode=${oldMateCode}`);
  }

  const newMateCode = normalizeCode(input.newMateCode);
  if (newMateCode) {
    lines.push(`#newMateCode=${newMateCode}`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function buildSeriesCode(input: { code: string | null; name: string | null; legacyId: string }, index: number) {
  const byCode = normalizeCode(input.code);
  if (byCode) {
    return byCode;
  }

  const byName = normalizeString(input.name);
  if (byName) {
    const normalized = byName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (normalized) {
      return normalized;
    }
  }

  const fallbackLegacy = normalizeString(input.legacyId)?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  return `LEGACY-SERIES-${fallbackLegacy || index + 1}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = parsePayload(args.input);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  validateSafety(args, databaseUrl);

  const counters: SyncCounters = {
    seriesCreated: 0,
    seriesUpdated: 0,
    productsCreated: 0,
    productsUpdated: 0,
    productsSkippedNoCode: 0,
    eventsCreated: 0,
    eventsSkippedExisting: 0,
    eventsSkippedNoProduct: 0,
    eventsSkippedInvalidDate: 0,
    imagesCreated: 0,
    imagesUpdated: 0,
    imagesSkippedNoProduct: 0,
    imagesSkippedNoUrl: 0,
    imagesBinaryAttempted: 0,
    imagesBinaryUploaded: 0,
    imagesBinaryFailed: 0,
    imagesBinarySkippedNoHttpUrl: 0,
    imagesBinarySkippedManagedExisting: 0,
    featuredCreated: 0,
    featuredUpdated: 0,
    featuredSkippedNoProduct: 0,
    sharesCreated: 0,
    sharesUpdated: 0
  };

  const prisma = new PrismaClient();
  const imageBinaryFailures: ImageBinaryFailure[] = [];

  console.info('Sync plan:');
  console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
  console.info(`- env: ${args.env}`);
  console.info(`- tenant: ${args.tenantSlug} (${args.tenantName})`);
  console.info(`- adminEmail: ${args.adminEmail}`);
  console.info(`- input: ${resolve(args.input)}`);
  console.info(`- payload version: ${payload.version}`);
  console.info(`- payload counts: ${JSON.stringify(payload.counts ?? {}, null, 2)}`);
  console.info(`- image binary sync: ${args.importImageBinaries ? 'enabled' : 'disabled'}`);
  if (args.importImageBinaries) {
    console.info(`  - concurrency: ${args.imageConcurrency}`);
    console.info(`  - timeoutMs: ${args.imageTimeoutMs}`);
    console.info(`  - maxImages: ${args.maxImages ?? 'all'}`);
    console.info(`  - maxFailures: ${args.maxImageFailures}`);
  }

  const baseUrl = args.legacyImageBaseUrl ?? normalizeString(payload.source?.apiBaseUrl);

  try {
    const seriesLegacyIdToId = new Map<string, string>();
    const productLegacyIdToId = new Map<string, string>();
    const productLegacyIdToCode = new Map<string, string>();
    const legacyBreederIdToCode = new Map<string, string>();

    if (args.confirm) {
      const ownerUser = await prisma.user.upsert({
        where: {
          email: args.adminEmail
        },
        update: {},
        create: {
          email: args.adminEmail,
          name: payload.users?.[0]?.username ?? 'admin'
        }
      });

      const tenant = await prisma.tenant.upsert({
        where: {
          slug: args.tenantSlug
        },
        update: {
          name: args.tenantName
        },
        create: {
          slug: args.tenantSlug,
          name: args.tenantName
        }
      });

      await prisma.tenantMember.upsert({
        where: {
          tenantId_userId: {
            tenantId: tenant.id,
            userId: ownerUser.id
          }
        },
        update: {
          role: TenantMemberRole.OWNER
        },
        create: {
          tenantId: tenant.id,
          userId: ownerUser.id,
          role: TenantMemberRole.OWNER
        }
      });

      const storageProvider = args.importImageBinaries ? createStorageProvider() : null;
      const pendingImageBinaries: PendingImageBinary[] = [];
      const usedSeriesCodes = new Set<string>();

      for (let index = 0; index < payload.series.length; index += 1) {
        const sourceSeries = payload.series[index];
        const legacySeriesId = normalizeString(sourceSeries.legacyId);
        if (!legacySeriesId) {
          continue;
        }

        let code = buildSeriesCode(sourceSeries, index);
        if (usedSeriesCodes.has(code)) {
          code = `${code}-${index + 1}`;
        }
        usedSeriesCodes.add(code);

        const existing = await prisma.series.findUnique({
          where: {
            tenantId_code: {
              tenantId: tenant.id,
              code
            }
          },
          select: { id: true }
        });

        const upserted = await prisma.series.upsert({
          where: {
            tenantId_code: {
              tenantId: tenant.id,
              code
            }
          },
          update: {
            name: normalizeString(sourceSeries.name) ?? code,
            description: normalizeString(sourceSeries.description),
            sortOrder: typeof sourceSeries.sortOrder === 'number' ? sourceSeries.sortOrder : index,
            isActive: sourceSeries.isActive !== false
          },
          create: {
            tenantId: tenant.id,
            code,
            name: normalizeString(sourceSeries.name) ?? code,
            description: normalizeString(sourceSeries.description),
            sortOrder: typeof sourceSeries.sortOrder === 'number' ? sourceSeries.sortOrder : index,
            isActive: sourceSeries.isActive !== false
          }
        });

        if (existing) {
          counters.seriesUpdated += 1;
        } else {
          counters.seriesCreated += 1;
        }

        seriesLegacyIdToId.set(legacySeriesId, upserted.id);
      }

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

        const seriesId = sourceProduct.seriesLegacyId
          ? seriesLegacyIdToId.get(sourceProduct.seriesLegacyId) ?? null
          : null;

        const existing = await prisma.product.findUnique({
          where: {
            tenantId_code: {
              tenantId: tenant.id,
              code
            }
          },
          select: { id: true }
        });

        const upserted = await prisma.product.upsert({
          where: {
            tenantId_code: {
              tenantId: tenant.id,
              code
            }
          },
          update: {
            type: 'breeder',
            name: code,
            description: normalizeString(sourceProduct.description),
            seriesId,
            sex: normalizeSex(sourceProduct.sex),
            sireCode: normalizeCode(sourceProduct.sireCode),
            damCode: normalizeCode(sourceProduct.damCode),
            mateCode: normalizeCode(sourceProduct.mateCode),
            excludeFromBreeding: sourceProduct.excludeFromBreeding === true,
            inStock: sourceProduct.inStock !== false,
            isFeatured: sourceProduct.isFeatured === true,
            legacyBreederId: legacyProductId
          },
          create: {
            tenantId: tenant.id,
            code,
            type: 'breeder',
            name: code,
            description: normalizeString(sourceProduct.description),
            seriesId,
            sex: normalizeSex(sourceProduct.sex),
            sireCode: normalizeCode(sourceProduct.sireCode),
            damCode: normalizeCode(sourceProduct.damCode),
            mateCode: normalizeCode(sourceProduct.mateCode),
            excludeFromBreeding: sourceProduct.excludeFromBreeding === true,
            inStock: sourceProduct.inStock !== false,
            isFeatured: sourceProduct.isFeatured === true,
            legacyBreederId: legacyProductId
          }
        });

        if (existing) {
          counters.productsUpdated += 1;
        } else {
          counters.productsCreated += 1;
        }

        productLegacyIdToId.set(legacyProductId, upserted.id);
        productLegacyIdToCode.set(legacyProductId, code);
      }

      for (const sourceBreeder of payload.breeders) {
        const legacyBreederId = normalizeString(sourceBreeder.legacyId);
        if (!legacyBreederId) {
          continue;
        }
        const code = normalizeCode(sourceBreeder.code);
        if (!code) {
          continue;
        }
        legacyBreederIdToCode.set(legacyBreederId, code);
      }

      for (const sourceEvent of payload.breederEvents) {
        const legacyBreederId = normalizeString(sourceEvent.legacyBreederId);
        if (!legacyBreederId) {
          counters.eventsSkippedNoProduct += 1;
          continue;
        }

        const code = legacyBreederIdToCode.get(legacyBreederId) ?? productLegacyIdToCode.get(legacyBreederId);
        if (!code) {
          counters.eventsSkippedNoProduct += 1;
          continue;
        }

        const targetProduct = await prisma.product.findUnique({
          where: {
            tenantId_code: {
              tenantId: tenant.id,
              code
            }
          },
          select: {
            id: true
          }
        });

        if (!targetProduct) {
          counters.eventsSkippedNoProduct += 1;
          continue;
        }

        const eventDateIso = toIsoOrNull(sourceEvent.eventDate);
        if (!eventDateIso) {
          counters.eventsSkippedInvalidDate += 1;
          continue;
        }

        const note = buildEventNote({
          note: sourceEvent.note,
          maleCode: sourceEvent.maleCode,
          eggCount: sourceEvent.eggCount,
          oldMateCode: sourceEvent.oldMateCode,
          newMateCode: sourceEvent.newMateCode
        });

        const eventType = normalizeEventType(
          sourceEvent.eventType,
          Boolean(normalizeCode(sourceEvent.oldMateCode) || normalizeCode(sourceEvent.newMateCode))
        );
        const eventDate = new Date(eventDateIso);

        const existing = await prisma.productEvent.findFirst({
          where: {
            tenantId: tenant.id,
            productId: targetProduct.id,
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

        await prisma.productEvent.create({
          data: {
            tenantId: tenant.id,
            productId: targetProduct.id,
            eventType,
            eventDate,
            note
          }
        });
        counters.eventsCreated += 1;
      }

      const imagesByProduct = new Map<string, ExportPayload['productImages']>();
      for (const sourceImage of payload.productImages) {
        const list = imagesByProduct.get(sourceImage.legacyProductId) ?? [];
        list.push(sourceImage);
        imagesByProduct.set(sourceImage.legacyProductId, list);
      }

      for (const [legacyProductId, images] of imagesByProduct.entries()) {
        const productId = productLegacyIdToId.get(legacyProductId);
        if (!productId) {
          counters.imagesSkippedNoProduct += images.length;
          continue;
        }

        const normalizedImages = images
          .map((item, index) => {
            const resolvedUrl = resolveLegacyUrl(item.url, baseUrl);
            if (!resolvedUrl) {
              counters.imagesSkippedNoUrl += 1;
              return null;
            }

            return {
              legacyImageId: normalizeString(item.legacyId) ?? `${legacyProductId}-${index + 1}`,
              resolvedUrl,
              sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : index,
              isMainHint: normalizeString(item.type)?.toLowerCase() === 'main'
            };
          })
          .filter((item) => item !== null)
          .sort((left, right) => left.sortOrder - right.sortOrder);

        if (normalizedImages.length === 0) {
          continue;
        }

        const mainImage = normalizedImages.find((item) => item.isMainHint) ?? normalizedImages[0];

        const existingImages = await prisma.productImage.findMany({
          where: {
            tenantId: tenant.id,
            productId
          },
          select: {
            id: true,
            key: true,
            sortOrder: true
          }
        });
        const usedExistingImageIds = new Set<string>();

        for (const sourceImage of normalizedImages) {
          const sourceExternalKey = deriveImageKey(sourceImage.legacyImageId, sourceImage.resolvedUrl);
          let existing =
            existingImages.find((image) => image.key === sourceExternalKey) ??
            existingImages.find(
              (image) => image.sortOrder === sourceImage.sortOrder && !usedExistingImageIds.has(image.id)
            ) ??
            null;

          const isMain = sourceImage.legacyImageId === mainImage.legacyImageId;
          let imageId = '';

          if (existing) {
            await prisma.productImage.update({
              where: {
                id: existing.id
              },
              data: {
                key: sourceExternalKey,
                url: sourceImage.resolvedUrl,
                sortOrder: sourceImage.sortOrder,
                isMain
              }
            });
            imageId = existing.id;
            usedExistingImageIds.add(existing.id);
            counters.imagesUpdated += 1;
          } else {
            const created = await prisma.productImage.create({
              data: {
                tenantId: tenant.id,
                productId,
                key: sourceExternalKey,
                url: sourceImage.resolvedUrl,
                sortOrder: sourceImage.sortOrder,
                isMain
              }
            });
            imageId = created.id;
            counters.imagesCreated += 1;
          }

          pendingImageBinaries.push({
            imageId,
            productId,
            sourceUrl: sourceImage.resolvedUrl
          });
        }
      }

      if (args.importImageBinaries && pendingImageBinaries.length > 0) {
        const candidates = args.maxImages
          ? pendingImageBinaries.slice(0, args.maxImages)
          : pendingImageBinaries;

        await mapWithConcurrency(candidates, args.imageConcurrency, async (candidate) => {
          counters.imagesBinaryAttempted += 1;
          let currentImage:
            | {
                id: string;
                productId: string;
                key: string;
                contentType: string | null;
              }
            | null = null;

          try {
            currentImage = await prisma.productImage.findUnique({
              where: { id: candidate.imageId },
              select: {
                id: true,
                productId: true,
                key: true,
                contentType: true
              }
            });

            if (!currentImage) {
              return;
            }

            const accessPath = buildImageAccessPath(currentImage.productId, currentImage.id);

            if (isManagedStorageKey(tenant.id, currentImage.key)) {
              const alreadyUploaded = await storageObjectExists(storageProvider, currentImage.key);
              if (alreadyUploaded) {
                await prisma.productImage.update({
                  where: { id: currentImage.id },
                  data: { url: accessPath }
                });
                counters.imagesBinarySkippedManagedExisting += 1;
                return;
              }
            }

            if (!isHttpUrl(candidate.sourceUrl)) {
              counters.imagesBinarySkippedNoHttpUrl += 1;
              return;
            }

            const downloaded = await downloadImageBinary(candidate.sourceUrl, args.imageTimeoutMs);
            const extension = chooseManagedImageExtension(
              {
                url: candidate.sourceUrl,
                contentType: currentImage.contentType
              },
              downloaded.contentType
            );
            const targetKey = buildManagedImageKey(tenant.id, currentImage.productId, currentImage.id, extension);

            if (targetKey !== currentImage.key) {
              const targetExists = await storageObjectExists(storageProvider, targetKey);
              if (targetExists) {
                await prisma.productImage.update({
                  where: { id: currentImage.id },
                  data: {
                    key: targetKey,
                    url: accessPath,
                    contentType: downloaded.contentType
                  }
                });
                counters.imagesBinarySkippedManagedExisting += 1;
                return;
              }
            }

            await storageProvider.putObject({
              key: targetKey,
              body: downloaded.body,
              contentType: downloaded.contentType
            });

            await prisma.productImage.update({
              where: { id: currentImage.id },
              data: {
                key: targetKey,
                url: accessPath,
                contentType: downloaded.contentType
              }
            });

            counters.imagesBinaryUploaded += 1;
          } catch (error) {
            counters.imagesBinaryFailed += 1;
            imageBinaryFailures.push({
              imageId: candidate.imageId,
              productId: candidate.productId,
              key: currentImage?.key ?? '<unknown>',
              url: candidate.sourceUrl,
              reason: error instanceof Error ? error.message : 'Unknown image binary upload error.'
            });
          }
        });
      }

      if (counters.imagesBinaryFailed > args.maxImageFailures) {
        const sample = imageBinaryFailures
          .slice(0, 5)
          .map((item) => `${item.imageId}: ${item.reason}`)
          .join(' | ');
        throw new Error(
          `Image binary sync failed for ${counters.imagesBinaryFailed} images (allowed: ${args.maxImageFailures}). Sample: ${sample}`
        );
      }

      for (const sourceFeatured of payload.featuredProducts) {
        const productId = productLegacyIdToId.get(sourceFeatured.legacyProductId);
        if (!productId) {
          counters.featuredSkippedNoProduct += 1;
          continue;
        }

        const existing = await prisma.featuredProduct.findUnique({
          where: {
            tenantId_productId: {
              tenantId: tenant.id,
              productId
            }
          },
          select: { id: true }
        });

        await prisma.featuredProduct.upsert({
          where: {
            tenantId_productId: {
              tenantId: tenant.id,
              productId
            }
          },
          update: {
            sortOrder: typeof sourceFeatured.sortOrder === 'number' ? sourceFeatured.sortOrder : 0
          },
          create: {
            tenantId: tenant.id,
            productId,
            sortOrder: typeof sourceFeatured.sortOrder === 'number' ? sourceFeatured.sortOrder : 0
          }
        });

        if (existing) {
          counters.featuredUpdated += 1;
        } else {
          counters.featuredCreated += 1;
        }
      }

      if (!args.skipShares) {
        const existingShare = await prisma.publicShare.findFirst({
          where: {
            tenantId: tenant.id,
            resourceType: 'tenant_feed',
            resourceId: tenant.id
          },
          select: { id: true }
        });

        const shareToken = `shr_${createHash('sha1').update(`${tenant.id}:tenant_feed`).digest('hex').slice(0, 24)}`;

        await prisma.publicShare.upsert({
          where: {
            tenantId_resourceType_resourceId: {
              tenantId: tenant.id,
              resourceType: 'tenant_feed',
              resourceId: tenant.id
            }
          },
          update: {
            createdByUserId: ownerUser.id
          },
          create: {
            tenantId: tenant.id,
            resourceType: 'tenant_feed',
            resourceId: tenant.id,
            productId: null,
            createdByUserId: ownerUser.id,
            shareToken
          }
        });

        if (existingShare) {
          counters.sharesUpdated += 1;
        } else {
          counters.sharesCreated += 1;
        }
      }
    }

    const report = {
      runId: createHash('sha1')
        .update(`${Date.now()}|${args.input}|${args.tenantSlug}`)
        .digest('hex')
        .slice(0, 12),
      importedAt: new Date().toISOString(),
      mode: args.confirm ? 'write' : 'dry-run',
      env: args.env,
      tenantSlug: args.tenantSlug,
      tenantName: args.tenantName,
      adminEmail: args.adminEmail,
      input: resolve(args.input),
      sourceApiBaseUrl: payload.source?.apiBaseUrl ?? null,
      legacyImageBaseUrl: baseUrl ?? null,
      payloadVersion: payload.version,
      payloadCounts: payload.counts ?? {},
      validationIssues: payload.validationIssues ?? [],
      counters,
      imageBinaryFailures: imageBinaryFailures.slice(0, 100)
    };

    console.info('Sync summary:');
    console.info(JSON.stringify(report, null, 2));

    const outputDir = resolve(args.reportDir ?? dirname(resolve(args.input)));
    mkdirSync(outputDir, { recursive: true });
    const reportPath = resolve(outputDir, `sync-report-${report.runId}.json`);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.info(`- report: ${reportPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[turtle_album_v2_sync_tenant] failed');
  if (error instanceof Error) {
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(error);
  }
  process.exit(1);
});
