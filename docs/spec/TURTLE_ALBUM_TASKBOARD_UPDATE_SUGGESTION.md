# Taskboard Update Suggestion (Do Not Auto-Apply)

This file proposes new task IDs for `docs/plan/EggsTask.csv`.

> Per request: **only suggestion**, no CSV modifications performed.

## Suggested new tasks

### T70 (P0)

Title: TurtleAlbum prod API export/import scripts hardening + local rehearsal

Definition of done:

1. Run export dry-run + confirm and archive artifacts under `out/migrate/turtle_album_prod/<run-id>/`.
2. Run import dry-run + confirm on local DB.
3. Attach import report (`import-report-*.json/.md`) and summarize validation issues.

### T71 (P0)

Title: Staging migration rehearsal from production export snapshot

Definition of done:

1. Use same export snapshot from T70.
2. Run staging dry-run + confirm import.
3. Verify tenant-scoped counts and key UI pages (series/breeders/products/featured/share).
4. Produce evidence doc under `docs/plan/evidence/`.

### T72 (P0)

Title: Production migration cutover with two-step guard

Definition of done:

1. Confirm pre-cutover DB snapshot exists.
2. Run prod dry-run (`--env=prod --confirm-prod`).
3. Run prod write (`--env=prod --confirm --confirm-prod`).
4. Publish readback report and pass/fail checklist.

### T73 (P1)

Title: Tenant parity UX smoothing for migrated legacy operators

Definition of done:

1. Ensure migrated owner login lands in migrated tenant without manual confusion.
2. Add onboarding copy/help text for tenant concept.
3. Add regression test for first-login tenant routing.

### T74 (P1)

Title: Post-migration data parity audit automation

Definition of done:

1. Add script to compare legacy export counts vs Egg tenant counts.
2. Include mismatch classification (expected transform vs unexpected loss).
3. Output stable report in `out/migrate/turtle_album_prod/<run-id>/parity-audit.json`.
