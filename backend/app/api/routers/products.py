from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
import logging

from app.db.session import get_db
from app.models.models import Product, FeaturedProduct
from app.schemas.schemas import ApiResponse, SortOption
from app.api.utils import convert_product_to_response, split_category_values, group_categories

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/featured", response_model=ApiResponse)
async def get_featured_products(
    limit: int = Query(8, ge=1, le=100),
    db: Session = Depends(get_db)
):
    featured_products = db.query(Product).filter(
        Product.is_featured == True
    ).order_by(Product.created_at.desc()).limit(limit).all()

    products = [convert_product_to_response(p) for p in featured_products]
    if not products:
        fallback_products = db.query(Product).order_by(Product.created_at.desc()).limit(limit).all()
        products = [convert_product_to_response(p) for p in fallback_products]
    return ApiResponse(
        data=products,
        message="Featured products retrieved successfully"
    )

@router.get("/filter-options", response_model=ApiResponse)
async def get_filter_options(db: Session = Depends(get_db)):
    """Get available filter options with improved grouping."""

    # Get price range
    price_min = 0
    price_max = 0
    try:
        prices = [p[0] for p in db.query(Product.price).filter(Product.price.isnot(None)).all()]
        if prices:
            price_min = min(prices)
            price_max = max(prices)
    except Exception as e:
        logger.warning(f"Error calculating price range: {e}")

    return ApiResponse(
        data={
            "priceRange": {"min": price_min, "max": price_max}
        },
        message="Filter options retrieved successfully"
    )

@router.get("", response_model=ApiResponse)
async def get_products(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
    search: Optional[str] = Query(None),
    sort: Optional[SortOption] = Query(None),
    sex: Optional[str] = Query(None),
    series_id: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    price_min: Optional[float] = Query(None),
    price_max: Optional[float] = Query(None),
    db: Session = Depends(get_db)
):
    """Get products with filtering, sorting, and pagination."""
    query = db.query(Product)

    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Product.name.ilike(search_term),
                Product.code.ilike(search_term),
                Product.description.ilike(search_term)
            )
        )

    # Apply turtle-specific filters
    if sex:
        query = query.filter(Product.sex == sex)

    if series_id:
        query = query.filter(Product.series_id == series_id)

    if stage:
        query = query.filter(Product.stage == stage)

    if status:
        query = query.filter(Product.status == status)

    # Apply price range filter
    if price_min is not None:
        query = query.filter(Product.price >= price_min)
    if price_max is not None:
        query = query.filter(Product.price <= price_max)

    # Apply sorting
    if sort == SortOption.NEWEST:
        query = query.order_by(Product.created_at.desc())
    elif sort == SortOption.POPULAR:
        query = query.order_by(Product.popularity_score.desc())
    elif sort == SortOption.PRICE_LOW:
        query = query.order_by(Product.price.asc())
    elif sort == SortOption.PRICE_HIGH:
        query = query.order_by(Product.price.desc())
    else:
        query = query.order_by(Product.created_at.desc())

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * limit
    products = query.offset(offset).limit(limit).all()

    # Calculate total pages
    total_pages = (total + limit - 1) // limit

    # Convert to response format
    product_responses = [convert_product_to_response(product) for product in products]

    return ApiResponse(
        data={
            "products": product_responses,
            "total": total,
            "page": page,
            "totalPages": total_pages
        },
        message="Products retrieved successfully"
    )

@router.get("/{product_id}", response_model=ApiResponse)
async def get_product(product_id: str, db: Session = Depends(get_db)):
    """Get single product by ID."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return ApiResponse(
        data=convert_product_to_response(product),
        message="Product retrieved successfully"
    )
