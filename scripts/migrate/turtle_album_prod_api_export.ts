#!/usr/bin/env ts-node

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type CliArgs = {
  apiBaseUrl: string;
  username: string;
  password: string;
  outputRoot: string;
  runId: string;
  timeoutMs: number;
  confirm: boolean;
};

type LegacyApiUser = {
  id?: string;
  username?: string;
  role?: string;
};

type LegacySeries = {
  id: string;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type LegacyProductImage = {
  id?: string;
  url?: string | null;
  type?: string | null;
  sort_order?: number | null;
  sortOrder?: number | null;
  createdAt?: string | null;
};

type LegacyProduct = {
  id: string;
  code?: string | null;
  description?: string | null;
  seriesId?: string | null;
  sex?: string | null;
  sireCode?: string | null;
  damCode?: string | null;
  mateCode?: string | null;
  excludeFromBreeding?: boolean | null;
  inStock?: boolean | null;
  isFeatured?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  images?: LegacyProductImage[];
};

type LegacyBreeder = {
  id: string;
  code?: string | null;
  description?: string | null;
  seriesId?: string | null;
  sex?: string | null;
  sireCode?: string | null;
  damCode?: string | null;
  mateCode?: string | null;
  excludeFromBreeding?: boolean | null;
  inStock?: boolean | null;
  isFeatured?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type LegacyBreederEvent = {
  id?: string;
  productId?: string;
  eventType?: string | null;
  eventDate?: string | null;
  maleCode?: string | null;
  eggCount?: number | null;
  note?: string | null;
  oldMateCode?: string | null;
  newMateCode?: string | null;
  createdAt?: string | null;
};

type LegacyFeaturedProduct = {
  id?: string;
  productId?: string;
  sortOrder?: number | null;
  isActive?: boolean | null;
};

type ExportedUser = {
  legacyId: string | null;
  username: string;
  role: string | null;
  isActive: boolean;
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
  version: 2;
  exportedAt: string;
  source: {
    type: 'turtle_album_api';
    mode: 'production_read';
    apiBaseUrl: string;
    endpoints: string[];
  };
  tenant: {
    legacyMode: 'single_tenant';
    suggestedSlug: string;
    suggestedName: string;
  };
  users: ExportedUser[];
  series: ExportedSeries[];
  products: ExportedProduct[];
  productImages: ExportedProductImage[];
  breeders: ExportedBreeder[];
  breederEvents: ExportedBreederEvent[];
  featuredProducts: ExportedFeaturedProduct[];
  shareSeeds: ExportedShareSeed[];
  counts: Record<string, number>;
  validationIssues: string[];
};

const DEFAULT_API_BASE_URL =
  process.env.TURTLE_ALBUM_API_BASE_URL ?? 'https://qmngzrlhklmt.sealoshzh.site';
const DEFAULT_OUTPUT_ROOT = './out/migrate/turtle_album_prod';

function parseArgs(argv: string[]): CliArgs {
  let apiBaseUrl = DEFAULT_API_BASE_URL;
  let username = process.env.TURTLE_ALBUM_API_USERNAME ?? '';
  let password = process.env.TURTLE_ALBUM_API_PASSWORD ?? '';
  let outputRoot = DEFAULT_OUTPUT_ROOT;
  let runId = buildRunId(new Date());
  let timeoutMs = 20_000;
  let confirm = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--api-base-url') {
      apiBaseUrl = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--username') {
      username = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--password') {
      password = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--output-root') {
      outputRoot = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--run-id') {
      runId = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--timeout-ms') {
      const next = requireValue(argv, index, arg);
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 1000) {
        throw new Error('--timeout-ms must be a number >= 1000.');
      }
      timeoutMs = Math.floor(parsed);
      index += 1;
      continue;
    }

    if (arg === '--confirm') {
      confirm = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  apiBaseUrl = normalizeBaseUrl(apiBaseUrl);
  if (!apiBaseUrl.startsWith('http://') && !apiBaseUrl.startsWith('https://')) {
    throw new Error('--api-base-url must start with http:// or https://');
  }

  if (!username.trim()) {
    throw new Error(
      'Missing username. Use --username or set TURTLE_ALBUM_API_USERNAME in your shell environment.'
    );
  }

  if (!password.trim()) {
    throw new Error(
      'Missing password. Use --password or set TURTLE_ALBUM_API_PASSWORD in your shell environment.'
    );
  }

  if (!runId.trim()) {
    throw new Error('--run-id cannot be empty.');
  }

  return {
    apiBaseUrl,
    username: username.trim(),
    password,
    outputRoot,
    runId: runId.trim(),
    timeoutMs,
    confirm
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
    'Usage: ts-node scripts/migrate/turtle_album_prod_api_export.ts [options]',
    '',
    'Options:',
    `  --api-base-url <url>     TurtleAlbum API base URL (default: ${DEFAULT_API_BASE_URL})`,
    '  --username <name>        API login username (or TURTLE_ALBUM_API_USERNAME)',
    '  --password <value>       API login password (or TURTLE_ALBUM_API_PASSWORD)',
    `  --output-root <path>     Output root dir (default: ${DEFAULT_OUTPUT_ROOT})`,
    '  --run-id <id>            Output run id (default: yyyymmdd-hhmmss)',
    '  --timeout-ms <number>    HTTP timeout in milliseconds (default: 20000)',
    '  --confirm                Write export.json/summary.json files (default is dry-run)',
    '  -h, --help               Show help',
    '',
    'Safety:',
    '- Script is read-only against TurtleAlbum API.',
    '- File output is disabled unless --confirm is set.'
  ];

  const output = lines.join('\n');
  if (code === 0) {
    console.info(output);
  } else {
    console.error(output);
  }

  process.exit(code);
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function buildRunId(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

async function apiRequest<T>(
  args: CliArgs,
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const url = `${args.apiBaseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    const rawText = await response.text();
    const payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};

    if (!response.ok) {
      const detail = typeof payload.detail === 'string' ? payload.detail : rawText;
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${path}: ${detail}`);
    }

    if (payload.success === false) {
      const message = typeof payload.message === 'string' ? payload.message : 'API returned success=false';
      throw new Error(`API error for ${path}: ${message}`);
    }

    if (!('data' in payload)) {
      return payload as T;
    }

    return payload.data as T;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${args.timeoutMs}ms: ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function login(args: CliArgs): Promise<{ token: string; user: LegacyApiUser }> {
  const data = await apiRequest<{ token?: string; user?: LegacyApiUser }>(args, '/api/auth/login', {
    method: 'POST',
    body: {
      username: args.username,
      password: args.password
    }
  });

  const token = data.token?.trim();
  if (!token) {
    throw new Error('Login succeeded but token is missing in /api/auth/login response.');
  }

  return {
    token,
    user: data.user ?? {}
  };
}

async function fetchAllProducts(args: CliArgs, token: string): Promise<LegacyProduct[]> {
  const products: LegacyProduct[] = [];
  const seen = new Set<string>();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await apiRequest<{
      products?: LegacyProduct[];
      total?: number;
      page?: number;
      totalPages?: number;
    }>(args, `/api/products?page=${page}&limit=500`, { token });

    const pageItems = Array.isArray(data.products) ? data.products : [];
    for (const item of pageItems) {
      const key = String(item.id ?? '').trim();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      products.push(item);
    }

    const nextTotalPages = Number(data.totalPages ?? 1);
    totalPages = Number.isFinite(nextTotalPages) && nextTotalPages > 0 ? Math.floor(nextTotalPages) : 1;
    page += 1;
  }

  return products;
}

async function fetchSeries(args: CliArgs, token: string): Promise<{ series: LegacySeries[]; source: string }> {
  try {
    const adminSeries = await apiRequest<LegacySeries[]>(
      args,
      '/api/admin/series?include_inactive=true',
      { token }
    );

    return {
      series: Array.isArray(adminSeries) ? adminSeries : [],
      source: 'admin'
    };
  } catch {
    const publicSeries = await apiRequest<LegacySeries[]>(args, '/api/series', { token });
    return {
      series: Array.isArray(publicSeries) ? publicSeries : [],
      source: 'public'
    };
  }
}

async function fetchBreeders(args: CliArgs, token: string): Promise<LegacyBreeder[]> {
  const data = await apiRequest<LegacyBreeder[]>(args, '/api/breeders?limit=1000', { token });
  return Array.isArray(data) ? data : [];
}

async function fetchBreederEvents(
  args: CliArgs,
  token: string,
  breederId: string
): Promise<LegacyBreederEvent[]> {
  const events: LegacyBreederEvent[] = [];
  let cursor: string | null = null;
  let page = 0;

  while (page < 500) {
    const endpointPath: string = cursor
      ? `/api/breeders/${encodeURIComponent(breederId)}/events?limit=100&cursor=${encodeURIComponent(cursor)}`
      : `/api/breeders/${encodeURIComponent(breederId)}/events?limit=100`;

    const data: {
      items?: LegacyBreederEvent[];
      nextCursor?: string | null;
      hasMore?: boolean;
    } = await apiRequest(args, endpointPath, { token });

    const items = Array.isArray(data.items) ? data.items : [];
    for (const item of items) {
      events.push(item);
    }

    if (!data.hasMore || !data.nextCursor) {
      break;
    }

    cursor = data.nextCursor;
    page += 1;
  }

  return events;
}

async function fetchFeaturedProducts(args: CliArgs, token: string): Promise<LegacyFeaturedProduct[]> {
  const data = await apiRequest<LegacyFeaturedProduct[]>(args, '/api/featured-products', { token });
  return Array.isArray(data) ? data : [];
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }

  return fallback;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function collectValidationIssues(payload: ExportPayload): string[] {
  const issues: string[] = [];

  const productCodeSet = new Set<string>();
  for (const product of payload.products) {
    const code = (product.code ?? '').toLowerCase();
    if (!code) {
      issues.push(`product ${product.legacyId} has empty code`);
      continue;
    }
    if (productCodeSet.has(code)) {
      issues.push(`duplicate product code: ${product.code}`);
      continue;
    }
    productCodeSet.add(code);
  }

  const breederCodeSet = new Set<string>();
  for (const breeder of payload.breeders) {
    const code = (breeder.code ?? '').toLowerCase();
    if (!code) {
      issues.push(`breeder ${breeder.legacyId} has empty code`);
      continue;
    }
    if (breederCodeSet.has(code)) {
      issues.push(`duplicate breeder code: ${breeder.code}`);
      continue;
    }
    breederCodeSet.add(code);

    if (!breeder.seriesLegacyId) {
      issues.push(`breeder ${breeder.legacyId} is missing seriesLegacyId`);
    }
  }

  const productIdSet = new Set(payload.products.map((item) => item.legacyId));
  for (const image of payload.productImages) {
    if (!image.url) {
      issues.push(`productImage ${image.legacyId} has empty url`);
    }
    if (!productIdSet.has(image.legacyProductId)) {
      issues.push(
        `productImage ${image.legacyId} references missing product ${image.legacyProductId}`
      );
    }
  }

  const breederIdSet = new Set(payload.breeders.map((item) => item.legacyId));
  for (const event of payload.breederEvents) {
    if (!breederIdSet.has(event.legacyBreederId)) {
      issues.push(`event ${event.legacyId} references missing breeder ${event.legacyBreederId}`);
    }
    if (!event.eventDate) {
      issues.push(`event ${event.legacyId} has empty eventDate`);
    }
  }

  return issues;
}

function printPlan(args: CliArgs, payload: ExportPayload, seriesSource: string): void {
  console.info('Export plan:');
  console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
  console.info(`- source api: ${args.apiBaseUrl}`);
  console.info(`- series source: ${seriesSource}`);
  console.info(`- run id: ${args.runId}`);
  console.info(`- output root: ${resolve(args.outputRoot)}`);
  console.info('- counts:');
  for (const [key, value] of Object.entries(payload.counts)) {
    console.info(`  - ${key}: ${value}`);
  }

  if (payload.validationIssues.length > 0) {
    console.info(`- validation issues: ${payload.validationIssues.length}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const loginResult = await login(args);
  const token = loginResult.token;

  const verifiedUser = await apiRequest<LegacyApiUser>(args, '/api/auth/verify', { token });
  const products = await fetchAllProducts(args, token);
  const seriesResult = await fetchSeries(args, token);
  const breeders = await fetchBreeders(args, token);
  const featuredProducts = await fetchFeaturedProducts(args, token);

  const breederEvents: ExportedBreederEvent[] = [];
  for (const breeder of breeders) {
    const breederId = normalizeString(breeder.id);
    if (!breederId) {
      continue;
    }

    const events = await fetchBreederEvents(args, token, breederId);
    for (const [index, event] of events.entries()) {
      const legacyEventId = normalizeString(event.id) ?? `${breederId}-event-${index + 1}`;

      breederEvents.push({
        legacyId: legacyEventId,
        legacyBreederId: breederId,
        eventType: normalizeString(event.eventType),
        eventDate: normalizeString(event.eventDate),
        maleCode: normalizeString(event.maleCode),
        eggCount: typeof event.eggCount === 'number' ? event.eggCount : null,
        note: normalizeString(event.note),
        oldMateCode: normalizeString(event.oldMateCode),
        newMateCode: normalizeString(event.newMateCode),
        createdAt: normalizeString(event.createdAt)
      });
    }
  }

  const exportedUsers: ExportedUser[] = [];
  const candidateUsers: LegacyApiUser[] = [loginResult.user, verifiedUser];
  const seenUsers = new Set<string>();

  for (const candidate of candidateUsers) {
    const username = normalizeString(candidate.username);
    if (!username || seenUsers.has(username.toLowerCase())) {
      continue;
    }

    seenUsers.add(username.toLowerCase());
    exportedUsers.push({
      legacyId: normalizeString(candidate.id),
      username,
      role: normalizeString(candidate.role),
      isActive: true
    });
  }

  const exportedSeries: ExportedSeries[] = seriesResult.series.map((item) => ({
    legacyId: String(item.id),
    code: normalizeString(item.code),
    name: normalizeString(item.name),
    description: normalizeString(item.description),
    sortOrder: toNumber(item.sortOrder, 0),
    isActive: toBoolean(item.isActive, true),
    createdAt: normalizeString(item.createdAt),
    updatedAt: normalizeString(item.updatedAt)
  }));

  const exportedProducts: ExportedProduct[] = products.map((item) => ({
    legacyId: String(item.id),
    code: normalizeString(item.code),
    description: normalizeString(item.description),
    seriesLegacyId: normalizeString(item.seriesId),
    sex: normalizeString(item.sex),
    sireCode: normalizeString(item.sireCode),
    damCode: normalizeString(item.damCode),
    mateCode: normalizeString(item.mateCode),
    excludeFromBreeding: toBoolean(item.excludeFromBreeding, false),
    inStock: toBoolean(item.inStock, true),
    isFeatured: toBoolean(item.isFeatured, false),
    createdAt: normalizeString(item.createdAt),
    updatedAt: normalizeString(item.updatedAt)
  }));

  const exportedProductImages: ExportedProductImage[] = [];
  for (const product of products) {
    const productId = normalizeString(product.id);
    if (!productId) {
      continue;
    }

    const images = Array.isArray(product.images) ? product.images : [];
    for (const [index, image] of images.entries()) {
      const fallbackImageId = `${productId}-image-${index + 1}`;
      exportedProductImages.push({
        legacyId: normalizeString(image.id) ?? fallbackImageId,
        legacyProductId: productId,
        url: normalizeString(image.url),
        type: normalizeString(image.type),
        sortOrder: toNumber(image.sort_order ?? image.sortOrder, index),
        createdAt: normalizeString(image.createdAt)
      });
    }
  }

  const exportedBreeders: ExportedBreeder[] = breeders.map((item) => ({
    legacyId: String(item.id),
    code: normalizeString(item.code),
    description: normalizeString(item.description),
    seriesLegacyId: normalizeString(item.seriesId),
    sex: normalizeString(item.sex),
    sireCode: normalizeString(item.sireCode),
    damCode: normalizeString(item.damCode),
    mateCode: normalizeString(item.mateCode),
    excludeFromBreeding: toBoolean(item.excludeFromBreeding, false),
    inStock: toBoolean(item.inStock, true),
    isFeatured: toBoolean(item.isFeatured, false),
    createdAt: normalizeString(item.createdAt),
    updatedAt: normalizeString(item.updatedAt)
  }));

  const exportedFeaturedProducts: ExportedFeaturedProduct[] = featuredProducts
    .filter((item) => normalizeString(item.productId))
    .map((item, index) => ({
      legacyId: normalizeString(item.id) ?? `featured-${index + 1}`,
      legacyProductId: normalizeString(item.productId)!,
      sortOrder: toNumber(item.sortOrder, index),
      isActive: toBoolean(item.isActive, true)
    }));

  const shareSeedSet = new Set<string>();
  const exportedShareSeeds: ExportedShareSeed[] = [];
  for (const featured of exportedFeaturedProducts) {
    if (!featured.isActive || shareSeedSet.has(featured.legacyProductId)) {
      continue;
    }

    shareSeedSet.add(featured.legacyProductId);
    exportedShareSeeds.push({
      legacyProductId: featured.legacyProductId,
      strategy: 'featured_product'
    });
  }

  const payload: ExportPayload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    source: {
      type: 'turtle_album_api',
      mode: 'production_read',
      apiBaseUrl: args.apiBaseUrl,
      endpoints: [
        '/api/auth/login',
        '/api/auth/verify',
        '/api/admin/series?include_inactive=true',
        '/api/products?page=1&limit=500',
        '/api/breeders?limit=1000',
        '/api/breeders/{id}/events?limit=100',
        '/api/featured-products'
      ]
    },
    tenant: {
      legacyMode: 'single_tenant',
      suggestedSlug: 'turtle-album',
      suggestedName: 'Turtle Album'
    },
    users: exportedUsers,
    series: exportedSeries,
    products: exportedProducts,
    productImages: exportedProductImages,
    breeders: exportedBreeders,
    breederEvents,
    featuredProducts: exportedFeaturedProducts,
    shareSeeds: exportedShareSeeds,
    counts: {
      users: exportedUsers.length,
      series: exportedSeries.length,
      products: exportedProducts.length,
      productImages: exportedProductImages.length,
      breeders: exportedBreeders.length,
      breederEvents: breederEvents.length,
      featuredProducts: exportedFeaturedProducts.length,
      shareSeeds: exportedShareSeeds.length,
      validationIssues: 0
    },
    validationIssues: []
  };

  if (seriesResult.source !== 'admin') {
    payload.validationIssues.push(
      'Series was exported from public endpoint. series.code may be missing for some records.'
    );
  }

  const validationIssues = collectValidationIssues(payload);
  payload.validationIssues.push(...validationIssues);
  payload.counts.validationIssues = payload.validationIssues.length;

  printPlan(args, payload, seriesResult.source);

  if (!args.confirm) {
    console.info('No files written. Re-run with --confirm to write export files.');
    return;
  }

  const outputDir = resolve(args.outputRoot, args.runId);
  mkdirSync(outputDir, { recursive: true });

  const exportPath = resolve(outputDir, 'export.json');
  const summaryPath = resolve(outputDir, 'summary.json');

  writeFileSync(exportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        runId: args.runId,
        exportedAt: payload.exportedAt,
        apiBaseUrl: args.apiBaseUrl,
        counts: payload.counts,
        validationIssues: payload.validationIssues
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  console.info('Export complete');
  console.info(`- export: ${exportPath}`);
  console.info(`- summary: ${summaryPath}`);
}

main().catch((error: unknown) => {
  console.error('Export failed');
  console.error(error);
  process.exitCode = 1;
});
