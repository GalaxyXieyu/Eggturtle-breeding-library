import os
import sys
from types import SimpleNamespace

import pytest

# Allow running tests from backend/ without installing the package.
HERE = os.path.abspath(os.path.dirname(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(HERE, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.api.utils import convert_product_to_response, normalize_local_image_url


PRODUCT_ID = "550e8400-e29b-41d4-a716-446655440000"


@pytest.mark.parametrize(
    "raw,expected",
    [
        (f"images/{PRODUCT_ID}/a.jpg", f"/static/images/{PRODUCT_ID}/a.jpg"),
        (f"/images/{PRODUCT_ID}/a.jpg", f"/static/images/{PRODUCT_ID}/a.jpg"),
        (f"static/images/{PRODUCT_ID}/a.jpg", f"/static/images/{PRODUCT_ID}/a.jpg"),
        (f"/static/images/{PRODUCT_ID}/a.jpg", f"/static/images/{PRODUCT_ID}/a.jpg"),
        ("https://example.com/a.jpg", "https://example.com/a.jpg"),
        ("/api/images/a.jpg", "/api/images/a.jpg"),
        # Strict mode: do not normalize code-based paths anymore.
        ("images/p01/a.jpg", ""),
        ("/static/other/p01/a.jpg", ""),
    ],
)
def test_normalize_local_image_url(raw: str, expected: str) -> None:
    assert normalize_local_image_url(raw) == expected


def test_convert_product_to_response_normalizes_images_and_parents() -> None:
    img = SimpleNamespace(
        id=1,
        url=f"/images/{PRODUCT_ID}/a.jpg",
        alt="alt",
        type="main",
        sort_order=1,
    )

    product = SimpleNamespace(
        id=PRODUCT_ID,
        name="n",
        code="p01",
        description="d",
        series_id=None,
        sex=None,
        offspring_unit_price=None,
        sire_code=None,
        dam_code=None,
        sire_image_url=f"images/{PRODUCT_ID}/sire.jpg",
        dam_image_url=f"/images/{PRODUCT_ID}/dam.jpg",
        images=[img],
        cost_price=0,
        price=0,
        has_sample=False,
        in_stock=True,
        popularity_score=0,
        is_featured=False,
        created_at=SimpleNamespace(isoformat=lambda: "2020-01-01T00:00:00"),
        updated_at=SimpleNamespace(isoformat=lambda: "2020-01-01T00:00:00"),
        stage="unknown",
        status="draft",
    )

    resp = convert_product_to_response(product)
    assert resp["images"][0]["url"] == f"/static/images/{PRODUCT_ID}/a.jpg"
    assert resp["sireImageUrl"] == f"/static/images/{PRODUCT_ID}/sire.jpg"
    assert resp["damImageUrl"] == f"/static/images/{PRODUCT_ID}/dam.jpg"
