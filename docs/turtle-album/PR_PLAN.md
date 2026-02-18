# PR Plan (Backend-first)

This plan splits the branch work into multiple PRs. Each PR is small, reviewable, and has explicit acceptance + test steps.

The authoritative plan table is in `docs/turtle-album/PR_PLAN.csv` (Excel-friendly).

## Notes about current repo state

- SQLAlchemy models live at `backend/app/models/models.py`.
- Alembic exists but the initial migration is currently empty (`backend/alembic/versions/2da3cb600cba_initial.py`). The app can create tables via `Base.metadata.create_all()`.
- We will still keep changes migration-friendly, but the immediate goal is backend correctness + testability.

## PR sequencing

1) DB schema (Series + breeder extensions + mating/egg)
2) Admin CRUD (Series)
3) Public APIs (series list + breeder feed + breeder detail)
4) Admin CRUD (breeders + media + mating + eggs + lineage + price)
5) Tests + backend docs

## Definition of done (Backend)

- Public browsing supports: series -> (female|male) -> breeder detail.
- Female detail includes: unit price, mating records, egg records.
- Male detail excludes: egg records, unit price.
- Optional lineage renders only if provided.
- Admin CRUD exists for all required objects.
- Rules enforced: same-series mating only; female/male constraints.
- Tests run locally and cover invariants.
