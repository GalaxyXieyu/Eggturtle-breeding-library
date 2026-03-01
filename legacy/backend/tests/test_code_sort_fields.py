import asyncio
import os
import sys

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Allow running tests from backend/ without installing the package.
HERE = os.path.abspath(os.path.dirname(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(HERE, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.api.routers.admin import create_product
from app.api.routers.breeders import list_breeders
from app.models.models import Base, Product, User
from app.schemas.schemas import ProductCreate
from app.services.code_sort_fields import parse_code_sort_fields


BAIHUA = "\u767d\u5316"  # \u767d\u5316


def _build_test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal()


def _fake_user() -> User:
    return User(id="u-1", username="admin", hashed_password="x", role="admin", is_active=True)


@pytest.mark.parametrize(
    "code,expected",
    [
        (None, (None, None, None, None)),
        ("", (None, None, None, None)),
        ("   ", (None, None, None, None)),
    ],
)
def test_parse_code_sort_fields_handles_empty_or_none(code, expected) -> None:
    assert parse_code_sort_fields(code) == expected


@pytest.mark.parametrize(
    "code,expected",
    [
        ("HB", ("HB", None, None, None)),
        ("HB-1", ("HB", 1, None, None)),
        ("HB-10", ("HB", 10, None, None)),
        ("HB-A", ("HB", None, None, "A")),
        ("HB-a", ("HB", None, None, "A")),
        ("HB-1-1", ("HB", 1, 1, None)),
        ("HB-1-A", ("HB", 1, None, "A")),
        ("HB-1-a", ("HB", 1, None, "A")),
        ("HB-1-12", ("HB", 1, 12, None)),
    ],
)
def test_parse_code_sort_fields_parses_expected_patterns(code, expected) -> None:
    assert parse_code_sort_fields(code) == expected


def test_parse_code_sort_fields_examples_for_baihue_series() -> None:
    assert parse_code_sort_fields(f"{BAIHUA}-1") == (BAIHUA, 1, None, None)
    assert parse_code_sort_fields(f"{BAIHUA}-2") == (BAIHUA, 2, None, None)
    assert parse_code_sort_fields(f"{BAIHUA}-10") == (BAIHUA, 10, None, None)
    assert parse_code_sort_fields(f"{BAIHUA}-A") == (BAIHUA, None, None, "A")
    assert parse_code_sort_fields(f"{BAIHUA}-1-1") == (BAIHUA, 1, 1, None)
    assert parse_code_sort_fields(f"{BAIHUA}-1-A") == (BAIHUA, 1, None, "A")


def test_list_breeders_sorts_naturally_for_numbered_codes() -> None:
    db = _build_test_db()

    for code, sex in [
        (f"{BAIHUA}-1", "female"),
        (f"{BAIHUA}-10", "female"),
        (f"{BAIHUA}-2", "female"),
        (f"{BAIHUA}-A", "male"),
    ]:
        payload = ProductCreate.model_validate({"code": code, "series_id": BAIHUA, "sex": sex})
        asyncio.run(create_product(payload, _fake_user(), db))

    response = asyncio.run(list_breeders(series_id=BAIHUA, sex=None, limit=200, db=db))
    codes = [item["code"] for item in response.data]

    assert codes[:3] == [f"{BAIHUA}-1", f"{BAIHUA}-2", f"{BAIHUA}-10"]
    assert codes[-1] == f"{BAIHUA}-A"

    # Ensure sort fields were persisted (not just in-memory parsing).
    product = db.query(Product).filter(Product.code == f"{BAIHUA}-10").first()
    assert product.code_prefix == BAIHUA
    assert product.code_parent_number == 10
    assert product.code_child_number is None
    assert product.code_child_letter is None
