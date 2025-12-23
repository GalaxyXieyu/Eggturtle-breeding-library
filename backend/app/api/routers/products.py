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

    # Get distinct values from database
    tube_types = db.query(Product.tube_type).filter(Product.tube_type.isnot(None)).distinct().all()
    box_types = db.query(Product.box_type).filter(Product.box_type.isnot(None)).distinct().all()
    shapes = db.query(Product.shape).distinct().all()
    materials = db.query(Product.material).distinct().all()
    functional_designs_query = db.query(Product.functional_designs).filter(Product.functional_designs.isnot(None)).distinct().all()

    # 展开所有分类值（支持 / 分隔的多值）
    expanded_tubes = split_category_values(tube_types)
    expanded_boxes = split_category_values(box_types)
    expanded_shapes = split_category_values(shapes)
    expanded_materials = split_category_values(materials)
    expanded_functions = split_category_values(functional_designs_query)

    # Get capacity range from dimensions JSON
    capacity_min = 0
    capacity_max = 100
    try:
        products_with_capacity = db.query(Product.dimensions).filter(Product.dimensions.isnot(None)).all()
        capacities = []
        for product in products_with_capacity:
            if product[0] and isinstance(product[0], dict):
                capacity_data = product[0].get('capacity', {})
                if isinstance(capacity_data, dict):
                    if 'min' in capacity_data:
                        capacities.append(capacity_data['min'])
                    if 'max' in capacity_data:
                        capacities.append(capacity_data['max'])
        if capacities:
            capacity_min = min(capacities)
            capacity_max = max(capacities)
    except Exception as e:
        logger.warning(f"Error calculating capacity range: {e}")

    # Get compartment range from dimensions JSON
    compartment_min = 1
    compartment_max = 10
    try:
        products_with_compartments = db.query(Product.dimensions).filter(Product.dimensions.isnot(None)).all()
        compartments = []
        for product in products_with_compartments:
            if product[0] and isinstance(product[0], dict):
                compartment_count = product[0].get('compartments')
                if compartment_count:
                    compartments.append(compartment_count)
        if compartments:
            compartment_min = min(compartments)
            compartment_max = max(compartments)
    except Exception as e:
        logger.warning(f"Error calculating compartment range: {e}")

    # Get price range
    price_min = 0
    price_max = 0
    try:
        prices = [p[0] for p in db.query(Product.factory_price).filter(Product.factory_price.isnot(None)).all()]
        if prices:
            price_min = min(prices)
            price_max = max(prices)
    except Exception as e:
        logger.warning(f"Error calculating price range: {e}")

    return ApiResponse(
        data={
            "tubeTypes": expanded_tubes,
            "boxTypes": expanded_boxes,
            "functionalDesigns": expanded_functions,
            "shapes": expanded_shapes,
            "materials": expanded_materials,
            "capacityRange": {"min": capacity_min, "max": capacity_max},
            "compartmentRange": {"min": compartment_min, "max": compartment_max},
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
    tube_types: Optional[str] = Query(None),
    box_types: Optional[str] = Query(None),
    functional_designs: Optional[str] = Query(None),
    process_types: Optional[str] = Query(None),
    shapes: Optional[str] = Query(None),
    materials: Optional[str] = Query(None),
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

    # Apply filters with multi-value support
    if tube_types:
        tube_type_list = tube_types.split(",")
        # Use OR conditions to match any of the selected tube types
        tube_conditions = []
        for tube_type in tube_type_list:
            tube_conditions.append(Product.tube_type.like(f"%{tube_type}%"))
        if tube_conditions:
            query = query.filter(or_(*tube_conditions))

    if box_types:
        box_type_list = box_types.split(",")
        # Use OR conditions to match any of the selected box types
        box_conditions = []
        for box_type in box_type_list:
            box_conditions.append(Product.box_type.like(f"%{box_type}%"))
        if box_conditions:
            query = query.filter(or_(*box_conditions))

    if functional_designs:
        functional_design_list = functional_designs.split(",")
        # Use OR conditions to match any of the selected functional designs
        function_conditions = []
        for design in functional_design_list:
            function_conditions.append(Product.functional_designs.like(f"%{design}%"))
        if function_conditions:
            query = query.filter(or_(*function_conditions))

    if shapes:
        shape_list = shapes.split(",")
        # Use OR conditions to match any of the selected shapes
        shape_conditions = []
        for shape in shape_list:
            shape_conditions.append(Product.shape.like(f"%{shape}%"))
        if shape_conditions:
            query = query.filter(or_(*shape_conditions))

    if materials:
        material_list = materials.split(",")
        # Use OR conditions to match any of the selected materials
        material_conditions = []
        for material in material_list:
            material_conditions.append(Product.material.like(f"%{material}%"))
        if material_conditions:
            query = query.filter(or_(*material_conditions))

    # Apply sorting
    if sort == SortOption.NEWEST:
        query = query.order_by(Product.created_at.desc())
    elif sort == SortOption.POPULAR:
        query = query.order_by(Product.popularity_score.desc())
    elif sort == SortOption.PRICE_LOW:
        query = query.order_by(Product.factory_price.asc())
    elif sort == SortOption.PRICE_HIGH:
        query = query.order_by(Product.factory_price.desc())
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
