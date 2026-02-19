# PR#1 - DB Schema (Backend)

This PR introduces database-level structures needed for the turtle-album business.

## Adds

- `Series` model/table (`series`)
- Extends existing `Product` model/table (`products`) with breeder/archive fields:
  - `series_id`, `sex`, `offspring_unit_price`
  - optional lineage fields: `sire_code`, `dam_code`, `sire_image_url`, `dam_image_url`
- Adds `MatingRecord` model/table (`mating_records`)
- Adds `EggRecord` model/table (`egg_records`)

## Notes

- New `Product` fields are nullable for backward compatibility with existing data.
- Business invariants (female-only egg, same-series mating, etc.) are enforced at API-level in later PRs.

## How to verify (manual)

1) Use a fresh sqlite DB:
   - remove `backend/data/app.db` (or point `DATABASE_URL` to a temp file)
2) Start backend:
   - `cd backend && uvicorn app.main:app --reload`
3) Ensure tables are created (app uses `Base.metadata.create_all()`), then inspect DB with sqlite:
   - confirm tables exist: `products`, `product_images`, `series`, `mating_records`, `egg_records`
4) Smoke compile:
   - `python3 -m compileall app`
