from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.models.models import Product, MatingRecord, EggRecord
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
    """Public: list breeders (repurposed Product) with optional series/sex filters."""
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

    # Sort by code for consistent, user-friendly ordering (e.g. MG-01..MG-05).
    breeders = query.order_by(Product.code.asc(), Product.created_at.desc()).limit(limit).all()
    return ApiResponse(
        data=[convert_product_to_response(b) for b in breeders],
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
