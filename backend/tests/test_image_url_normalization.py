import os
import sys
from types import SimpleNamespace

import pytest

# Allow running tests from backend/ without installing the package.
HERE = os.path.abspath(os.path.dirname(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(HERE, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.api.utils import _normalize_image_url, convert_product_to_response


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("images/p01/a.jpg", "/static/images/p01/a.jpg"),
        ("/images/p01/a.jpg", "/static/images/p01/a.jpg"),
        ("static/images/p01/a.jpg", "/static/images/p01/a.jpg"),
        ("/static/images/p01/a.jpg", "/static/images/p01/a.jpg"),
        ("/static/other/p01/a.jpg", "/static/other/p01/a.jpg"),
        ("https://example.com/a.jpg", "https://example.com/a.jpg"),
        ("/api/images/a.jpg", "/api/images/a.jpg"),
    ],
)
def test_normalize_image_url(raw: str, expected: str) -> None:
    assert _normalize_image_url(raw) == expected


def test_convert_product_to_response_normalizes_images_and_parents() -> None:
    img = SimpleNamespace(
        id=1,
        url="/images/p01/a.jpg",
        alt="alt",
        type="main",
        sort_order=1,
    )

    product = SimpleNamespace(
        id=1,
        name="n",
        code="p01",
        description="d",
        series_id=None,
        sex=None,
        offspring_unit_price=None,
        sire_code=None,
        dam_code=None,
        sire_image_url="images/p01/sire.jpg",
        dam_image_url="/images/p01/dam.jpg",
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
    assert resp["images"][0]["url"] == "/static/images/p01/a.jpg"
    assert resp["sireImageUrl"] == "/static/images/p01/sire.jpg"
    assert resp["damImageUrl"] == "/static/images/p01/dam.jpg"
