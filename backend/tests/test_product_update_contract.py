import asyncio
import os
import sys

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Allow running tests from backend/ without installing the package.
HERE = os.path.abspath(os.path.dirname(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(HERE, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.api.routers.admin import update_product
from app.models.models import Base, Product, User
from app.schemas.schemas import ProductUpdate


def _build_test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal()


def _seed_product(db, code: str = "T-001") -> Product:
    product = Product(
        name=code,
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


def test_product_update_accepts_snake_case_fields() -> None:
    payload = ProductUpdate.model_validate(
        {
            "sire_code": "F",
            "dam_code": "M",
            "in_stock": False,
            "is_featured": True,
            "has_sample": True,
        }
    )
    data = payload.model_dump(exclude_unset=True)

    assert data["sire_code"] == "F"
    assert data["dam_code"] == "M"
    assert data["in_stock"] is False
    assert data["is_featured"] is True
    assert data["has_sample"] is True


def test_product_update_rejects_camel_case_fields() -> None:
    with pytest.raises(ValidationError):
        ProductUpdate.model_validate({"sireCode": "F"})


def test_update_product_rejects_empty_payload() -> None:
    db = _build_test_db()
    product = _seed_product(db, "T-EMPTY")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(update_product(product.id, ProductUpdate(), _fake_user(), db))

    assert exc.value.status_code == 400
    assert exc.value.detail == "No valid fields to update"


def test_update_product_accepts_snake_case_lineage_fields() -> None:
    db = _build_test_db()
    product = _seed_product(db, "T-LINEAGE")

    payload = ProductUpdate.model_validate({"sire_code": "F", "dam_code": "M"})
    asyncio.run(update_product(product.id, payload, _fake_user(), db))

    db.refresh(product)
    assert product.sire_code == "F"
    assert product.dam_code == "M"
