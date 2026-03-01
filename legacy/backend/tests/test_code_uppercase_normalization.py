import asyncio
import os
import sys

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Allow running tests from backend/ without installing the package.
HERE = os.path.abspath(os.path.dirname(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(HERE, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.api.routers.admin import create_product, update_product
from app.models.models import Base, Product, User
from app.schemas.schemas import ProductCreate, ProductUpdate
from app.services.code_normalize import normalize_code_upper


def _build_test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal()


def _seed_product(db, code: str = "T-001") -> Product:
    product = Product(
        code=code,
        description="",
        price=0.0,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def _fake_user() -> User:
    return User(id="u-1", username="admin", hashed_password="x", role="admin", is_active=True)


def test_normalize_code_upper_uppercases_ascii_but_keeps_hyphens() -> None:
    assert normalize_code_upper("hb-a") == "HB-A"


def test_normalize_code_upper_does_not_break_chinese_or_empty() -> None:
    assert normalize_code_upper("\u767d\u5316-1") == "\u767d\u5316-1"
    assert normalize_code_upper("") == ""
    assert normalize_code_upper(None) is None


def test_create_product_rejects_code_conflict_even_if_case_differs() -> None:
    db = _build_test_db()
    _seed_product(db, code="HB-A")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(create_product(ProductCreate(code="hb-a"), _fake_user(), db))

    assert exc.value.status_code == 400
    assert exc.value.detail == "Product code already exists"


def test_update_product_uppercases_identifier_fields() -> None:
    db = _build_test_db()
    product = _seed_product(db, code="T-CASE")

    payload = ProductUpdate.model_validate(
        {
            "sire_code": "hb-a",
            "dam_code": "\u767d\u5316-1",
            "mate_code": "",
        }
    )
    asyncio.run(update_product(product.id, payload, _fake_user(), db))

    db.refresh(product)
    assert product.sire_code == "HB-A"
    assert product.dam_code == "\u767d\u5316-1"
    assert product.mate_code == ""
