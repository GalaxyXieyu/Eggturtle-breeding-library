from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import FeaturedProduct, Product
from app.schemas.schemas import ApiResponse, FeaturedProductCreate, FeaturedProductUpdate
from app.core.security import get_current_active_user, User
from app.api.utils import convert_product_to_response

router = APIRouter()

@router.get("", response_model=ApiResponse)
async def get_featured_products_admin(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all featured products for admin management."""
    featured_products = db.query(FeaturedProduct).filter(
        FeaturedProduct.is_active == True
    ).order_by(FeaturedProduct.sort_order.asc()).all()

    featured_responses = []
    for featured in featured_products:
        product_data = convert_product_to_response(featured.product)
        featured_responses.append({
            "id": featured.id,
            "productId": featured.product_id,
            "product": product_data,
            "isActive": featured.is_active,
            "sortOrder": featured.sort_order,
            "createdAt": featured.created_at.isoformat(),
            "updatedAt": featured.updated_at.isoformat()
        })

    return ApiResponse(
        data=featured_responses,
        message="Featured products retrieved successfully"
    )

@router.post("", response_model=ApiResponse)
async def create_featured_product(
    featured_data: FeaturedProductCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a product to featured products (admin only)."""
    # Check if product exists
    product = db.query(Product).filter(Product.id == featured_data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if product is already featured
    existing_featured = db.query(FeaturedProduct).filter(
        FeaturedProduct.product_id == featured_data.product_id,
        FeaturedProduct.is_active == True
    ).first()
    if existing_featured:
        raise HTTPException(status_code=400, detail="Product is already featured")

    featured_product = FeaturedProduct(
        product_id=featured_data.product_id,
        is_active=featured_data.is_active,
        sort_order=featured_data.sort_order
    )

    db.add(featured_product)
    db.commit()
    db.refresh(featured_product)

    product_data = convert_product_to_response(featured_product.product)

    return ApiResponse(
        data={
            "id": featured_product.id,
            "productId": featured_product.product_id,
            "product": product_data,
            "isActive": featured_product.is_active,
            "sortOrder": featured_product.sort_order,
            "createdAt": featured_product.created_at.isoformat(),
            "updatedAt": featured_product.updated_at.isoformat()
        },
        message="Product added to featured successfully"
    )

@router.put("/{featured_id}", response_model=ApiResponse)
async def update_featured_product(
    featured_id: str,
    featured_data: FeaturedProductUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a featured product (admin only)."""
    featured_product = db.query(FeaturedProduct).filter(FeaturedProduct.id == featured_id).first()
    if not featured_product:
        raise HTTPException(status_code=404, detail="Featured product not found")

    # Update fields
    update_data = featured_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(featured_product, field, value)

    db.commit()
    db.refresh(featured_product)

    product_data = convert_product_to_response(featured_product.product)

    return ApiResponse(
        data={
            "id": featured_product.id,
            "productId": featured_product.product_id,
            "product": product_data,
            "isActive": featured_product.is_active,
            "sortOrder": featured_product.sort_order,
            "createdAt": featured_product.created_at.isoformat(),
            "updatedAt": featured_product.updated_at.isoformat()
        },
        message="Featured product updated successfully"
    )

@router.delete("/{featured_id}", response_model=ApiResponse)
async def delete_featured_product(
    featured_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a product from featured products (admin only)."""
    featured_product = db.query(FeaturedProduct).filter(FeaturedProduct.id == featured_id).first()
    if not featured_product:
        raise HTTPException(status_code=404, detail="Featured product not found")

    # Delete featured product entry
    db.delete(featured_product)
    db.commit()

    return ApiResponse(
        data=None,
        message="Product removed from featured successfully"
    )
