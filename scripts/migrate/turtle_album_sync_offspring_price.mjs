#!/usr/bin/env node

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadPrismaRuntime() {
  try {
    return require('@prisma/client');
  } catch {
    return require('../../apps/api/node_modules/@prisma/client');
  }
}

const { PrismaClient } = loadPrismaRuntime();

const DEFAULT_API_BASE_URL = 'https://qmngzrlhklmt.sealoshzh.site';
const DEFAULT_PAGE_SIZE = 100;

function parseArgs(argv) {
  const args = {
    apiBaseUrl: DEFAULT_API_BASE_URL,
    tenantId: '',
    pageSize: DEFAULT_PAGE_SIZE,
    updateMode: 'fill-null',
    confirm: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--api-base-url') {
      args.apiBaseUrl = requireValue(argv, i, arg);
      i += 1;
      continue;
    }

    if (arg === '--tenant-id') {
      args.tenantId = requireValue(argv, i, arg);
      i += 1;
      continue;
    }

    if (arg === '--page-size') {
      const raw = requireValue(argv, i, arg);
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 500) {
        throw new Error('--page-size must be a number between 1 and 500.');
      }
      args.pageSize = Math.floor(parsed);
      i += 1;
      continue;
    }

    if (arg === '--update-mode') {
      const mode = requireValue(argv, i, arg);
      if (mode !== 'fill-null' && mode !== 'overwrite') {
        throw new Error('--update-mode must be one of: fill-null, overwrite.');
      }
      args.updateMode = mode;
      i += 1;
      continue;
    }

    if (arg === '--confirm') {
      args.confirm = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.tenantId.trim()) {
    throw new Error('--tenant-id is required.');
  }

  return args;
}

function requireValue(argv, index, arg) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${arg} requires a value.`);
  }
  return value;
}

function normalizeCode(value) {
  return (value || '').trim().toUpperCase();
}

function parseRemotePrice(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

async function fetchRemoteProducts(apiBaseUrl, pageSize) {
  const all = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = new URL('/api/products', apiBaseUrl);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(pageSize));

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page ${page}: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const data = payload?.data || {};
    const products = Array.isArray(data.products) ? data.products : [];

    all.push(...products);

    const parsedTotalPages = Number(data.totalPages || 1);
    totalPages = Number.isFinite(parsedTotalPages) && parsedTotalPages > 0 ? parsedTotalPages : 1;
    page += 1;
  }

  return all;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    console.info('[1/4] Fetching remote products...');
    const remoteProducts = await fetchRemoteProducts(args.apiBaseUrl, args.pageSize);

    const remoteByCode = new Map();
    for (const item of remoteProducts) {
      const code = normalizeCode(item.code);
      if (!code) {
        continue;
      }

      const remotePrice = parseRemotePrice(item.offspringUnitPrice);
      if (remotePrice === null) {
        continue;
      }

      // Prefer latest updatedAt if duplicate code appears.
      const existing = remoteByCode.get(code);
      const updatedAt = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      if (!existing || updatedAt >= existing.updatedAtMs) {
        remoteByCode.set(code, {
          code,
          sex: item.sex || null,
          remotePrice,
          updatedAtMs: updatedAt,
        });
      }
    }

    console.info(`[remote] products fetched: ${remoteProducts.length}`);
    console.info(`[remote] codes with offspring price: ${remoteByCode.size}`);

    console.info('[2/4] Loading local tenant products...');
    const localProducts = await prisma.product.findMany({
      where: { tenantId: args.tenantId },
      select: {
        id: true,
        code: true,
        sex: true,
        offspringUnitPrice: true,
      },
    });

    const localByCode = new Map();
    for (const item of localProducts) {
      const code = normalizeCode(item.code);
      if (!code) {
        continue;
      }
      localByCode.set(code, item);
    }

    console.info(`[local] tenant products: ${localProducts.length}`);

    console.info('[3/4] Building migration plan...');
    const plan = [];
    const missingInLocal = [];
    const skippedNonFemale = [];
    const alreadyHasPrice = [];

    for (const [code, remote] of remoteByCode.entries()) {
      const local = localByCode.get(code);
      if (!local) {
        missingInLocal.push(code);
        continue;
      }

      const localSex = (local.sex || '').trim().toLowerCase();
      if (localSex && localSex !== 'female') {
        skippedNonFemale.push(code);
        continue;
      }

      const localPrice = local.offspringUnitPrice === null ? null : Number(local.offspringUnitPrice);
      const shouldUpdate =
        args.updateMode === 'overwrite'
          ? localPrice !== remote.remotePrice
          : localPrice === null;

      if (shouldUpdate) {
        plan.push({
          id: local.id,
          code,
          fromPrice: localPrice,
          toPrice: remote.remotePrice,
        });
      } else {
        alreadyHasPrice.push(code);
      }
    }

    console.info(`[plan] updates: ${plan.length}`);
    console.info(`[plan] skip: local missing code = ${missingInLocal.length}`);
    console.info(`[plan] skip: non-female local = ${skippedNonFemale.length}`);
    console.info(`[plan] skip: already has price = ${alreadyHasPrice.length}`);

    const preview = plan.slice(0, 20).map((item) => ({
      code: item.code,
      from: item.fromPrice,
      to: item.toPrice,
    }));

    console.info('[plan preview] first up to 20 rows:');
    console.info(JSON.stringify(preview, null, 2));

    if (!args.confirm) {
      console.info('[4/4] Dry-run only. Re-run with --confirm to apply changes.');
      return;
    }

    console.info('[4/4] Applying updates...');
    for (const item of plan) {
      await prisma.product.update({
        where: { id: item.id },
        data: {
          offspringUnitPrice: item.toPrice,
        },
      });
    }

    const pricedAfter = await prisma.product.count({
      where: {
        tenantId: args.tenantId,
        offspringUnitPrice: { not: null },
      },
    });

    console.info(`[done] updated rows: ${plan.length}`);
    console.info(`[done] local priced products after migration: ${pricedAfter}`);
  } finally {
    await prisma.$disconnect();
  }
}

function printHelp() {
  console.info(`Usage:
  node scripts/migrate/turtle_album_sync_offspring_price.mjs \\
    --tenant-id <tenantId> \\
    [--api-base-url <url>] \\
    [--page-size <n>] \\
    [--update-mode fill-null|overwrite] \\
    [--confirm]

Defaults:
  --api-base-url ${DEFAULT_API_BASE_URL}
  --page-size ${DEFAULT_PAGE_SIZE}
  --update-mode fill-null

Notes:
  - Default mode is dry-run.
  - Use --confirm to actually write database updates.
  - Matching key is normalized product code (uppercased + trimmed).
`);
}

main().catch((error) => {
  console.error('[fatal]', error?.message || error);
  process.exit(1);
});
