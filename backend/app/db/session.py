import os
from pathlib import Path
from typing import Dict, Optional, Set

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BACKEND_DIR / ".env"
DEFAULT_DATABASE_URL = "sqlite:///./data/app.db"

load_dotenv(ENV_PATH)


def _normalize_sqlite_url(db_url: str) -> str:
    """Normalize relative sqlite path to an absolute path anchored at backend/."""
    if not db_url.startswith("sqlite:///"):
        return db_url
    if db_url.startswith("sqlite:////") or db_url == "sqlite:///:memory:":
        return db_url

    relative_path = db_url.replace("sqlite:///", "", 1)
    normalized_path = (BACKEND_DIR / relative_path).resolve()
    return f"sqlite:///{normalized_path.as_posix()}"


DATABASE_URL = _normalize_sqlite_url(os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))


def get_sqlite_file_path(db_url: str = DATABASE_URL) -> Optional[Path]:
    if not db_url.startswith("sqlite:///") or db_url == "sqlite:///:memory:":
        return None
    return Path(db_url.replace("sqlite:///", "", 1))


def ensure_sqlite_parent_dir() -> None:
    db_file = get_sqlite_file_path()
    if db_file is None:
        return
    db_file.parent.mkdir(parents=True, exist_ok=True)


ensure_sqlite_parent_dir()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    from app.models.models import Base

    Base.metadata.create_all(bind=engine)


def validate_schema_or_raise() -> None:
    """
    Validate critical turtle-album schema. `create_all` does not alter old tables,
    so we fail fast when columns are missing.
    """
    required_columns: Dict[str, Set[str]] = {
        "products": {"series_id", "sex", "offspring_unit_price"},
        # series.code is required for admin UI + OpenClaw uploads; series.name is not unique.
        "series": {"id", "name", "code"},
        "series_product_rel": {"series_id", "product_id"},
        "mating_records": {"female_id", "male_id", "mated_at"},
        "egg_records": {"female_id", "laid_at"},
    }

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    missing_tables = []
    missing_columns: Dict[str, Set[str]] = {}

    for table_name, expected_columns in required_columns.items():
        if table_name not in table_names:
            missing_tables.append(table_name)
            continue
        existing_columns = {col["name"] for col in inspector.get_columns(table_name)}
        diff = expected_columns - existing_columns
        if diff:
            missing_columns[table_name] = diff

    if not missing_tables and not missing_columns:
        return

    error_parts = []
    if missing_tables:
        error_parts.append(f"missing tables={sorted(missing_tables)}")
    if missing_columns:
        serialized = {k: sorted(v) for k, v in missing_columns.items()}
        error_parts.append(f"missing columns={serialized}")

    raise RuntimeError(
        "Database schema is incompatible with current code. "
        + "; ".join(error_parts)
        + ". Please upgrade DB (sqlite) via: backend/scripts/migrate_series_code_and_rel.py "
        + "or recreate via backend/scripts/turtle_album_init_db.py --reset (dev only)."
    )
