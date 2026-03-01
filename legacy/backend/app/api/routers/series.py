from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import Series
from app.schemas.schemas import ApiResponse

router = APIRouter()


@router.get("", response_model=ApiResponse)
async def list_series(
    db: Session = Depends(get_db),
):
    """Public: list active series for browsing."""
    series = (
        db.query(Series)
        .filter(Series.is_active == True)  # noqa: E712
        .order_by(Series.sort_order.asc(), Series.created_at.desc())
        .all()
    )

    data = [
        {
            "id": s.id,
            "name": s.name,
            "sortOrder": s.sort_order,
            "description": s.description,
            "isActive": s.is_active,
            "createdAt": s.created_at.isoformat() if s.created_at else None,
            "updatedAt": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in series
    ]

    return ApiResponse(data=data, message="Series retrieved successfully")
