import pytest
import os
import tempfile
import shutil
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_PASSWORD"] = "password"

SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

import app.db.session as session_module
session_module.engine = engine
session_module.SessionLocal = TestingSessionLocal

from app.main import app
from app.db.session import get_db
from app.models.models import Base

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session")
def test_db():
    """Create test database."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(test_db):
    """Create a fresh database session for each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    # Override the get_db dependency for this session
    def override_get_db_for_test():
        yield session

    app.dependency_overrides[get_db] = override_get_db_for_test

    yield session

    # Cleanup
    session.rollback()
    session.close()

    # Reset dependency override
    app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="function")
def client(db_session):
    """Create test client."""
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture(scope="function")
def admin_token(client):
    """Get admin authentication token."""
    response = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "password"
    })
    assert response.status_code == 200
    return response.json()["data"]["token"]

@pytest.fixture(scope="function")
def auth_headers(admin_token):
    """Get authentication headers."""
    return {"Authorization": f"Bearer {admin_token}"}

@pytest.fixture(scope="function")
def temp_upload_dir():
    """Create temporary upload directory."""
    temp_dir = tempfile.mkdtemp()
    original_upload_dir = os.environ.get("UPLOAD_DIR", "static/images")
    os.environ["UPLOAD_DIR"] = temp_dir
    
    yield temp_dir
    
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)
    os.environ["UPLOAD_DIR"] = original_upload_dir

@pytest.fixture
def sample_product_data():
    """Sample product data for testing."""
    return {
        "name": "Test Lipstick Tube",
        "code": "TEST001",
        "description": "A test lipstick tube for testing purposes",
        "tube_type": "口红管",
        "functional_designs": ["磁吸", "透明/透色"],
        "shape": "圆形",
        "material": "PETG",
        "dimensions": {
            "weight": 15.5,
            "length": 10.2,
            "width": 2.1,
            "height": 2.1,
            "capacity": {"min": 3.5, "max": 4.0}
        },
        "cost_price": 2.50,
        "factory_price": 1.80,
        "has_sample": True,
        "box_dimensions": "50x30x20cm",
        "box_quantity": 100,
        "in_stock": True,
        "popularity_score": 85
    }

@pytest.fixture
def sample_image_file():
    """Create a sample image file for testing."""
    from PIL import Image
    import io
    
    # Create a simple test image
    img = Image.new('RGB', (100, 100))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    
    return ("test_image.jpg", img_bytes, "image/jpeg")
