from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import User, get_current_active_user
from app.db.session import get_db
from app.models.models import EggRecord, MatingRecord, Product, BreederEvent
from app.schemas.schemas import ApiResponse, EggRecordCreate, MatingRecordCreate

router = APIRouter()


class BreederEventCreate(BaseModel):
    product_id: str
    event_type: str  # mating|egg|change_mate
    event_date: str  # ISO datetime/date or mm.dd

    male_code: str | None = None
    egg_count: int | None = None
    note: str | None = None

    old_mate_code: str | None = None
    new_mate_code: str | None = None


def _parse_event_date(value: str) -> datetime:
    v = (value or "").strip()
    if not v:
        raise HTTPException(status_code=400, detail="event_date is required")

    # Support operator-friendly short input: mm.dd
    if "." in v and len(v.split(".")) == 2:
        mm, dd = v.split(".")
        if mm.isdigit() and dd.isdigit():
            year = datetime.utcnow().year
            try:
                return datetime(year, int(mm), int(dd))
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid mm.dd date")

    if v.endswith("Z"):
        v = v[:-1] + "+00:00"

    try:
        dt = datetime.fromisoformat(v)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event_date format")

    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt


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
    db.flush()  # Ensure record.id/created_at exist before creating the derived event.

    event = BreederEvent(
        product_id=female.id,
        event_type="mating",
        event_date=payload.mated_at,
        male_code=getattr(male, "code", None),
        note=payload.notes,
        source_type="mating_record",
        source_id=record.id,
        created_at=record.created_at or payload.mated_at,
    )
    db.add(event)

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

    db.query(BreederEvent).filter(
        BreederEvent.source_type == "mating_record",
        BreederEvent.source_id == record.id,
    ).delete(synchronize_session=False)

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
    db.flush()

    event = BreederEvent(
        product_id=female.id,
        event_type="egg",
        event_date=payload.laid_at,
        egg_count=payload.count,
        note=payload.notes,
        source_type="egg_record",
        source_id=record.id,
        created_at=record.created_at or payload.laid_at,
    )
    db.add(event)

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

    db.query(BreederEvent).filter(
        BreederEvent.source_type == "egg_record",
        BreederEvent.source_id == record.id,
    ).delete(synchronize_session=False)

    db.delete(record)
    db.commit()

    return ApiResponse(data=None, message="Egg record deleted successfully")


@router.post("/breeder-events", response_model=ApiResponse)
async def admin_create_breeder_event(
    payload: BreederEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Admin: manually create a breeder event.

    This exists mainly for cases where operators want to record an event by code/date
    without creating full mating_records/egg_records rows.

    Notes:
    - For mating events, if male_code is omitted, we default to the female's current mate_code.
    - event_date supports ISO formats and mm.dd (uses current year).
    """

    female = _ensure_breeder(db, payload.product_id)
    _ensure_sex(female, "female", "product")

    if payload.event_type not in {"mating", "egg", "change_mate"}:
        raise HTTPException(status_code=400, detail="Invalid event_type")

    event_dt = _parse_event_date(payload.event_date)

    male_code = (payload.male_code or "").strip() or None
    if payload.event_type == "mating" and not male_code:
        male_code = (getattr(female, "mate_code", None) or "").strip() or None

    now = datetime.utcnow()
    e = BreederEvent(
        product_id=female.id,
        event_type=payload.event_type,
        event_date=event_dt,
        male_code=male_code,
        egg_count=payload.egg_count,
        note=payload.note,
        old_mate_code=payload.old_mate_code,
        new_mate_code=payload.new_mate_code,
        source_type="manual",
        source_id=None,
        created_at=now,
    )
    db.add(e)
    db.commit()
    db.refresh(e)

    return ApiResponse(
        data={
            "id": e.id,
            "productId": e.product_id,
            "eventType": e.event_type,
            "eventDate": e.event_date.isoformat() if e.event_date else None,
            "maleCode": e.male_code,
            "eggCount": e.egg_count,
            "note": e.note,
            "oldMateCode": e.old_mate_code,
            "newMateCode": e.new_mate_code,
            "createdAt": e.created_at.isoformat() if e.created_at else None,
        },
        message="Breeder event created successfully",
    )
