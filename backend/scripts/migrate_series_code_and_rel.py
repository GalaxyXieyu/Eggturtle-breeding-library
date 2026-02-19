"""SQLite migration for turtle_album.

This project historically used SQLAlchemy `create_all()` (no Alembic).
`create_all()` will not alter existing tables, so we ship explicit, safe-ish
DDL migrations as one-off scripts.

Migration v2026-02-19:
- series: drop unique index on name
- series: add nullable code column + unique index
- create series_product_rel relation table
- backfill relation table from products.series_id

Usage:
  python3 backend/scripts/migrate_series_code_and_rel.py --db ./backend/data/app.db

Make a backup before running on anything important.
"""

from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path


def _table_exists(conn: sqlite3.Connection, name: str) -> bool:
    cur = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1", (name,)
    )
    return cur.fetchone() is not None


def _index_exists(conn: sqlite3.Connection, name: str) -> bool:
    cur = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='index' AND name=? LIMIT 1", (name,)
    )
    return cur.fetchone() is not None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True, help="Path to sqlite db file")
    args = parser.parse_args()

    db_path = Path(args.db).expanduser().resolve()
    if not db_path.exists():
        raise SystemExit(f"DB not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute("PRAGMA foreign_keys=ON")

        if not _table_exists(conn, "series") or not _table_exists(conn, "products"):
            raise SystemExit("Expected tables series/products not found; is this turtle_album DB?")

        # 1) series.code
        cols = [r[1] for r in conn.execute("PRAGMA table_info(series)").fetchall()]
        if "code" not in cols:
            conn.execute("ALTER TABLE series ADD COLUMN code VARCHAR")

        # 2) make series.name non-unique by dropping the unique index that SQLAlchemy created.
        # Existing DB uses: CREATE UNIQUE INDEX ix_series_name ON series(name)
        if _index_exists(conn, "ix_series_name"):
            conn.execute("DROP INDEX ix_series_name")
        # Recreate as non-unique for performance.
        if not _index_exists(conn, "ix_series_name"):
            conn.execute("CREATE INDEX ix_series_name ON series (name)")

        # 3) unique index on series.code (nullable; sqlite allows multiple NULLs)
        if not _index_exists(conn, "ix_series_code"):
            conn.execute("CREATE UNIQUE INDEX ix_series_code ON series (code)")

        # 4) create relation table
        if not _table_exists(conn, "series_product_rel"):
            conn.execute(
                """
                CREATE TABLE series_product_rel (
                    series_id VARCHAR NOT NULL,
                    product_id VARCHAR NOT NULL,
                    created_at DATETIME,
                    PRIMARY KEY (series_id, product_id),
                    FOREIGN KEY(series_id) REFERENCES series (id),
                    FOREIGN KEY(product_id) REFERENCES products (id)
                );
                """
            )
            conn.execute("CREATE INDEX idx_spr_product_id ON series_product_rel (product_id)")
            conn.execute("CREATE INDEX idx_spr_series_id ON series_product_rel (series_id)")

        # 5) backfill from products.series_id
        conn.execute(
            """
            INSERT OR IGNORE INTO series_product_rel(series_id, product_id, created_at)
            SELECT p.series_id, p.id, datetime('now')
            FROM products p
            WHERE p.series_id IS NOT NULL
            """
        )

        conn.commit()
        print("OK: migrated series code + relation table")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
