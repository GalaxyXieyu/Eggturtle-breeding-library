#!/usr/bin/env ts-node
// @ts-nocheck

import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

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

const dotenv = loadDotenvRuntime();
const { PrismaClient } = loadPrismaRuntime();

for (const file of [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/api/.env'),
  resolve(process.cwd(), 'apps/api/.env.local')
]) {
  dotenv.config({ path: file, override: false });
}

function parseArgs(argv) {
  let confirm = false;
  let report;
  let reportPrefix;
  let tenantSlug;
  const reasonExact = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--confirm') {
      confirm = true;
      continue;
    }
    if (arg === '--report') {
      report = argv[++i];
      if (!report) throw new Error('--report requires a value.');
      continue;
    }
    if (arg === '--report-prefix') {
      reportPrefix = argv[++i];
      if (!reportPrefix) throw new Error('--report-prefix requires a value.');
      continue;
    }
    if (arg === '--tenant-slug') {
      tenantSlug = argv[++i];
      if (!tenantSlug) throw new Error('--tenant-slug requires a value.');
      continue;
    }
    if (arg === '--reason-exact') {
      const value = argv[++i];
      if (!value) throw new Error('--reason-exact requires a value.');
      reasonExact.push(value);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      const help = [
        'Usage: ts-node scripts/migrate/cleanup_invalid_product_images_from_report.ts [options]',
        '',
        'Delete product_images rows based on failure items in a report json.',
        'Default mode is dry-run; add --confirm to execute deletes.',
        '',
        'Options:',
        '  --report <path>             Explicit report json',
        '  --report-prefix <prefix>    Report filename prefix (default: external-product-images-)',
        '  --tenant-slug <slug>        Filter to one tenant slug',
        '  --reason-exact <reason>     Exact error reason to match (repeatable)',
        '  --confirm                   Execute deletions'
      ].join('\n');
      console.info(help);
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { confirm, report, reportPrefix, tenantSlug, reasonExact };
}

function toTimestampLabel(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function resolveLatestReportPath(baseDir, prefix) {
  const files = (await readdir(baseDir)).filter((name) => name.startsWith(prefix)).sort();
  const latest = files[files.length - 1];
  if (!latest) throw new Error(`No report found in ${baseDir} with prefix ${prefix}`);
  return resolve(baseDir, latest);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const reportDir = resolve(process.cwd(), 'out/migration-reports');
  const startedAt = new Date();

  try {
    const reportPrefix = args.reportPrefix?.trim() || 'external-product-images-';
    const reasons = args.reasonExact.length > 0 ? args.reasonExact : ['HTTP 404 Not Found', 'Stored object was not found.'];
    const reportPath = args.report ? resolve(process.cwd(), args.report) : await resolveLatestReportPath(reportDir, reportPrefix);
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    const failedItems = (report.items ?? []).filter(
      (item) => item.status === 'error' && reasons.includes(item.reason) && (!args.tenantSlug || item.tenantSlug === args.tenantSlug)
    );

    console.info('Cleanup invalid product images plan:');
    console.info(`- mode: ${args.confirm ? 'WRITE' : 'DRY-RUN (default)'}`);
    console.info(`- report: ${reportPath}`);
    console.info(`- reportPrefix: ${reportPrefix}`);
    console.info(`- tenant: ${args.tenantSlug ?? 'ALL'}`);
    console.info(`- reasons: ${reasons.join(' | ')}`);
    console.info(`- delete candidates: ${failedItems.length}`);

    const imageIds = failedItems.map((item) => item.imageId);
    if (imageIds.length === 0) {
      console.info('No matching failed items to clean up.');
      return;
    }

    const existingRows = await prisma.productImage.findMany({
      where: { id: { in: imageIds } },
      orderBy: [{ createdAt: 'asc' }]
    });

    await mkdir(reportDir, { recursive: true });
    const backupPath = resolve(reportDir, `cleanup-invalid-product-images-backup-${toTimestampLabel(startedAt)}.json`);
    await writeFile(
      backupPath,
      JSON.stringify(
        {
          startedAt: startedAt.toISOString(),
          reportPath,
          reportPrefix,
          tenantSlug: args.tenantSlug ?? null,
          reasons,
          imageIds,
          rows: existingRows.map((row) => ({
            ...row,
            sizeBytes: row.sizeBytes?.toString?.() ?? null,
            createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
            updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt
          }))
        },
        null,
        2
      ),
      'utf8'
    );
    console.info(`- backup: ${backupPath}`);

    if (!args.confirm) {
      console.info('Dry-run complete. No rows deleted.');
      return;
    }

    let deletedCount = 0;
    for (const row of existingRows) {
      await prisma.$transaction(async (tx) => {
        const current = await tx.productImage.findUnique({ where: { id: row.id } });
        if (!current) return;

        await tx.productImage.delete({ where: { id: current.id } });

        if (!current.isMain) return;

        const nextMain = await tx.productImage.findFirst({
          where: { tenantId: current.tenantId, productId: current.productId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
        });

        if (!nextMain || nextMain.isMain) return;

        await tx.productImage.update({
          where: { id: nextMain.id },
          data: { isMain: true }
        });
      });
      deletedCount += 1;
    }

    const resultPath = resolve(reportDir, `cleanup-invalid-product-images-result-${toTimestampLabel(startedAt)}.json`);
    await writeFile(
      resultPath,
      JSON.stringify(
        {
          startedAt: startedAt.toISOString(),
          finishedAt: new Date().toISOString(),
          reportPath,
          reportPrefix,
          tenantSlug: args.tenantSlug ?? null,
          reasons,
          deletedCount,
          deletedImageIds: existingRows.map((row) => row.id)
        },
        null,
        2
      ),
      'utf8'
    );

    console.info(`Deleted ${deletedCount} product_images rows.`);
    console.info(`- result: ${resultPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
