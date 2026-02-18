from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import User, get_current_active_user
from app.db.session import get_db
from app.models.models import EggRecord, MatingRecord, Product
from app.schemas.schemas import ApiResponse, EggRecordCreate, MatingRecordCreate

router = APIRouter()


def _ensure_breeder(db: Session, breeder_id: str) -> Product:
    breeder = (
        db.query(Product)
        .filter(Product.id == breeder_id)
        .filter(Product.series_id.isnot(None))
        .filter(Product.sex.isnot(None))
        .first()
    )
    if not breeder:
        raise HTTPException(status_code=404, detail="Breeder not found")
    return breeder


def _ensure_sex(breeder: Product, expected: str, label: str):
    if breeder.sex != expected:
        raise HTTPException(status_code=400, detail=f"{label} must be '{expected}'")


def _ensure_same_series(a: Product, b: Product):
    if not a.series_id or not b.series_id or a.series_id != b.series_id:
        raise HTTPException(status_code=400, detail="Mating must be within the same series")


def _mating_to_dict(r: MatingRecord) -> dict:
    return {
        "id": r.id,
        "femaleId": r.female_id,
        "maleId": r.male_id,
        "matedAt": r.mated_at.isoformat() if r.mated_at else None,
        "notes": r.notes,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
    }


def _egg_to_dict(r: EggRecord) -> dict:
    return {
        "id": r.id,
        "femaleId": r.female_id,
        "laidAt": r.laid_at.isoformat() if r.laid_at else None,
        "count": r.count,
        "notes": r.notes,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
    }


@router.post("/mating-records", response_model=ApiResponse)
async def admin_create_mating_record(
    payload: MatingRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    female = _ensure_breeder(db, payload.female_id)
    male = _ensure_breeder(db, payload.male_id)

    _ensure_same_series(female, male)
    _ensure_sex(female, "female", "female")
    _ensure_sex(male, "male", "male")

    record = MatingRecord(
        female_id=female.id,
        male_id=male.id,
        mated_at=payload.mated_at,
        notes=payload.notes,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return ApiResponse(data=_mating_to_dict(record), message="Mating record created successfully")


@router.delete("/mating-records/{record_id}", response_model=ApiResponse)
async def admin_delete_mating_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = db.query(MatingRecord).filter(MatingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Mating record not found")

    db.delete(record)
    db.commit()

    return ApiResponse(data=None, message="Mating record deleted successfully")


@router.post("/egg-records", response_model=ApiResponse)
async def admin_create_egg_record(
    payload: EggRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    female = _ensure_breeder(db, payload.female_id)
    _ensure_sex(female, "female", "female")

    record = EggRecord(
        female_id=female.id,
        laid_at=payload.laid_at,
        count=payload.count,
        notes=payload.notes,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return ApiResponse(data=_egg_to_dict(record), message="Egg record created successfully")


@router.delete("/egg-records/{record_id}", response_model=ApiResponse)
async def admin_delete_egg_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = db.query(EggRecord).filter(EggRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Egg record not found")

    db.delete(record)
    db.commit()

    return ApiResponse(data=None, message="Egg record deleted successfully")
