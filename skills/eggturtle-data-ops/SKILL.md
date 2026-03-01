# eggturtle-data-ops

Safe, repeatable data migration operations for EggTurtle.

## Trigger

Use this skill when you need to:

- export data from legacy TurtleAlbum production API
- import metadata into EggTurtle DB (dev/staging/prod)
- migrate product image binaries into managed storage (MinIO/S3/local)
- run readback verification and UI spot checks

## Non-negotiable safety rules

1. Default mode is dry-run.
2. Any write requires `--confirm`.
3. Production target requires both `--env=prod` and `--confirm-prod`.
4. Never commit secrets or raw credentials.
5. Store migration artifacts under `out/migrate/turtle_album_prod/<run-id>/`.

## Required env var names (sample only)

```dotenv
TURTLE_ALBUM_API_BASE_URL=
TURTLE_ALBUM_API_USERNAME=
TURTLE_ALBUM_API_PASSWORD=
DATABASE_URL=
EGGTURTLE_MIGRATION_ADMIN_EMAIL=
```

## Commands

Recommended order (do not skip safety checks):

1. export legacy data
2. import metadata (no image binary download)
3. import image binaries into managed storage
4. UI verify and readback report review

### 1) Export from TurtleAlbum production API

Dry-run (fetch + validate only, no files):

```bash
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_api_export.ts \
  --api-base-url "$TURTLE_ALBUM_API_BASE_URL" \
  --username "$TURTLE_ALBUM_API_USERNAME" \
  --password "$TURTLE_ALBUM_API_PASSWORD"
```

Write export files:

```bash
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_api_export.ts \
  --api-base-url "$TURTLE_ALBUM_API_BASE_URL" \
  --username "$TURTLE_ALBUM_API_USERNAME" \
  --password "$TURTLE_ALBUM_API_PASSWORD" \
  --confirm
```

Outputs:

- `out/migrate/turtle_album_prod/<run-id>/export.json`
- `out/migrate/turtle_album_prod/<run-id>/summary.json`

### 2) Import metadata into EggTurtle DB (default behavior)

Dry-run:

```bash
set -a; source apps/api/.env; set +a
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_import.ts \
  --input out/migrate/turtle_album_prod/<run-id>/export.json \
  --env dev \
  --tenant-slug turtle-album \
  --tenant-name "Turtle Album"
```

Write metadata only (keeps legacy image URL rows, no binary migration):

```bash
set -a; source apps/api/.env; set +a
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_import.ts \
  --input out/migrate/turtle_album_prod/<run-id>/export.json \
  --env dev \
  --tenant-slug turtle-album \
  --tenant-name "Turtle Album" \
  --confirm
```

### 3) Import image binaries into managed storage (optional explicit step)

This step downloads legacy image URLs and uploads binaries to storage (`local`/`s3` provider).

```bash
set -a; source apps/api/.env; set +a
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_import.ts \
  --input out/migrate/turtle_album_prod/<run-id>/export.json \
  --env dev \
  --tenant-slug turtle-album \
  --tenant-name "Turtle Album" \
  --confirm \
  --import-image-binaries \
  --image-concurrency 3 \
  --image-timeout-ms 15000
```

Useful flags:

- `--max-images <n>`: smoke test with only first N images.
- `--max-image-failures <n>`: allow up to N failures before non-zero exit.
- `--verify-managed-image-objects`: read managed objects after import and report missing binaries.
- `--skip-image-download`: explicitly force metadata-only behavior.

### 4) Production run (explicit confirmation only)

Never run against production without explicit human confirmation.

Dry-run on prod target:

```bash
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_import.ts \
  --input out/migrate/turtle_album_prod/<run-id>/export.json \
  --env prod \
  --confirm-prod
```

Write on prod target (metadata + binaries example):

```bash
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_import.ts \
  --input out/migrate/turtle_album_prod/<run-id>/export.json \
  --env prod \
  --confirm \
  --confirm-prod \
  --import-image-binaries \
  --verify-managed-image-objects
```

## Readback verification

After any write run, verify generated reports in import folder:

- `import-report-<run-id>.json`
- `import-report-<run-id>.md`

Required checks:

1. `importedSeriesPresent = PASS`
2. `importedProductsPresent = PASS`
3. `importedBreedersPresent = PASS`
4. `importedEventsPresent = PASS`
5. `importedImagesPresent = PASS`
6. `importedFeaturedPresent = PASS`
7. `importedSharesPresent = PASS`

When `--import-image-binaries` is enabled, also confirm:

1. `imageBinaryImport.failed <= --max-image-failures`
2. `readbackCounts.importedManagedImageCount` increased as expected
3. If `--verify-managed-image-objects` is enabled: `managedObjectVerification.missing = 0` and `errors = 0`

## Failure handling

1. If payload has validation issues, stop and inspect export summary first.
2. If import readback fails (or binary failures exceed threshold), do not rerun blind; capture mismatch and root-cause first.
3. For prod issues, prefer DB snapshot rollback over manual partial deletes.
