from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.db.session import get_db
from app.models.models import Product, ProductImage, SeriesProductRelation
from app.schemas.schemas import ProductCreate, ProductUpdate, ApiResponse
from app.core.security import get_current_active_user, User
from app.core.file_utils import delete_file, save_product_images_optimized
from app.api.utils import convert_product_to_response

router = APIRouter()


def _sync_primary_series_relation(db: Session, product: Product) -> None:
    """Keep series_product_rel consistent with products.series_id during the transition period."""
    db.query(SeriesProductRelation).filter(SeriesProductRelation.product_id == product.id).delete()
    if product.series_id:
        db.add(SeriesProductRelation(series_id=product.series_id, product_id=product.id))

@router.post("", response_model=ApiResponse)
async def create_product(
    product_data: ProductCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new product (admin only)."""
    # Check if product code already exists
    existing_product = db.query(Product).filter(Product.code == product_data.code).first()
    if existing_product:
        raise HTTPException(status_code=400, detail="Product code already exists")

    # Create product
    product = Product(
        name=product_data.name,
        code=product_data.code,
        description=product_data.description,

        stage=product_data.stage,
        status=product_data.status,

        # Turtle-album extensions
        series_id=product_data.series_id,
        sex=product_data.sex,
        offspring_unit_price=product_data.offspring_unit_price,
        sire_code=product_data.sire_code,
        dam_code=product_data.dam_code,
        sire_image_url=product_data.sire_image_url,
        dam_image_url=product_data.dam_image_url,

        cost_price=product_data.cost_price or 0,
        factory_price=product_data.factory_price,
        has_sample=product_data.has_sample,
        in_stock=product_data.in_stock,
        popularity_score=product_data.popularity_score,
        is_featured=product_data.is_featured
    )

    db.add(product)
    db.commit()
    db.refresh(product)

    _sync_primary_series_relation(db, product)
    db.commit()

    # Add images if provided
    for image_data in product_data.images:
        image = ProductImage(
            product_id=product.id,
            url=image_data.url,
            alt=image_data.alt,
            type=image_data.type
        )
        db.add(image)
    
    db.commit()
    db.refresh(product)

    return ApiResponse(
        data=convert_product_to_response(product),
        message="Product created successfully"
    )

@router.put("/{product_id}", response_model=ApiResponse)
async def update_product(
    product_id: str,
    product_data: ProductUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update an existing product (admin only)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if new code conflicts with existing products
    if product_data.code and product_data.code != product.code:
        existing_product = db.query(Product).filter(Product.code == product_data.code).first()
        if existing_product:
            raise HTTPException(status_code=400, detail="Product code already exists")

    # Update fields
    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "dimensions" and value:
            setattr(product, field, value.model_dump() if hasattr(value, 'model_dump') else value)
        elif field == "functional_designs" and value:
            # Convert list to comma-separated string
            setattr(product, field, ','.join(value) if isinstance(value, list) else value)
        else:
            setattr(product, field, value)

    db.commit()
    db.refresh(product)

    _sync_primary_series_relation(db, product)
    db.commit()

    return ApiResponse(
        data=convert_product_to_response(product),
        message="Product updated successfully"
    )

@router.delete("/{product_id}", response_model=ApiResponse)
async def delete_product(
    product_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a product (admin only)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Delete associated image files
    for image in product.images:
        delete_file(image.url)  # type: ignore

    # Keep relation table clean during transition.
    db.query(SeriesProductRelation).filter(SeriesProductRelation.product_id == product.id).delete()

    # Delete product (cascade will handle images)
    db.delete(product)
    db.commit()

    return ApiResponse(
        data=None,
        message="Product deleted successfully"
    )

@router.post("/{product_id}/images", response_model=ApiResponse)
async def upload_product_images(
    product_id: str,
    images: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload images for a product with automatic optimization (admin only)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if not images:
        raise HTTPException(status_code=400, detail="No images provided")

    # Save and optimize uploaded files
    try:
        saved_images_info = await save_product_images_optimized(images, product.code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Get current max sort_order for this product
    max_sort_order = db.query(func.max(ProductImage.sort_order)).filter(
        ProductImage.product_id == product.id
    ).scalar() or -1

    # If a new main image is uploaded, demote any existing main.
    if any(img.get("type") == "main" for img in saved_images_info):
        db.query(ProductImage).filter(
            ProductImage.product_id == product.id,
            ProductImage.type == "main",
        ).update({"type": "gallery"})
        db.flush()

    # Create image records in database
    created_images = []
    for i, img_info in enumerate(saved_images_info):
        image = ProductImage(
            product_id=product.id,
            url=img_info["url"],
            alt=img_info["alt"],
            type=img_info["type"],
            sort_order=max_sort_order + i + 1  # Append to end
        )
        db.add(image)
        created_images.append(image)

    db.commit()

    # Refresh to get IDs
    for image in created_images:
        db.refresh(image)

    return ApiResponse(
        data={
            "images": [
                {
                    "id": img.id,
                    "url": img.url,
                    "alt": img.alt,
                    "type": img.type
                }
                for img in created_images
            ]
        },
        message=f"Successfully uploaded and optimized {len(created_images)} images"
    )

@router.delete("/{product_id}/images/{image_id}", response_model=ApiResponse)
async def delete_product_image(
    product_id: str,
    image_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a product image (admin only)."""
    image = db.query(ProductImage).filter(
        ProductImage.id == image_id,
        ProductImage.product_id == product_id
    ).first()

    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    was_main = image.type == "main"

    # Delete file
    delete_file(image.url)  # type: ignore

    # Delete database record
    db.delete(image)
    db.commit()

    # Keep invariant: when main is deleted, promote the first remaining image.
    if was_main:
        next_img = (
            db.query(ProductImage)
            .filter(ProductImage.product_id == product_id)
            .order_by(ProductImage.sort_order.asc())
            .first()
        )
        if next_img:
            next_img.type = "main"
            db.commit()

    return ApiResponse(
        data=None,
        message="Image deleted successfully"
    )


@router.put("/{product_id}/images/{image_id}/set-main", response_model=ApiResponse)
async def set_product_main_image(
    product_id: str,
    image_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Set one image as the main image for a product (admin only)."""
    image = db.query(ProductImage).filter(
        ProductImage.id == image_id,
        ProductImage.product_id == product_id,
    ).first()

    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Demote existing main.
    db.query(ProductImage).filter(
        ProductImage.product_id == product_id,
        ProductImage.type == "main",
        ProductImage.id != image_id,
    ).update({"type": "gallery"})

    image.type = "main"
    db.commit()

    # Return the updated image list for convenience.
    images = (
        db.query(ProductImage)
        .filter(ProductImage.product_id == product_id)
        .order_by(ProductImage.sort_order.asc())
        .all()
    )

    return ApiResponse(
        data={
            "images": [
                {"id": img.id, "url": img.url, "alt": img.alt, "type": img.type}
                for img in images
            ]
        },
        message="Main image updated successfully",
    )

@router.put("/{product_id}/images/reorder", response_model=ApiResponse)
async def reorder_product_images(
    product_id: str,
    image_orders: List[dict],  # [{"id": "image_id", "sort_order": 0}, ...]
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Reorder product images (admin only)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Update sort orders
    for order_data in image_orders:
        image = db.query(ProductImage).filter(
            ProductImage.id == order_data["id"],
            ProductImage.product_id == product_id
        ).first()

        if image:
            image.sort_order = order_data["sort_order"]

    db.commit()

    # Return updated images
    updated_images = db.query(ProductImage).filter(
        ProductImage.product_id == product_id
    ).order_by(ProductImage.sort_order).all()

    return ApiResponse(
        data=[{
            "id": img.id,
            "url": img.url,
            "alt": img.alt,
            "type": img.type,
            "sort_order": img.sort_order
        } for img in updated_images],
        message="Images reordered successfully"
    )
