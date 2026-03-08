# TurtleAlbum -> Eggturtle Production Migration Runbook

## Scope

This runbook migrates TurtleAlbum production data into Eggturtle tenant `siri` with incremental upsert strategy and full MinIO bucket replication.

- Target tenant: `siri`
- Target account owner: `galaxyxieyu`
- Source API: `https://qmngzrlhklmt.sealoshzh.site`
- Target DB: `eggturtles`
- Bucket: `eggturtles`

## Script

Primary orchestrator:

- `scripts/migrate/run_migration_prod.sh`

Verification script:

- `scripts/migrate/verify_turtle_album_alignment.mjs`

## Command Template

```bash
scripts/migrate/run_migration_prod.sh \
  --run-id 20260308-prod-sync \
  --source-api https://qmngzrlhklmt.sealoshzh.site \
  --source-user admin \
  --source-pass admin123 \
  --target-db-url 'postgres://eggturtle:***@38.76.197.25:34123/eggturtles' \
  --tenant-slug siri \
  --tenant-name Siri \
  --admin-email galaxyxieyu@account.eggturtle.local \
  --target-minio-endpoint http://8.166.129.45:34125 \
  --target-minio-ak minioadmin \
  --target-minio-sk minioadmin123 \
  --confirm
```

## Mode Behavior

- Without `--confirm`:
  - Export writes local artifacts.
  - DB import runs in dry-run mode.
  - MinIO mirror runs with `--dry-run`.
- With `--confirm`:
  - Creates rollback DB dump before import.
  - Executes DB import write.
  - Executes baseline and final MinIO write mirror.
  - Verification fails the run on mismatch.

## Output Artifacts

All outputs are written to:

- `out/migrate/turtle_album_prod/<run-id>/`

Key files:

- `export.json`
- `summary.json`
- `snapshots/baseline-before.tsv`
- `snapshots/eggturtles-before.dump` (confirm mode only)
- `minio-mirror/baseline-mirror.txt`
- `minio-mirror/final-mirror.txt`
- `verify/verification.json`
- `verify/verification.md`

## Safety Notes

- Keep maintenance window enabled during confirm-mode import + final mirror.
- Do not commit secrets or generated migration artifacts.
- On failure in confirm mode, use generated DB dump and revert storage endpoint to Taurus MinIO.
