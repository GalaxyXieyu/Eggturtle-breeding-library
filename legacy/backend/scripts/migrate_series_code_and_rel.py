"""Legacy sqlite migration entrypoint for turtle_album.

This script is kept for compatibility with old unversioned sqlite snapshots.
For normal day-to-day migrations, use Alembic:
  cd backend && python scripts/db_migrate.py upgrade

Legacy usage:
  python3 backend/scripts/migrate_series_code_and_rel.py --db ./backend/data/app.db
"""

from __future__ import annotations

import argparse
from pathlib import Path

from app.db.migrations import (
    migrate_series_code_and_rel,
    migrate_product_stage_status,
    migrate_remove_product_dimensions,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True, help="Path to sqlite db file")
    args = parser.parse_args()

    db_path = Path(args.db).expanduser().resolve()
    migrate_series_code_and_rel(db_path)
    migrate_product_stage_status(db_path)
    migrate_remove_product_dimensions(db_path)
    print("OK: migrated series code + relation table + products stage/status + removed dimensions")


if __name__ == "__main__":
    main()
