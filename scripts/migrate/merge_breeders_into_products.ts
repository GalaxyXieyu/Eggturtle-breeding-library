#!/usr/bin/env ts-node
// @ts-nocheck

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PrismaClient } from '@prisma/client';

type CliArgs = {
  confirm: boolean;
  dropLegacyTables: boolean;
  reportDir: string;
};

function parseArgs(argv: string[]): CliArgs {
  let confirm = false;
  let dropLegacyTables = false;
  let reportDir = 'out/migrate/breeder-product-merge';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--confirm') {
      confirm = true;
      continue;
    }
    if (arg === '--drop-legacy') {
      dropLegacyTables = true;
      continue;
    }
    if (arg === '--report-dir') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--report-dir requires a path value.');
      }
      reportDir = value;
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
    dropLegacyTables,
    reportDir
  };
}

function printHelpAndExit(code: number): never {
  console.info(
    [
      'Usage:',
      '  pnpm ts-node scripts/migrate/merge_breeders_into_products.ts [options]',
      '',
      'Options:',
      '  --confirm              Execute writes. Default is dry-run only.',
      '  --drop-legacy          Drop breeders/breeder_events after successful merge.',
      '  --report-dir <path>    Output report directory (default: out/migrate/breeder-product-merge).',
      '  -h, --help             Show help.',
      '',
      'Examples:',
      '  pnpm ts-node scripts/migrate/merge_breeders_into_products.ts',
      '  pnpm ts-node scripts/migrate/merge_breeders_into_products.ts --confirm --drop-legacy'
    ].join('\n')
  );
  process.exit(code);
}

function runId(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(
    date.getUTCMinutes()
  )}${pad(date.getUTCSeconds())}`;
}

async function tableExists(prisma: PrismaClient, tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS "exists"
    `,
    tableName
  );
  return Boolean(rows[0]?.exists);
}

async function buildDiagnostics(prisma: PrismaClient) {
  const [breederCountRow, productCountRow, eventCountRow] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "breeders"`),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "products"`),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "breeder_events"`)
  ]);

  const conflicts = await prisma.$queryRawUnsafe<
    Array<{
      tenantId: string;
      breederId: string;
      breederCode: string;
      candidateProductCount: number;
      candidateProductIds: string[];
    }>
  >(
    `
      WITH candidate AS (
        SELECT
          b.tenant_id AS "tenantId",
          b.id AS "breederId",
          b.code AS "breederCode",
          p.id AS "productId"
        FROM breeders b
        JOIN products p
          ON p.tenant_id = b.tenant_id
         AND UPPER(TRIM(p.code)) = UPPER(TRIM(b.code))
      )
      SELECT
        "tenantId",
        "breederId",
        "breederCode",
        COUNT(*)::int AS "candidateProductCount",
        ARRAY_AGG("productId" ORDER BY "productId") AS "candidateProductIds"
      FROM candidate
      GROUP BY "tenantId", "breederId", "breederCode"
      HAVING COUNT(*) > 1
      ORDER BY "tenantId", "breederCode"
    `
  );

  const unmatched = await prisma.$queryRawUnsafe<
    Array<{
      tenantId: string;
      breederId: string;
      breederCode: string;
    }>
  >(
    `
      SELECT
        b.tenant_id AS "tenantId",
        b.id AS "breederId",
        b.code AS "breederCode"
      FROM breeders b
      LEFT JOIN products p
        ON p.tenant_id = b.tenant_id
       AND UPPER(TRIM(p.code)) = UPPER(TRIM(b.code))
      WHERE p.id IS NULL
      ORDER BY b.tenant_id, b.code
    `
  );

  return {
    counts: {
      breeders: Number(breederCountRow[0]?.count ?? 0n),
      products: Number(productCountRow[0]?.count ?? 0n),
      breederEvents: Number(eventCountRow[0]?.count ?? 0n)
    },
    conflicts,
    unmatched
  };
}

async function executeMerge(prisma: PrismaClient, dropLegacyTables: boolean) {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "legacy_breeder_id" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "product_events" (
      "id" TEXT NOT NULL,
      "tenant_id" TEXT NOT NULL,
      "product_id" TEXT NOT NULL,
      "event_type" VARCHAR(40) NOT NULL,
      "event_date" TIMESTAMP(3) NOT NULL,
      "note" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "product_events_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    WITH ranked_matches AS (
      SELECT
        b.id AS breeder_id,
        p.id AS product_id,
        ROW_NUMBER() OVER (
          PARTITION BY b.id
          ORDER BY
            CASE WHEN p.code = b.code THEN 0 ELSE 1 END,
            p.updated_at DESC,
            p.created_at DESC,
            p.id DESC
        ) AS rn
      FROM breeders b
      JOIN products p
        ON p.tenant_id = b.tenant_id
       AND UPPER(TRIM(p.code)) = UPPER(TRIM(b.code))
    ),
    picked_matches AS (
      SELECT breeder_id, product_id
      FROM ranked_matches
      WHERE rn = 1
    )
    UPDATE "products" p
    SET
      "series_id" = b."series_id",
      "type" = COALESCE(p."type", 'breeder'),
      "name" = COALESCE(NULLIF(TRIM(b."name"), ''), p."name"),
      "description" = COALESCE(NULLIF(TRIM(b."description"), ''), p."description"),
      "sex" = COALESCE(NULLIF(TRIM(b."sex"), ''), p."sex"),
      "sire_code" = COALESCE(NULLIF(TRIM(b."sire_code"), ''), p."sire_code"),
      "dam_code" = COALESCE(NULLIF(TRIM(b."dam_code"), ''), p."dam_code"),
      "mate_code" = COALESCE(NULLIF(TRIM(b."mate_code"), ''), p."mate_code"),
      "in_stock" = b."is_active",
      "legacy_breeder_id" = b."id",
      "updated_at" = GREATEST(p."updated_at", b."updated_at")
    FROM picked_matches m
    JOIN "breeders" b ON b."id" = m."breeder_id"
    WHERE p."id" = m."product_id"
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "products" (
      "id",
      "tenant_id",
      "series_id",
      "legacy_breeder_id",
      "code",
      "type",
      "name",
      "description",
      "sex",
      "sire_code",
      "dam_code",
      "mate_code",
      "exclude_from_breeding",
      "has_sample",
      "in_stock",
      "popularity_score",
      "is_featured",
      "created_at",
      "updated_at"
    )
    SELECT
      CONCAT('prd_merge_', b."id") AS id,
      b."tenant_id",
      b."series_id",
      b."id" AS legacy_breeder_id,
      b."code",
      'breeder',
      COALESCE(NULLIF(TRIM(b."name"), ''), b."code"),
      NULLIF(TRIM(b."description"), ''),
      NULLIF(TRIM(b."sex"), ''),
      NULLIF(TRIM(b."sire_code"), ''),
      NULLIF(TRIM(b."dam_code"), ''),
      NULLIF(TRIM(b."mate_code"), ''),
      false,
      false,
      b."is_active",
      0,
      false,
      b."created_at",
      b."updated_at"
    FROM "breeders" b
    LEFT JOIN "products" p
      ON p."tenant_id" = b."tenant_id"
     AND UPPER(TRIM(p."code")) = UPPER(TRIM(b."code"))
    WHERE p."id" IS NULL
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "product_events" (
      "id",
      "tenant_id",
      "product_id",
      "event_type",
      "event_date",
      "note",
      "created_at",
      "updated_at"
    )
    SELECT
      be."id",
      be."tenant_id",
      p."id" AS product_id,
      be."event_type",
      be."event_date",
      be."note",
      be."created_at",
      be."updated_at"
    FROM "breeder_events" be
    JOIN "products" p
      ON p."tenant_id" = be."tenant_id"
     AND p."legacy_breeder_id" = be."breeder_id"
    ON CONFLICT ("id") DO NOTHING
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "products_tenant_id_legacy_breeder_id_key"
    ON "products"("tenant_id", "legacy_breeder_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "product_events_tenant_id_idx"
    ON "product_events"("tenant_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "product_events_tenant_id_product_id_idx"
    ON "product_events"("tenant_id", "product_id")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "product_events_tenant_id_product_id_event_date_idx"
    ON "product_events"("tenant_id", "product_id", "event_date")
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'product_events_tenant_id_fkey'
      ) THEN
        ALTER TABLE "product_events"
        ADD CONSTRAINT "product_events_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'product_events_product_id_tenant_id_fkey'
      ) THEN
        ALTER TABLE "product_events"
        ADD CONSTRAINT "product_events_product_id_tenant_id_fkey"
        FOREIGN KEY ("product_id", "tenant_id") REFERENCES "products"("id", "tenant_id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  if (dropLegacyTables) {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "breeder_events"`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "breeders"`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  const startedAt = new Date();
  const runLabel = runId(startedAt);
  const reportDir = resolve(args.reportDir);
  mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, `${runLabel}.json`);

  try {
    const breederTableReady = await tableExists(prisma, 'breeders');
    const breederEventsTableReady = await tableExists(prisma, 'breeder_events');

    const report: Record<string, unknown> = {
      runId: runLabel,
      startedAt: startedAt.toISOString(),
      mode: args.confirm ? 'execute' : 'dry-run',
      dropLegacyTables: args.dropLegacyTables,
      precheck: {
        breedersTableExists: breederTableReady,
        breederEventsTableExists: breederEventsTableReady
      }
    };

    if (!breederTableReady || !breederEventsTableReady) {
      report.status = 'skipped';
      report.reason = 'Legacy breeders tables are missing; nothing to merge.';
      writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
      console.info(`Skipped. Report: ${reportPath}`);
      return;
    }

    const diagnosticsBefore = await buildDiagnostics(prisma);
    report.diagnosticsBefore = diagnosticsBefore;

    if (!args.confirm) {
      report.status = 'dry-run-complete';
      writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
      console.info(`Dry-run complete. Report: ${reportPath}`);
      return;
    }

    await executeMerge(prisma, args.dropLegacyTables);

    const productEventsExists = await tableExists(prisma, 'product_events');
    const diagnosticsAfter = {
      productsWithLegacyBreederId: await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::bigint AS count FROM "products" WHERE "legacy_breeder_id" IS NOT NULL`
      ),
      productEvents: productEventsExists
        ? await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "product_events"`)
        : [{ count: 0n }]
    };

    report.status = 'executed';
    report.diagnosticsAfter = {
      productsWithLegacyBreederId: Number(diagnosticsAfter.productsWithLegacyBreederId[0]?.count ?? 0n),
      productEvents: Number(diagnosticsAfter.productEvents[0]?.count ?? 0n)
    };

    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.info(`Merge executed. Report: ${reportPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
