"""Database migration entry for application startup.

Strategy:
- New/empty DB: run `alembic upgrade head`
- Existing unversioned SQLite DB: run legacy idempotent sqlite migrations once,
  validate schema, then `alembic stamp head`
- Existing versioned DB: run `alembic upgrade head`
"""

from __future__ import annotations

import logging
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Literal

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.db.migrations import (
    migrate_product_stage_status,
    migrate_remove_product_dimensions,
    migrate_series_code_and_rel,
)
from app.db.session import DATABASE_URL, engine, get_sqlite_file_path, validate_schema_or_raise


MigrationMode = Literal["upgraded", "initialized", "stamped_legacy_sqlite"]
logger = logging.getLogger(__name__)


def _is_sqlite_url(db_url: str) -> bool:
    return db_url.startswith("sqlite:")


def _table_names() -> set[str]:
    return set(inspect(engine).get_table_names())


def build_alembic_config() -> Config:
    backend_dir = Path(__file__).resolve().parents[2]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    config.set_main_option("sqlalchemy.url", DATABASE_URL)
    return config


def _run_legacy_sqlite_migrations_once() -> None:
    sqlite_file = get_sqlite_file_path()
    if sqlite_file is None or not sqlite_file.exists():
        raise RuntimeError(
            "Legacy sqlite migration bridge requires an existing sqlite DB file."
        )

    backup_path = _backup_sqlite_file(sqlite_file)
    logger.warning(f"Legacy sqlite bridge backup created: {backup_path}")

    migrate_series_code_and_rel(sqlite_file)
    migrate_product_stage_status(sqlite_file)
    if _auto_apply_destructive_sqlite_migrations():
        migrate_remove_product_dimensions(sqlite_file)
        logger.warning(
            "Applied destructive sqlite migrations automatically "
            "(AUTO_APPLY_DESTRUCTIVE_SQLITE_MIGRATIONS=true)."
        )
    else:
        logger.warning(
            "Skipped destructive sqlite migrations by default. "
            "Run backend/scripts/migrate_series_code_and_rel.py manually if needed."
        )


def _backup_sqlite_file(sqlite_file: Path) -> Path:
    archive_dir = sqlite_file.parent / "archive"
    archive_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_path = archive_dir / f"{sqlite_file.stem}.{ts}.pre_bridge.bak"
    shutil.copy2(sqlite_file, backup_path)
    return backup_path


def _auto_apply_destructive_sqlite_migrations() -> bool:
    return os.getenv("AUTO_APPLY_DESTRUCTIVE_SQLITE_MIGRATIONS", "false").lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def upgrade_or_bootstrap_schema() -> MigrationMode:
    """
    Ensure database schema is upgraded to Alembic head.

    Returns a migration mode tag for logging.
    """
    table_names = _table_names()
    has_alembic_version = "alembic_version" in table_names
    has_user_tables = any(t != "alembic_version" for t in table_names)
    config = build_alembic_config()

    if has_alembic_version:
        command.upgrade(config, "head")
        return "upgraded"

    if not has_user_tables:
        command.upgrade(config, "head")
        return "initialized"

    if not _is_sqlite_url(DATABASE_URL):
        raise RuntimeError(
            "Detected a non-empty unversioned database. Refusing auto-stamp for safety. "
            "Please baseline it manually with Alembic."
        )

    _run_legacy_sqlite_migrations_once()
    validate_schema_or_raise()
    command.stamp(config, "head")
    return "stamped_legacy_sqlite"
