# eggturtle-data-ops

Safe, repeatable data migration operations for EggTurtle.

## Trigger

Use this skill when you need to:

- export data from legacy TurtleAlbum production API
- import that export into EggTurtle DB (dev/staging/prod)
- run readback verification reports

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

### 2) Import into EggTurtle DB (dev/staging)

Dry-run:

```bash
set -a; source apps/api/.env; set +a
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_import.ts \
  --input out/migrate/turtle_album_prod/<run-id>/export.json \
  --env dev \
  --tenant-slug turtle-album \
  --tenant-name "Turtle Album"
```

Write:

```bash
set -a; source apps/api/.env; set +a
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_import.ts \
  --input out/migrate/turtle_album_prod/<run-id>/export.json \
  --env dev \
  --tenant-slug turtle-album \
  --tenant-name "Turtle Album" \
  --confirm
```

### 3) Import into production (two-step guard)

Dry-run on prod target:

```bash
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_import.ts \
  --input out/migrate/turtle_album_prod/<run-id>/export.json \
  --env prod \
  --confirm-prod
```

Write on prod target:

```bash
pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_import.ts \
  --input out/migrate/turtle_album_prod/<run-id>/export.json \
  --env prod \
  --confirm \
  --confirm-prod
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

## Failure handling

1. If payload has validation issues, stop and inspect export summary first.
2. If import readback fails, do not rerun blind; capture mismatch and root-cause.
3. For prod issues, prefer DB snapshot rollback over manual partial deletes.
