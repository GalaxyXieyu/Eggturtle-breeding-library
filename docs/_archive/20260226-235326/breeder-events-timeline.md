# Breeder Events Timeline (种龟事件)

This document explains the business rules and data conventions for mating/egg records.

## Why

Historically, mating/egg logs were written into `products.description` as free text.
This caused:
- poor query/analytics
- mismatch between male/female pages
- parsing ambiguity

We now store records as structured events in `breeder_events` and display them in the UI.

## Source Of Truth

- Event table: `breeder_events`
  - event_type: `mating` | `egg` | `change_mate`
  - event_date: `YYYY-MM-DD` (stored)
  - male_code: snapshot at the time of mating (for `mating`)
  - egg_count: integer (for `egg`, optional)
  - old_mate_code/new_mate_code: for `change_mate`

- Free-form description: `products.description`
  - only for turtle description / selling points / notes
  - MUST NOT contain mating/egg record logs going forward

## UI

- Female breeder detail:
  - status summary (need mating / warning)
  - mini horizontal timeline + detail list

- Male breeder detail:
  - mate-load card: list of related females + counts (need mating / warning)

## Recording Rules

- "Change mate" (换公): update `mateCode` in admin.
  - system auto logs a `change_mate` event.

- Mating / egg events should be created as structured events (not appended to `description`).

## Migration Notes

We have backfilled legacy records from `description` into `breeder_events`.
After backfill:
- `description` record lines are removed
- the UI reads records from `breeder_events`

## Operator Scripts

Repo root: `/Volumes/DATABASE/code/turtle_album`

- Backfill from description (dry-run first):
  - `python3 scripts/backfill_events_from_description.py --env prod --dry-run`

- Apply backfill (requires admin credentials in `.env` and explicit confirm):
  - `python3 scripts/backfill_events_from_description.py --env prod --apply --confirm-prod`

- Clean legacy record lines from description:
  - `python3 scripts/cleanup_description_records.py --env prod --dry-run`
  - `python3 scripts/cleanup_description_records.py --env prod --apply --confirm-prod`
