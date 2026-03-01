import asyncio
import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Allow running tests from backend/ without installing the package.
HERE = os.path.abspath(os.path.dirname(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(HERE, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from typing import Optional

from app.api.routers.breeders import get_breeder_family_tree
from app.models.models import Base, Product


def _build_test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal()


def _seed_breeder(
    db,
    *,
    code: str,
    sex: str,
    series_id: str = "s-1",
    sire_code: Optional[str] = None,
    dam_code: Optional[str] = None,
) -> Product:
    p = Product(
        code=code,
        description="",
        price=0.0,
        series_id=series_id,
        sex=sex,
        sire_code=sire_code,
        dam_code=dam_code,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def test_family_tree_omits_removed_name_fields() -> None:
    db = _build_test_db()

    sire = _seed_breeder(db, code="SIRE-1", sex="male")
    dam = _seed_breeder(db, code="DAM-1", sex="female")
    current = _seed_breeder(db, code="CHILD-1", sex="male", sire_code=sire.code, dam_code=dam.code)

    resp = asyncio.run(get_breeder_family_tree(current.id, db))
    assert resp.data is not None

    # Nodes should prefer returning only `code` (and other metadata) and not access Product.name.
    assert "name" not in resp.data["current"]
    assert "name" not in resp.data["ancestors"]["father"]
    assert "name" not in resp.data["ancestors"]["mother"]

    # Contract: matingRecords should not include maleName/femaleName.
    for r in resp.data.get("matingRecords", []):
        assert "maleName" not in r
        assert "femaleName" not in r
