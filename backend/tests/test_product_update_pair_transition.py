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

from app.api.routers.admin import update_product
from app.models.models import Base, Product, User
from app.schemas.schemas import ProductUpdate


def _build_test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal()


def _seed_product(db) -> Product:
    product = Product(code="F-001", description="2.22 更换配偶为B公", price=0.0)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def _fake_user() -> User:
    return User(id="u-1", username="admin", hashed_password="x", role="admin", is_active=True)


def test_update_product_processes_description_pair_transition() -> None:
    db = _build_test_db()
    product = _seed_product(db)

    payload = ProductUpdate.model_validate({"description": "2.22 更换配偶为B公\n2.23 产4蛋"})
    asyncio.run(update_product(product.id, payload, _fake_user(), db))

    db.refresh(product)
    assert product.description == "2.22 更换配偶为B公 #TA_PAIR_TRANSITION=1\n2.23 产4蛋-换公过渡期"
