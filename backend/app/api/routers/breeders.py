from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.models.models import Product, MatingRecord, EggRecord
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


@router.get("/{breeder_id}/records", response_model=ApiResponse)
async def get_breeder_records(
    breeder_id: str,
    db: Session = Depends(get_db),
):
    """Public: breeder timeline records (mating + eggs).

    - For female: include matingRecordsAsFemale + eggRecords
    - For male: include matingRecordsAsMale
    """
    breeder = (
        db.query(Product)
        .filter(Product.id == breeder_id)
        .filter(Product.series_id.isnot(None))
        .filter(Product.sex.isnot(None))
        .first()
    )
    if not breeder:
        raise HTTPException(status_code=404, detail="Breeder not found")

    data = {
        "breederId": breeder.id,
        "sex": breeder.sex,
        "matingRecordsAsFemale": [],
        "matingRecordsAsMale": [],
        "eggRecords": [],
    }

    if breeder.sex == "female":
        matings = (
            db.query(MatingRecord)
            .filter(MatingRecord.female_id == breeder.id)
            .order_by(MatingRecord.mated_at.desc())
            .all()
        )
        eggs = (
            db.query(EggRecord)
            .filter(EggRecord.female_id == breeder.id)
            .order_by(EggRecord.laid_at.desc())
            .all()
        )
        data["matingRecordsAsFemale"] = [
            {
                "id": r.id,
                "femaleId": r.female_id,
                "maleId": r.male_id,
                "matedAt": r.mated_at.isoformat() if r.mated_at else None,
                "notes": r.notes,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
            }
            for r in matings
        ]
        data["eggRecords"] = [
            {
                "id": r.id,
                "femaleId": r.female_id,
                "laidAt": r.laid_at.isoformat() if r.laid_at else None,
                "count": r.count,
                "notes": r.notes,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
            }
            for r in eggs
        ]
    elif breeder.sex == "male":
        matings = (
            db.query(MatingRecord)
            .filter(MatingRecord.male_id == breeder.id)
            .order_by(MatingRecord.mated_at.desc())
            .all()
        )
        data["matingRecordsAsMale"] = [
            {
                "id": r.id,
                "femaleId": r.female_id,
                "maleId": r.male_id,
                "matedAt": r.mated_at.isoformat() if r.mated_at else None,
                "notes": r.notes,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
            }
            for r in matings
        ]

    return ApiResponse(data=data, message="Breeder records retrieved successfully")
