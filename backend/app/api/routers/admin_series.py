from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from app.db.session import get_db
from app.core.security import get_current_active_user, User
from app.models.models import Series
from app.schemas.schemas import ApiResponse, SeriesCreate, SeriesUpdate

router = APIRouter()


def _series_to_dict(s: Series) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "sortOrder": s.sort_order,
        "isActive": s.is_active,
        "createdAt": s.created_at.isoformat() if s.created_at else None,
        "updatedAt": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("", response_model=ApiResponse)
async def admin_list_series(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Admin: list series (optionally include inactive)."""
    query = db.query(Series)
    if not include_inactive:
        query = query.filter(Series.is_active == True)  # noqa: E712

    series = query.order_by(Series.sort_order.asc(), Series.created_at.desc()).all()
    return ApiResponse(data=[_series_to_dict(s) for s in series], message="Series retrieved successfully")


@router.post("", response_model=ApiResponse)
async def admin_create_series(
    payload: SeriesCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Admin: create a series."""
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Series name is required")

    existing = db.query(Series).filter(func.lower(Series.name) == name.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Series name already exists")

    sort_order: Optional[int] = payload.sort_order
    if sort_order is None:
        # Append to the end by default.
        max_sort = db.query(func.max(Series.sort_order)).scalar() or 0
        sort_order = max_sort + 1

    series = Series(name=name, sort_order=sort_order, is_active=payload.is_active)
    db.add(series)
    db.commit()
    db.refresh(series)

    return ApiResponse(data=_series_to_dict(series), message="Series created successfully")


@router.put("/{series_id}", response_model=ApiResponse)
async def admin_update_series(
    series_id: str,
    payload: SeriesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Admin: update a series."""
    series = db.query(Series).filter(Series.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Series name cannot be empty")
        existing = (
            db.query(Series)
            .filter(func.lower(Series.name) == name.lower())
            .filter(Series.id != series_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Series name already exists")
        series.name = name

    if payload.sort_order is not None:
        series.sort_order = payload.sort_order

    if payload.is_active is not None:
        series.is_active = payload.is_active

    db.commit()
    db.refresh(series)

    return ApiResponse(data=_series_to_dict(series), message="Series updated successfully")


@router.delete("/{series_id}", response_model=ApiResponse)
async def admin_delete_series(
    series_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Admin: delete a series.

    NOTE: If there are breeders (products) referencing this series, deletion will fail
    unless the DB is configured to cascade; we keep it strict to avoid silent data loss.
    """
    series = db.query(Series).filter(Series.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")

    db.delete(series)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Cannot delete series with existing breeders")

    return ApiResponse(data=None, message="Series deleted successfully")
