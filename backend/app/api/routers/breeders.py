from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import nullslast, func
from typing import Optional

from app.db.session import get_db
from app.models.models import Product, MatingRecord, EggRecord, BreederEvent
from app.schemas.schemas import ApiResponse
from app.api.utils import convert_product_to_response
from app.services.breeder_mate import parse_current_mate_code

router = APIRouter()


@router.get("", response_model=ApiResponse)
async def list_breeders(
    series_id: Optional[str] = Query(None),
    sex: Optional[str] = Query(None, description="'male' | 'female'"),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Public: list breeders (repurposed Product) with optional series/sex filters.

    Also includes computed fields used by the series+sex list page:
    - needMatingStatus: normal | need_mating | warning
    - lastEggAt / lastMatingAt
    - daysSinceEgg

    These are computed in bulk to avoid frontend N+1 queries.
    """

    from sqlalchemy.orm import joinedload

    query = db.query(Product).options(joinedload(Product.images))

    # Only turtle-album records: must have series_id + sex populated.
    query = query.filter(Product.series_id.isnot(None)).filter(Product.sex.isnot(None))

    if series_id:
        query = query.filter(Product.series_id == series_id)

    if sex:
        if sex not in {"male", "female"}:
            raise HTTPException(status_code=400, detail="Invalid sex; must be 'male' or 'female'")
        query = query.filter(Product.sex == sex)

    # Natural sorting by parsed code fields (e.g. 白化-1, 白化-2, ... 白化-10).
    breeders: list[Product] = (
        query.order_by(
            Product.code_prefix.asc(),
            nullslast(Product.code_parent_number.asc()),
            nullslast(Product.code_child_number.asc()),
            nullslast(Product.code_child_letter.asc()),
            Product.code.asc(),
            Product.created_at.desc(),
        )
        .limit(limit)
        .all()
    )

    female_ids = [b.id for b in breeders if (b.sex or "").lower() == "female"]

    last_egg_event_map: dict[str, datetime] = {}
    last_egg_record_map: dict[str, datetime] = {}
    last_mating_event_map: dict[str, datetime] = {}
    last_mating_record_map: dict[str, datetime] = {}

    if female_ids:
        # Prefer breeder_events when present, but keep legacy tables as fallback.
        for female_id, last_dt in (
            db.query(BreederEvent.product_id, func.max(BreederEvent.event_date))
            .filter(BreederEvent.product_id.in_(female_ids))
            .filter(BreederEvent.event_type == "egg")
            .group_by(BreederEvent.product_id)
            .all()
        ):
            if female_id and last_dt:
                last_egg_event_map[female_id] = last_dt

        for female_id, last_dt in (
            db.query(EggRecord.female_id, func.max(EggRecord.laid_at))
            .filter(EggRecord.female_id.in_(female_ids))
            .group_by(EggRecord.female_id)
            .all()
        ):
            if female_id and last_dt:
                last_egg_record_map[female_id] = last_dt

        for female_id, last_dt in (
            db.query(BreederEvent.product_id, func.max(BreederEvent.event_date))
            .filter(BreederEvent.product_id.in_(female_ids))
            .filter(BreederEvent.event_type == "mating")
            .group_by(BreederEvent.product_id)
            .all()
        ):
            if female_id and last_dt:
                last_mating_event_map[female_id] = last_dt

        for female_id, last_dt in (
            db.query(MatingRecord.female_id, func.max(MatingRecord.mated_at))
            .filter(MatingRecord.female_id.in_(female_ids))
            .group_by(MatingRecord.female_id)
            .all()
        ):
            if female_id and last_dt:
                last_mating_record_map[female_id] = last_dt

    def _pick_latest(a: Optional[datetime], b: Optional[datetime]) -> Optional[datetime]:
        if a and b:
            return a if a >= b else b
        return a or b

    now = datetime.utcnow()

    items: list[dict] = []
    for b in breeders:
        data = convert_product_to_response(b)

        if (b.sex or "").lower() == "female":
            last_egg_at = _pick_latest(last_egg_event_map.get(b.id), last_egg_record_map.get(b.id))
            last_mating_at = _pick_latest(last_mating_event_map.get(b.id), last_mating_record_map.get(b.id))
            status = _compute_need_mating_status(now, last_egg_at, last_mating_at)
            days_since_egg = (now.date() - last_egg_at.date()).days if last_egg_at else None
        else:
            last_egg_at = None
            last_mating_at = None
            status = "normal"
            days_since_egg = None

        data.update(
            {
                "needMatingStatus": status,
                "lastEggAt": last_egg_at.isoformat() if last_egg_at else None,
                "lastMatingAt": last_mating_at.isoformat() if last_mating_at else None,
                "daysSinceEgg": days_since_egg,
            }
        )
        items.append(data)

    return ApiResponse(
        data=items,
        message="Breeders retrieved successfully",
    )


@router.get("/by-code/{code}", response_model=ApiResponse)
async def get_breeder_by_code(
    code: str,
    db: Session = Depends(get_db),
):
    """Public: breeder summary by exact code.

    Used by the frontend to map sireCode/damCode -> breeder id.
    """
    from sqlalchemy.orm import joinedload

    breeder = (
        db.query(Product)
        .options(joinedload(Product.images))
        .filter(Product.code == code)
        .filter(Product.series_id.isnot(None))
        .filter(Product.sex.isnot(None))
        .first()
    )
    if not breeder:
        raise HTTPException(status_code=404, detail="Breeder not found")

    main_image_url = None
    if breeder.images:
        main_image = next((img for img in breeder.images if img.type == "main"), None)
        main_image_url = (main_image.url if main_image else breeder.images[0].url) if breeder.images else None

    return ApiResponse(
        data={
            "id": breeder.id,
            "code": breeder.code,
            "mainImageUrl": main_image_url,
        },
        message="Breeder retrieved successfully",
    )


@router.get("/{breeder_id}", response_model=ApiResponse)
async def get_breeder_detail(
    breeder_id: str,
    db: Session = Depends(get_db),
):
    """Public: breeder (post) detail."""
    from sqlalchemy.orm import joinedload
    breeder = (
        db.query(Product)
        .options(joinedload(Product.images))
        .filter(Product.id == breeder_id)
        .filter(Product.series_id.isnot(None))
        .filter(Product.sex.isnot(None))
        .first()
    )
    if not breeder:
        raise HTTPException(status_code=404, detail="Breeder not found")

    data = convert_product_to_response(breeder)

    # For female breeders, expose a best-effort mate code even when we can't resolve
    # an actual breeder record id (so the UI can still show the yellow pill).
    if breeder.sex == "female":
        data["currentMateCode"] = (
            (getattr(breeder, "mate_code", None) or "").strip()
            or (parse_current_mate_code(getattr(breeder, "description", None)) or "").strip()
            or None
        )
    else:
        data["currentMateCode"] = None

    mate = _resolve_current_mate(db, breeder)
    if mate:
        data["currentMate"] = {"id": mate.id, "code": mate.code}
    else:
        data["currentMate"] = None

    return ApiResponse(data=data, message="Breeder retrieved successfully")


@router.get("/{breeder_id}/records", response_model=ApiResponse)
async def get_breeder_records(
    breeder_id: str,
    db: Session = Depends(get_db),
):
    """Public: breeder timeline records (mating + eggs).

    - For female: include matingRecordsAsFemale + eggRecords
    - For male: include matingRecordsAsMale
    """
    from sqlalchemy.orm import joinedload
    breeder = (
        db.query(Product)
        .options(joinedload(Product.images))
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
        "currentMate": None,
        "matingRecordsAsFemale": [],
        "matingRecordsAsMale": [],
        "eggRecords": [],
    }

    if breeder.sex == "female":
        mate = _resolve_current_mate(db, breeder)
        data["currentMate"] = {"id": mate.id, "code": mate.code} if mate else None

        matings = (
            db.query(MatingRecord)
            .filter(MatingRecord.female_id == breeder.id)
            .order_by(MatingRecord.mated_at.desc())
            .all()
        )
        male_ids = {r.male_id for r in matings}
        male_map = {
            p.id: p
            for p in db.query(Product).filter(Product.id.in_(male_ids)).all()
        }
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
                "male": (
                    {
                        "id": male_map.get(r.male_id).id,
                        "code": male_map.get(r.male_id).code,
                    }
                    if male_map.get(r.male_id)
                    else None
                ),
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
        female_ids = {r.female_id for r in matings}
        female_map = {
            p.id: p
            for p in db.query(Product).filter(Product.id.in_(female_ids)).all()
        }
        data["matingRecordsAsMale"] = [
            {
                "id": r.id,
                "femaleId": r.female_id,
                "maleId": r.male_id,
                "female": (
                    {
                        "id": female_map.get(r.female_id).id,
                        "code": female_map.get(r.female_id).code,
                    }
                    if female_map.get(r.female_id)
                    else None
                ),
                "matedAt": r.mated_at.isoformat() if r.mated_at else None,
                "notes": r.notes,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
            }
            for r in matings
        ]

    return ApiResponse(data=data, message="Breeder records retrieved successfully")


def _parse_iso_dt(value: str) -> datetime:
    v = (value or "").strip()
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(v)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid datetime format")

    # DB stores naive datetimes; normalize cursor values to naive for comparisons.
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt


def _encode_event_cursor(e: BreederEvent) -> str:
    event_dt = e.event_date.isoformat() if e.event_date else ""
    created_dt = (e.created_at or e.event_date).isoformat() if (e.created_at or e.event_date) else ""
    return f"{event_dt}|{created_dt}|{e.id}"


def _decode_event_cursor(cursor: str) -> tuple[datetime, datetime, str]:
    parts = (cursor or "").split("|")
    if len(parts) != 3:
        raise HTTPException(status_code=400, detail="Invalid cursor")
    return (_parse_iso_dt(parts[0]), _parse_iso_dt(parts[1]), parts[2])


@router.get("/{breeder_id}/events", response_model=ApiResponse)
async def get_breeder_events(
    breeder_id: str,
    event_type: Optional[str] = Query(None, alias="type", description="mating|egg|change_mate"),
    limit: int = Query(10, ge=1, le=100),
    cursor: Optional[str] = Query(None, description="Opaque cursor from previous page"),
    db: Session = Depends(get_db),
):
    """Public: unified breeder timeline events (mating/egg/change-mate).

    Sorted newest-first by (event_date, created_at, id). Pagination is cursor-based.
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

    q = db.query(BreederEvent).filter(BreederEvent.product_id == breeder.id)

    if event_type:
        if event_type not in {"mating", "egg", "change_mate"}:
            raise HTTPException(status_code=400, detail="Invalid event type")
        q = q.filter(BreederEvent.event_type == event_type)

    if cursor:
        cursor_event_date, cursor_created_at, cursor_id = _decode_event_cursor(cursor)
        q = q.filter(
            (BreederEvent.event_date < cursor_event_date)
            | ((BreederEvent.event_date == cursor_event_date) & (BreederEvent.created_at < cursor_created_at))
            | (
                (BreederEvent.event_date == cursor_event_date)
                & (BreederEvent.created_at == cursor_created_at)
                & (BreederEvent.id < cursor_id)
            )
        )

    rows = (
        q.order_by(
            BreederEvent.event_date.desc(),
            BreederEvent.created_at.desc(),
            BreederEvent.id.desc(),
        )
        .limit(limit + 1)
        .all()
    )

    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = _encode_event_cursor(items[-1]) if has_more and items else None

    return ApiResponse(
        data={
            "items": [
                {
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
                }
                for e in items
            ],
            "nextCursor": next_cursor,
            "hasMore": has_more,
        },
        message="Breeder events retrieved successfully",
    )


def _canonical_mate_code_candidates(code: str) -> list[str]:
    c = (code or "").strip()
    if not c:
        return []
    if c.endswith("公"):
        return [c, c[:-1]]
    return [c, c + "公"]


def _compute_need_mating_status(now: datetime, last_egg_at: Optional[datetime], last_mating_at: Optional[datetime]) -> str:
    """Return one of: normal | need_mating | warning.

    Shared rule across list/detail/mate-load:
    - If no egg record -> normal
    - If there is a mating record on/after the last egg day -> normal
    - Else, days_since_last_egg = (now.date - last_egg_at.date):
      - 0-9 days -> normal (no prompt)
      - 10-24 days -> need_mating
      - >=25 days -> warning

    Note: egg day counts as day 0.
    """

    if not last_egg_at:
        return "normal"

    # Any mating on/after the last egg clears the need.
    if last_mating_at and last_mating_at.date() >= last_egg_at.date():
        return "normal"

    days = (now.date() - last_egg_at.date()).days
    if days >= 25:
        return "warning"
    if days >= 10:
        return "need_mating"
    return "normal"


@router.get("/{breeder_id}/mate-load", response_model=ApiResponse)
async def get_male_mate_load(
    breeder_id: str,
    limit: int = Query(80, ge=1, le=300),
    include_fallback: bool = Query(True, description="Fallback to products.mate_code when few/no events exist"),
    db: Session = Depends(get_db),
):
    """Public: for male breeder detail page.

    Returns related females + workload stats.

    Data priority:
    1) Structured events (mating events where male_code == this male's code)
    2) Fallback: female products whose mate_code matches this male's code (or with/without trailing '公').
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

    if (breeder.sex or "").lower() != "male":
        raise HTTPException(status_code=400, detail="mate-load only supported for male breeders")

    male_code = (breeder.code or "").strip()
    if not male_code:
        raise HTTPException(status_code=400, detail="Breeder code is required")

    # Latest mating/egg info per female.
    # Prefer structured breeder_events when present, but keep legacy tables as fallback.
    last_mating_with_male_event_sq = (
        db.query(
            BreederEvent.product_id.label("female_id"),
            func.max(BreederEvent.event_date).label("last_mating_with_male_at"),
        )
        .filter(BreederEvent.event_type == "mating")
        .filter(BreederEvent.male_code == male_code)
        .group_by(BreederEvent.product_id)
        .subquery()
    )

    last_mating_with_male_record_sq = (
        db.query(
            MatingRecord.female_id.label("female_id"),
            func.max(MatingRecord.mated_at).label("last_mating_with_male_at"),
        )
        .filter(MatingRecord.male_id == breeder.id)
        .group_by(MatingRecord.female_id)
        .subquery()
    )

    last_egg_event_sq = (
        db.query(
            BreederEvent.product_id.label("female_id"),
            func.max(BreederEvent.event_date).label("last_egg_at"),
        )
        .filter(BreederEvent.event_type == "egg")
        .group_by(BreederEvent.product_id)
        .subquery()
    )

    last_egg_record_sq = (
        db.query(
            EggRecord.female_id.label("female_id"),
            func.max(EggRecord.laid_at).label("last_egg_at"),
        )
        .group_by(EggRecord.female_id)
        .subquery()
    )

    last_mating_any_event_sq = (
        db.query(
            BreederEvent.product_id.label("female_id"),
            func.max(BreederEvent.event_date).label("last_mating_at"),
        )
        .filter(BreederEvent.event_type == "mating")
        .group_by(BreederEvent.product_id)
        .subquery()
    )

    last_mating_any_record_sq = (
        db.query(
            MatingRecord.female_id.label("female_id"),
            func.max(MatingRecord.mated_at).label("last_mating_at"),
        )
        .group_by(MatingRecord.female_id)
        .subquery()
    )

    female_ids: set[str] = set()

    for row in db.query(last_mating_with_male_event_sq.c.female_id).all():
        if row and row[0]:
            female_ids.add(row[0])

    for row in db.query(last_mating_with_male_record_sq.c.female_id).all():
        if row and row[0]:
            female_ids.add(row[0])

    if include_fallback:
        candidates = _canonical_mate_code_candidates(male_code)
        if candidates:
            fallback_rows = (
                db.query(Product.id)
                .filter(Product.series_id.isnot(None))
                .filter(Product.sex == "female")
                .filter(Product.mate_code.in_(candidates))
                .all()
            )
            for r in fallback_rows:
                female_ids.add(r[0])

    if not female_ids:
        return ApiResponse(
            data={
                "maleId": breeder.id,
                "maleCode": male_code,
                "totals": {"relatedFemales": 0, "needMating": 0, "warning": 0},
                "items": [],
            },
            message="Male mate load retrieved successfully",
        )

    rows = (
        db.query(
            Product,
            last_egg_sq.c.last_egg_at,
            last_mating_any_sq.c.last_mating_at,
            last_mating_with_male_sq.c.last_mating_with_male_at,
        )
        .outerjoin(last_egg_sq, last_egg_sq.c.female_id == Product.id)
        .outerjoin(last_mating_any_sq, last_mating_any_sq.c.female_id == Product.id)
        .outerjoin(last_mating_with_male_sq, last_mating_with_male_sq.c.female_id == Product.id)
        .filter(Product.id.in_(list(female_ids)))
        .filter(Product.series_id.isnot(None))
        .filter(Product.sex == "female")
        .all()
    )

    now = datetime.utcnow()

    items: list[dict] = []
    need_count = 0
    warning_count = 0

    for female, last_egg_at, last_mating_at, last_mating_with_male_at in rows:
        status = _compute_need_mating_status(now, last_egg_at, last_mating_at)
        if status == "need_mating":
            need_count += 1
        elif status == "warning":
            warning_count += 1

        days_since_egg = (now.date() - last_egg_at.date()).days if last_egg_at else None

        items.append(
            {
                "femaleId": female.id,
                "femaleCode": female.code,
                "lastEggAt": last_egg_at.isoformat() if last_egg_at else None,
                "lastMatingAt": last_mating_at.isoformat() if last_mating_at else None,
                "lastMatingWithThisMaleAt": last_mating_with_male_at.isoformat() if last_mating_with_male_at else None,
                "daysSinceEgg": days_since_egg,
                "status": status,
            }
        )

    severity = {"warning": 2, "need_mating": 1, "normal": 0}
    # Most urgent first: warning -> need_mating -> normal.
    # Within the same status, larger daysSinceEgg (i.e. older last egg) first.
    items.sort(
        key=lambda it: (
            severity.get(it["status"], 0),
            it.get("daysSinceEgg") or -1,
            it["femaleCode"] or "",
        ),
        reverse=True,
    )

    return ApiResponse(
        data={
            "maleId": breeder.id,
            "maleCode": male_code,
            "totals": {"relatedFemales": len(items), "needMating": need_count, "warning": warning_count},
            "items": items[:limit],
        },
        message="Male mate load retrieved successfully",
    )


def _get_breeder_by_code(db: Session, code: Optional[str]) -> Optional[Product]:
    """Helper to get breeder by code."""
    if not code:
        return None
    from sqlalchemy.orm import joinedload
    return (
        db.query(Product)
        .options(joinedload(Product.images))
        .filter(Product.code == code)
        .filter(Product.series_id.isnot(None))
        .filter(Product.sex.isnot(None))
        .first()
    )


def _resolve_current_mate(db: Session, breeder: Product) -> Optional[Product]:
    """Resolve the current mate (male breeder) for a female breeder.

    Priority:
    1) Latest "更换配偶为..." event in breeder.description
    2) Latest mating record's male
    """

    if not breeder or breeder.sex != "female":
        return None

    # First priority: explicit mate_code (admin-managed).
    explicit_code = (getattr(breeder, "mate_code", None) or "").strip()
    if explicit_code:
        candidates = [explicit_code]
        if explicit_code.endswith("公"):
            candidates.append(explicit_code[: -1])
        else:
            candidates.append(explicit_code + "公")

        for c in candidates:
            mate = _get_breeder_by_code(db, c)
            if mate and mate.sex == "male":
                return mate

    # Second priority: last "更换配偶为..." event in description.
    code = parse_current_mate_code(getattr(breeder, "description", None))
    if code:
        # Notes may include or omit the trailing "公" marker; try both.
        candidates = [code]
        if code.endswith("公"):
            candidates.append(code[: -1])
        else:
            candidates.append(code + "公")

        for c in candidates:
            mate = _get_breeder_by_code(db, c)
            if mate and mate.sex == "male":
                return mate

    latest = (
        db.query(MatingRecord)
        .filter(MatingRecord.female_id == breeder.id)
        .order_by(MatingRecord.mated_at.desc())
        .first()
    )
    if latest and latest.male_id:
        mate = db.query(Product).filter(Product.id == latest.male_id).first()
        if mate and mate.sex == "male":
            return mate

    return None


def _build_node(breeder: Product, generation: int, relationship: str) -> dict:
    """Build a family tree node from a breeder."""
    if not breeder:
        return None

    # Get main image from product_images relationship
    thumbnail_url = None
    if breeder.images:
        # Try to find main image first, otherwise use first image
        main_image = next((img for img in breeder.images if img.type == "main"), None)
        if main_image:
            thumbnail_url = main_image.url
        elif breeder.images:
            thumbnail_url = breeder.images[0].url

    return {
        "id": breeder.id,
        "code": breeder.code,
        "sex": breeder.sex,
        "thumbnailUrl": thumbnail_url,
        "generation": generation,
        "relationship": relationship,
        "sireCode": breeder.sire_code,
        "damCode": breeder.dam_code,
    }


@router.get("/{breeder_id}/family-tree", response_model=ApiResponse)
async def get_breeder_family_tree(
    breeder_id: str,
    db: Session = Depends(get_db),
):
    """Public: breeder family tree with ancestors and descendants."""
    from sqlalchemy.orm import joinedload
    breeder = (
        db.query(Product)
        .options(joinedload(Product.images))
        .filter(Product.id == breeder_id)
        .filter(Product.series_id.isnot(None))
        .filter(Product.sex.isnot(None))
        .first()
    )
    if not breeder:
        raise HTTPException(status_code=404, detail="Breeder not found")

    # Build current node
    current = _build_node(breeder, 0, "current")

    mate = _resolve_current_mate(db, breeder)
    current_mate = {"id": mate.id, "code": mate.code} if mate else None

    # Get ancestors
    ancestors = {}

    # Parents
    father = _get_breeder_by_code(db, breeder.sire_code)
    mother = _get_breeder_by_code(db, breeder.dam_code)

    if father:
        ancestors["father"] = _build_node(father, -1, "father")
        # Get father's siblings
        if father.dam_code:
            father_siblings = (
                db.query(Product)
                .filter(Product.dam_code == father.dam_code)
                .filter(Product.id != father.id)
                .filter(Product.series_id.isnot(None))
                .filter(Product.sex.isnot(None))
                .all()
            )
            ancestors["father"]["siblings"] = [
                _build_node(s, -1, "father_sibling") for s in father_siblings
            ]

        # Grandparents (paternal)
        paternal_grandfather = _get_breeder_by_code(db, father.sire_code)
        paternal_grandmother = _get_breeder_by_code(db, father.dam_code)

        if paternal_grandfather:
            ancestors["paternalGrandfather"] = _build_node(paternal_grandfather, -2, "paternal_grandfather")
            # Great-grandparents (paternal-paternal)
            ppgg_father = _get_breeder_by_code(db, paternal_grandfather.sire_code)
            ppgg_mother = _get_breeder_by_code(db, paternal_grandfather.dam_code)
            if ppgg_father:
                ancestors["paternalPaternalGreatGrandfather"] = _build_node(ppgg_father, -3, "great_grandfather")
            if ppgg_mother:
                ancestors["paternalPaternalGreatGrandmother"] = _build_node(ppgg_mother, -3, "great_grandmother")

        if paternal_grandmother:
            ancestors["paternalGrandmother"] = _build_node(paternal_grandmother, -2, "paternal_grandmother")
            # Great-grandparents (paternal-maternal)
            pmgg_father = _get_breeder_by_code(db, paternal_grandmother.sire_code)
            pmgg_mother = _get_breeder_by_code(db, paternal_grandmother.dam_code)
            if pmgg_father:
                ancestors["paternalMaternalGreatGrandfather"] = _build_node(pmgg_father, -3, "great_grandfather")
            if pmgg_mother:
                ancestors["paternalMaternalGreatGrandmother"] = _build_node(pmgg_mother, -3, "great_grandmother")

    if mother:
        ancestors["mother"] = _build_node(mother, -1, "mother")
        # Get mother's siblings
        if mother.dam_code:
            mother_siblings = (
                db.query(Product)
                .filter(Product.dam_code == mother.dam_code)
                .filter(Product.id != mother.id)
                .filter(Product.series_id.isnot(None))
                .filter(Product.sex.isnot(None))
                .all()
            )
            ancestors["mother"]["siblings"] = [
                _build_node(s, -1, "mother_sibling") for s in mother_siblings
            ]

        # Grandparents (maternal)
        maternal_grandfather = _get_breeder_by_code(db, mother.sire_code)
        maternal_grandmother = _get_breeder_by_code(db, mother.dam_code)

        if maternal_grandfather:
            ancestors["maternalGrandfather"] = _build_node(maternal_grandfather, -2, "maternal_grandfather")
            # Great-grandparents (maternal-paternal)
            mpgg_father = _get_breeder_by_code(db, maternal_grandfather.sire_code)
            mpgg_mother = _get_breeder_by_code(db, maternal_grandfather.dam_code)
            if mpgg_father:
                ancestors["maternalPaternalGreatGrandfather"] = _build_node(mpgg_father, -3, "great_grandfather")
            if mpgg_mother:
                ancestors["maternalPaternalGreatGrandmother"] = _build_node(mpgg_mother, -3, "great_grandmother")

        if maternal_grandmother:
            ancestors["maternalGrandmother"] = _build_node(maternal_grandmother, -2, "maternal_grandmother")
            # Great-grandparents (maternal-maternal)
            mmgg_father = _get_breeder_by_code(db, maternal_grandmother.sire_code)
            mmgg_mother = _get_breeder_by_code(db, maternal_grandmother.dam_code)
            if mmgg_father:
                ancestors["maternalMaternalGreatGrandfather"] = _build_node(mmgg_father, -3, "great_grandfather")
            if mmgg_mother:
                ancestors["maternalMaternalGreatGrandmother"] = _build_node(mmgg_mother, -3, "great_grandmother")

    # Get descendants (offspring)
    offspring = []
    if breeder.sex == "male":
        # Find offspring where this breeder is the father
        children = (
            db.query(Product)
            .filter(Product.sire_code == breeder.code)
            .filter(Product.series_id.isnot(None))
            .filter(Product.sex.isnot(None))
            .all()
        )
        offspring = [_build_node(child, 1, "offspring") for child in children]
    elif breeder.sex == "female":
        # Find offspring where this breeder is the mother
        children = (
            db.query(Product)
            .filter(Product.dam_code == breeder.code)
            .filter(Product.series_id.isnot(None))
            .filter(Product.sex.isnot(None))
            .all()
        )
        offspring = [_build_node(child, 1, "offspring") for child in children]

    # Get siblings (same parents)
    siblings = []
    if breeder.dam_code:
        sibling_query = (
            db.query(Product)
            .filter(Product.dam_code == breeder.dam_code)
            .filter(Product.id != breeder.id)
            .filter(Product.series_id.isnot(None))
            .filter(Product.sex.isnot(None))
        )
        if breeder.sire_code:
            sibling_query = sibling_query.filter(Product.sire_code == breeder.sire_code)
        siblings_list = sibling_query.all()
        siblings = [_build_node(s, 0, "sibling") for s in siblings_list]

    # Get mating records for current breeder
    mating_records = []
    egg_records = []

    if breeder.sex == "female":
        matings = (
            db.query(MatingRecord)
            .filter(MatingRecord.female_id == breeder.id)
            .order_by(MatingRecord.mated_at.desc())
            .all()
        )
        male_ids = {r.male_id for r in matings}
        male_map = {
            p.id: p
            for p in db.query(Product).filter(Product.id.in_(male_ids)).all()
        }
        mating_records = [
            {
                "id": r.id,
                "maleId": r.male_id,
                "maleCode": male_map.get(r.male_id).code if male_map.get(r.male_id) else None,
                "matedAt": r.mated_at.isoformat() if r.mated_at else None,
                "notes": r.notes,
            }
            for r in matings
        ]

        eggs = (
            db.query(EggRecord)
            .filter(EggRecord.female_id == breeder.id)
            .order_by(EggRecord.laid_at.desc())
            .all()
        )
        egg_records = [
            {
                "id": r.id,
                "laidAt": r.laid_at.isoformat() if r.laid_at else None,
                "count": r.count,
                "notes": r.notes,
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
        female_ids = {r.female_id for r in matings}
        female_map = {
            p.id: p
            for p in db.query(Product).filter(Product.id.in_(female_ids)).all()
        }
        mating_records = [
            {
                "id": r.id,
                "femaleId": r.female_id,
                "femaleCode": female_map.get(r.female_id).code if female_map.get(r.female_id) else None,
                "matedAt": r.mated_at.isoformat() if r.mated_at else None,
                "notes": r.notes,
            }
            for r in matings
        ]

    data = {
        "current": current,
        "currentMate": current_mate,
        "ancestors": ancestors,
        "offspring": offspring,
        "siblings": siblings,
        "matingRecords": mating_records,
        "eggRecords": egg_records,
    }

    return ApiResponse(data=data, message="Family tree retrieved successfully")
