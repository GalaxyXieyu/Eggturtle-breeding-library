"""Legacy lightweight sqlite migrations.

These helpers are kept only for bridging old unversioned sqlite databases to the
Alembic baseline revision. New schema changes must go through Alembic revisions.
"""

from __future__ import annotations

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


def migrate_series_code_and_rel(db_path: str | Path) -> None:
    """Migration v2026-02-19.

    - series: add nullable code column + unique index
    - series: drop unique index on name and recreate non-unique index
    - create series_product_rel table
    - backfill relation table from products.series_id

    Safe to run multiple times.
    """

    db_path = Path(db_path).expanduser().resolve()
    if not db_path.exists():
        # For production this should exist (PVC). For dev, caller may create tables first.
        raise FileNotFoundError(f"DB not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute("PRAGMA foreign_keys=ON")

        if not _table_exists(conn, "series") or not _table_exists(conn, "products"):
            # Caller should ensure baseline tables exist first.
            return

        # 1) series.code
        cols = [r[1] for r in conn.execute("PRAGMA table_info(series)").fetchall()]
        if "code" not in cols:
            conn.execute("ALTER TABLE series ADD COLUMN code VARCHAR")

        # 2) series.name should not be unique; drop unique index if present.
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

        if not _index_exists(conn, "ix_series_product_rel_series_id"):
            conn.execute("CREATE INDEX ix_series_product_rel_series_id ON series_product_rel (series_id)")
        if not _index_exists(conn, "ix_series_product_rel_product_id"):
            conn.execute("CREATE INDEX ix_series_product_rel_product_id ON series_product_rel (product_id)")

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
    finally:
        conn.close()


def migrate_product_stage_status(db_path: str | Path) -> None:
    """Migration v2026-02-20.

    - products: add stage/status columns (NOT NULL with defaults)
    - products: add indexes on stage/status

    Safe to run multiple times.
    """

    db_path = Path(db_path).expanduser().resolve()
    if not db_path.exists():
        raise FileNotFoundError(f"DB not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute("PRAGMA foreign_keys=ON")

        if not _table_exists(conn, "products"):
            return

        cols = [r[1] for r in conn.execute("PRAGMA table_info(products)").fetchall()]

        if "stage" not in cols:
            conn.execute(
                "ALTER TABLE products ADD COLUMN stage VARCHAR NOT NULL DEFAULT 'unknown'"
            )
        if "status" not in cols:
            conn.execute(
                "ALTER TABLE products ADD COLUMN status VARCHAR NOT NULL DEFAULT 'draft'"
            )

        # Backfill any NULLs defensively (older sqlite edge cases / manual edits)
        conn.execute("UPDATE products SET stage='unknown' WHERE stage IS NULL")
        conn.execute("UPDATE products SET status='draft' WHERE status IS NULL")

        if not _index_exists(conn, "ix_products_stage"):
            conn.execute("CREATE INDEX ix_products_stage ON products (stage)")
        if not _index_exists(conn, "ix_products_status"):
            conn.execute("CREATE INDEX ix_products_status ON products (status)")

        conn.commit()
    finally:
        conn.close()


def migrate_remove_product_dimensions(db_path: str | Path) -> None:
    """Migration v2026-02-20.

    - products: drop dimensions, box_dimensions, box_quantity columns

    Safe to run multiple times.
    """

    db_path = Path(db_path).expanduser().resolve()
    if not db_path.exists():
        raise FileNotFoundError(f"DB not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute("PRAGMA foreign_keys=ON")

        if not _table_exists(conn, "products"):
            return

        cols = [r[1] for r in conn.execute("PRAGMA table_info(products)").fetchall()]

        # Drop columns if they exist (SQLite 3.35.0+)
        if "dimensions" in cols:
            conn.execute("ALTER TABLE products DROP COLUMN dimensions")
        if "box_dimensions" in cols:
            conn.execute("ALTER TABLE products DROP COLUMN box_dimensions")
        if "box_quantity" in cols:
            conn.execute("ALTER TABLE products DROP COLUMN box_quantity")

        conn.commit()
    finally:
        conn.close()


def migrate_remove_packaging_fields(db_path: str | Path) -> None:
    """Migration v2026-02-20.

    - products: drop product_type, tube_type, box_type, process_type, functional_designs, shape, material columns

    Safe to run multiple times.
    """

    db_path = Path(db_path).expanduser().resolve()
    if not db_path.exists():
        raise FileNotFoundError(f"DB not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute("PRAGMA foreign_keys=ON")

        if not _table_exists(conn, "products"):
            return

        cols = [r[1] for r in conn.execute("PRAGMA table_info(products)").fetchall()]

        # Drop packaging-related columns if they exist (SQLite 3.35.0+)
        if "product_type" in cols:
            conn.execute("ALTER TABLE products DROP COLUMN product_type")
        if "tube_type" in cols:
            conn.execute("ALTER TABLE products DROP COLUMN tube_type")
        if "box_type" in cols:
            conn.execute("ALTER TABLE products DROP COLUMN box_type")
        if "process_type" in cols:
            conn.execute("ALTER TABLE products DROP COLUMN process_type")
        if "functional_designs" in cols:
            conn.execute("ALTER TABLE products DROP COLUMN functional_designs")
        if "shape" in cols:
            conn.execute("ALTER TABLE products DROP COLUMN shape")
        if "material" in cols:
            conn.execute("ALTER TABLE products DROP COLUMN material")

        conn.commit()
    finally:
        conn.close()
