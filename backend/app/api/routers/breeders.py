from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.models.models import Product
from app.schemas.schemas import ApiResponse
from app.api.utils import convert_product_to_response

router = APIRouter()


@router.get("", response_model=ApiResponse)
async def list_breeders(
    series_id: Optional[str] = Query(None),
    sex: Optional[str] = Query(None, description="'male' | 'female'"),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Public: list breeders (repurposed Product) with optional series/sex filters."""
    query = db.query(Product)

    # Only turtle-album records: must have series_id + sex populated.
    query = query.filter(Product.series_id.isnot(None)).filter(Product.sex.isnot(None))

    if series_id:
        query = query.filter(Product.series_id == series_id)

    if sex:
        if sex not in {"male", "female"}:
            raise HTTPException(status_code=400, detail="Invalid sex; must be 'male' or 'female'")
        query = query.filter(Product.sex == sex)

    breeders = query.order_by(Product.created_at.desc()).limit(limit).all()
    return ApiResponse(
        data=[convert_product_to_response(b) for b in breeders],
        message="Breeders retrieved successfully",
    )


@router.get("/{breeder_id}", response_model=ApiResponse)
async def get_breeder_detail(
    breeder_id: str,
    db: Session = Depends(get_db),
):
    """Public: breeder (post) detail."""
    breeder = (
        db.query(Product)
        .filter(Product.id == breeder_id)
        .filter(Product.series_id.isnot(None))
        .filter(Product.sex.isnot(None))
        .first()
    )
    if not breeder:
        raise HTTPException(status_code=404, detail="Breeder not found")

    return ApiResponse(data=convert_product_to_response(breeder), message="Breeder retrieved successfully")
