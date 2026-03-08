#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

function parseArgs(argv) {
  let exportJson = '';
  let tenantSlug = 'siri';
  let tenantId = null;
  let outputJson = null;
  let outputMd = null;
  let failOnMismatch = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--export-json') {
      exportJson = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--tenant-slug') {
      tenantSlug = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--tenant-id') {
      tenantId = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--output-json') {
      outputJson = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--output-md') {
      outputMd = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--fail-on-mismatch') {
      failOnMismatch = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!exportJson.trim()) {
    throw new Error('--export-json is required.');
  }

  return {
    exportJson: resolve(exportJson),
    tenantSlug: tenantSlug.trim(),
    tenantId: tenantId ? tenantId.trim() : null,
    outputJson: outputJson ? resolve(outputJson) : null,
    outputMd: outputMd ? resolve(outputMd) : null,
    failOnMismatch
  };
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function printHelpAndExit(code) {
  const text = [
    'Usage: node scripts/migrate/verify_turtle_album_alignment.mjs --export-json <path> [options]',
    '',
    'Options:',
    '  --tenant-slug <slug>      Target tenant slug (default: siri)',
    '  --tenant-id <id>          Target tenant id (takes precedence over slug)',
    '  --output-json <path>      Write verification JSON report',
    '  --output-md <path>        Write verification Markdown report',
    '  --fail-on-mismatch        Exit non-zero if key checks fail',
    '  -h, --help                Show help',
    '',
    'Env:',
    '  DATABASE_URL is required and must point to Eggturtle target DB.'
  ].join('\n');

  if (code === 0) {
    console.info(text);
  } else {
    console.error(text);
  }

  process.exit(code);
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCode(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeSeriesNameCodeFromName(name) {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || null;
}

function buildSeriesCode(input, index) {
  const byCode = normalizeCode(input.code);
  if (byCode) {
    return byCode;
  }

  const byName = normalizeString(input.name);
  if (byName) {
    const normalized = normalizeSeriesNameCodeFromName(byName);
    if (normalized) {
      return normalized;
    }
  }

  const fallbackLegacy = normalizeString(input.legacyId)
    ?.replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toUpperCase();
  if (fallbackLegacy) {
    return `SERIES-${fallbackLegacy}`;
  }

  return `SERIES-${String(index + 1).padStart(4, '0')}`;
}

function toIsoOrNull(value) {
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

function normalizeEventType(value, hasMateTransition) {
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

function buildEventNote(input) {
  const lines = [];

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

  return lines.length > 0 ? lines.join('\n') : '';
}

function parseExportPayload(path) {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.products)) {
    throw new Error(`Invalid export payload: products must be an array (${path}).`);
  }
  if (!Array.isArray(parsed.series)) {
    throw new Error(`Invalid export payload: series must be an array (${path}).`);
  }
  if (!Array.isArray(parsed.productImages)) {
    throw new Error(`Invalid export payload: productImages must be an array (${path}).`);
  }
  if (!Array.isArray(parsed.breeders)) {
    throw new Error(`Invalid export payload: breeders must be an array (${path}).`);
  }
  if (!Array.isArray(parsed.breederEvents)) {
    throw new Error(`Invalid export payload: breederEvents must be an array (${path}).`);
  }

  return parsed;
}

function ensureParent(path) {
  const parent = resolve(path, '..');
  mkdirSync(parent, { recursive: true });
}

function toEventSignature(input) {
  return `${input.code}\t${input.eventType}\t${input.eventDateIso}\t${input.note}`;
}

function buildMarkdownReport(report) {
  const lines = [];

  lines.push('# TurtleAlbum Migration Verification');
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Tenant: ${report.tenant.slug} (${report.tenant.id})`);
  lines.push(`- Export: ${report.export.path}`);
  lines.push('');

  lines.push('## Checks');
  lines.push('');
  lines.push(`- Product code coverage: ${report.checks.productCodeCoverage.pass ? 'PASS' : 'FAIL'}`);
  lines.push(`- Series code coverage: ${report.checks.seriesCodeCoverage.pass ? 'PASS' : 'FAIL'}`);
  lines.push(`- Event signature coverage: ${report.checks.eventSignatureCoverage.pass ? 'PASS' : 'FAIL'}`);
  lines.push(`- Product image row count: ${report.checks.productImageCount.pass ? 'PASS' : 'FAIL'}`);
  lines.push(`- Managed key consistency: ${report.checks.managedKeyConsistency.pass ? 'PASS' : 'FAIL'}`);
  lines.push('');

  lines.push('## Counts');
  lines.push('');
  lines.push(`- Source products: ${report.counts.source.products}`);
  lines.push(`- Target products: ${report.counts.target.products}`);
  lines.push(`- Source series: ${report.counts.source.series}`);
  lines.push(`- Target series: ${report.counts.target.series}`);
  lines.push(`- Source images: ${report.counts.source.productImages}`);
  lines.push(`- Target images: ${report.counts.target.productImages}`);
  lines.push(`- Source events: ${report.counts.source.productEvents}`);
  lines.push(`- Target events: ${report.counts.target.productEvents}`);
  lines.push('');

  if (report.diff.series.missingInTarget.length > 0) {
    lines.push('## Missing Series Codes In Target');
    lines.push('');
    for (const code of report.diff.series.missingInTarget) {
      lines.push(`- ${code}`);
    }
    lines.push('');
  }

  if (report.diff.products.missingInTarget.length > 0) {
    lines.push('## Missing Products In Target');
    lines.push('');
    for (const code of report.diff.products.missingInTarget) {
      lines.push(`- ${code}`);
    }
    lines.push('');
  }

  if (report.diff.events.missingInTarget.length > 0) {
    lines.push('## Missing Event Signatures In Target (Sample)');
    lines.push('');
    for (const signature of report.diff.events.missingInTarget.slice(0, 20)) {
      lines.push(`- ${signature}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const payload = parseExportPayload(args.exportJson);

  const prisma = new PrismaClient();

  try {
    const tenant = args.tenantId
      ? await prisma.tenant.findUnique({ where: { id: args.tenantId }, select: { id: true, slug: true, name: true } })
      : await prisma.tenant.findUnique({ where: { slug: args.tenantSlug }, select: { id: true, slug: true, name: true } });

    if (!tenant) {
      throw new Error(
        args.tenantId
          ? `Target tenant not found: id=${args.tenantId}`
          : `Target tenant not found: slug=${args.tenantSlug}`
      );
    }

    const tenantId = tenant.id;

    const [
      targetSeriesCount,
      targetProductCount,
      targetProductImageCount,
      targetProductEventCount,
      targetManagedImageCount,
      targetSharesCount,
      targetCouplePhotosCount,
      targetManagedCouplePhotosCount,
      targetSeries,
      targetProducts,
      targetProductEvents
    ] = await Promise.all([
      prisma.series.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId } }),
      prisma.productImage.count({ where: { tenantId } }),
      prisma.productEvent.count({ where: { tenantId } }),
      prisma.productImage.count({ where: { tenantId, key: { startsWith: `${tenantId}/` } } }),
      prisma.publicShare.count({ where: { tenantId } }),
      prisma.productCouplePhoto.count({ where: { tenantId } }),
      prisma.productCouplePhoto.count({ where: { tenantId, imageKey: { startsWith: `${tenantId}/` } } }),
      prisma.series.findMany({ where: { tenantId }, select: { code: true, name: true } }),
      prisma.product.findMany({ where: { tenantId }, select: { id: true, code: true, legacyBreederId: true } }),
      prisma.productEvent.findMany({
        where: { tenantId },
        select: {
          eventType: true,
          eventDate: true,
          note: true,
          product: {
            select: {
              code: true
            }
          }
        }
      })
    ]);

    const sourceProductCodes = new Set(
      payload.products.map((item) => normalizeCode(item.code)).filter((item) => item !== null)
    );
    const sourceSeriesCodes = new Set();
    const usedSeriesCodes = new Set();
    for (const [index, series] of payload.series.entries()) {
      let code = buildSeriesCode(series, index);
      if (usedSeriesCodes.has(code)) {
        code = `${code}-${index + 1}`;
      }
      usedSeriesCodes.add(code);
      sourceSeriesCodes.add(code);
    }

    const targetProductCodes = new Set(
      targetProducts.map((item) => normalizeCode(item.code)).filter((item) => item !== null)
    );
    const targetSeriesCodes = new Set(
      targetSeries.map((item) => normalizeCode(item.code)).filter((item) => item !== null)
    );

    const sourceProductsByLegacyId = new Map();
    for (const product of payload.products) {
      const legacyId = normalizeString(product.legacyId);
      const code = normalizeCode(product.code);
      if (legacyId && code) {
        sourceProductsByLegacyId.set(legacyId, code);
      }
    }

    const sourceBreedersByLegacyId = new Map();
    for (const breeder of payload.breeders) {
      const legacyId = normalizeString(breeder.legacyId);
      const code = normalizeCode(breeder.code);
      if (legacyId && code) {
        sourceBreedersByLegacyId.set(legacyId, code);
      }
    }

    const sourceEventSignatures = new Set();
    let sourceEventsSkippedNoCode = 0;
    let sourceEventsSkippedInvalidDate = 0;

    for (const sourceEvent of payload.breederEvents) {
      const legacyBreederId = normalizeString(sourceEvent.legacyBreederId);
      if (!legacyBreederId) {
        sourceEventsSkippedNoCode += 1;
        continue;
      }

      const code = sourceBreedersByLegacyId.get(legacyBreederId) ?? sourceProductsByLegacyId.get(legacyBreederId);
      if (!code) {
        sourceEventsSkippedNoCode += 1;
        continue;
      }

      const eventDateIso = toIsoOrNull(sourceEvent.eventDate);
      if (!eventDateIso) {
        sourceEventsSkippedInvalidDate += 1;
        continue;
      }

      const eventType = normalizeEventType(
        sourceEvent.eventType,
        Boolean(normalizeCode(sourceEvent.oldMateCode) || normalizeCode(sourceEvent.newMateCode))
      );
      const note = buildEventNote(sourceEvent);

      sourceEventSignatures.add(
        toEventSignature({
          code,
          eventType,
          eventDateIso,
          note
        })
      );
    }

    const targetEventSignatures = new Set();
    for (const event of targetProductEvents) {
      const code = normalizeCode(event.product?.code);
      if (!code) {
        continue;
      }

      targetEventSignatures.add(
        toEventSignature({
          code,
          eventType: event.eventType,
          eventDateIso: event.eventDate.toISOString(),
          note: normalizeString(event.note) ?? ''
        })
      );
    }

    const missingProductsInTarget = [...sourceProductCodes].filter((code) => !targetProductCodes.has(code)).sort();
    const extraProductsInTarget = [...targetProductCodes].filter((code) => !sourceProductCodes.has(code)).sort();
    const missingSeriesInTarget = [...sourceSeriesCodes].filter((code) => !targetSeriesCodes.has(code)).sort();
    const extraSeriesInTarget = [...targetSeriesCodes].filter((code) => !sourceSeriesCodes.has(code)).sort();

    const missingEventsInTarget = [...sourceEventSignatures]
      .filter((signature) => !targetEventSignatures.has(signature))
      .sort();
    const extraEventsInTarget = [...targetEventSignatures]
      .filter((signature) => !sourceEventSignatures.has(signature))
      .sort();

    const sourceProductsCount = payload.products.length;
    const sourceProductImagesCount = payload.productImages.length;
    const sourceProductEventsCount = sourceEventSignatures.size;

    const checks = {
      productCodeCoverage: {
        pass: missingProductsInTarget.length === 0,
        missingInTarget: missingProductsInTarget.length,
        extraInTarget: extraProductsInTarget.length
      },
      seriesCodeCoverage: {
        pass: missingSeriesInTarget.length === 0,
        missingInTarget: missingSeriesInTarget.length,
        extraInTarget: extraSeriesInTarget.length
      },
      eventSignatureCoverage: {
        pass: missingEventsInTarget.length === 0 && extraEventsInTarget.length === 0,
        missingInTarget: missingEventsInTarget.length,
        extraInTarget: extraEventsInTarget.length,
        sourceEventsSkippedNoCode,
        sourceEventsSkippedInvalidDate
      },
      productImageCount: {
        pass: targetProductImageCount >= sourceProductImagesCount,
        source: sourceProductImagesCount,
        target: targetProductImageCount
      },
      managedKeyConsistency: {
        pass:
          targetManagedImageCount === targetProductImageCount &&
          targetManagedCouplePhotosCount === targetCouplePhotosCount,
        productImagesManaged: targetManagedImageCount,
        productImagesTotal: targetProductImageCount,
        couplePhotosManaged: targetManagedCouplePhotosCount,
        couplePhotosTotal: targetCouplePhotosCount
      }
    };

    const report = {
      generatedAt: new Date().toISOString(),
      export: {
        path: args.exportJson,
        version: payload.version ?? null,
        exportedAt: payload.exportedAt ?? null
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name
      },
      counts: {
        source: {
          series: Array.isArray(payload.series) ? payload.series.length : 0,
          products: sourceProductsCount,
          productImages: sourceProductImagesCount,
          productEvents: sourceProductEventsCount
        },
        target: {
          series: targetSeriesCount,
          products: targetProductCount,
          productImages: targetProductImageCount,
          productEvents: targetProductEventCount,
          publicShares: targetSharesCount,
          productCouplePhotos: targetCouplePhotosCount
        }
      },
      checks,
      diff: {
        series: {
          missingInTarget: missingSeriesInTarget,
          extraInTarget: extraSeriesInTarget
        },
        products: {
          missingInTarget: missingProductsInTarget,
          extraInTarget: extraProductsInTarget
        },
        events: {
          missingInTarget: missingEventsInTarget,
          extraInTarget: extraEventsInTarget
        }
      }
    };

    console.info(JSON.stringify(report, null, 2));

    if (args.outputJson) {
      ensureParent(args.outputJson);
      writeFileSync(args.outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }

    if (args.outputMd) {
      ensureParent(args.outputMd);
      writeFileSync(args.outputMd, buildMarkdownReport(report), 'utf8');
    }

    if (
      args.failOnMismatch &&
      (!checks.productCodeCoverage.pass ||
        !checks.seriesCodeCoverage.pass ||
        !checks.eventSignatureCoverage.pass ||
        !checks.productImageCount.pass ||
        !checks.managedKeyConsistency.pass)
    ) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[verify_turtle_album_alignment] failed');
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
