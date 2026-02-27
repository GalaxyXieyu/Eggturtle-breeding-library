import logging
from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.models.models import Carousel
from app.schemas.schemas import ApiResponse
from app.core.security import get_current_active_user, User
from app.core.file_utils import delete_file, save_carousel_image

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("", response_model=ApiResponse)
async def get_carousels(db: Session = Depends(get_db)):
    """Get all active carousels ordered by sort_order."""
    carousels = db.query(Carousel).filter(
        Carousel.is_active == True
    ).order_by(Carousel.sort_order.asc()).all()

    carousel_responses = [
        {
            "id": carousel.id,
            "title": carousel.title,
            "description": carousel.description,
            "imageUrl": carousel.image_url,
            "linkUrl": carousel.link_url,
            "isActive": carousel.is_active,
            "sortOrder": carousel.sort_order,
            "createdAt": carousel.created_at.isoformat(),
            "updatedAt": carousel.updated_at.isoformat()
        }
        for carousel in carousels
    ]

    return ApiResponse(
        data=carousel_responses,
        message="Carousels retrieved successfully"
    )

@router.post("", response_model=ApiResponse)
async def create_carousel(
    title: str = Form(...),
    description: str = Form(""),
    linkUrl: str = Form(""),
    isActive: bool = Form(True),
    sortOrder: int = Form(0),
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new carousel with image upload (admin only)."""
    # Save uploaded image with carousel-specific optimization
    try:
        image_url = await save_carousel_image(image)
    except Exception:
        logger.exception("Failed to save carousel image during create")
        raise HTTPException(status_code=400, detail="Failed to save image")

    carousel = Carousel(
        title=title,
        description=description,
        image_url=image_url,
        link_url=linkUrl,
        is_active=isActive,
        sort_order=sortOrder
    )

    db.add(carousel)
    db.commit()
    db.refresh(carousel)

    return ApiResponse(
        data={
            "id": carousel.id,
            "title": carousel.title,
            "description": carousel.description,
            "imageUrl": carousel.image_url,
            "linkUrl": carousel.link_url,
            "isActive": carousel.is_active,
            "sortOrder": carousel.sort_order,
            "createdAt": carousel.created_at.isoformat(),
            "updatedAt": carousel.updated_at.isoformat()
        },
        message="Carousel created successfully"
    )

@router.put("/{carousel_id}", response_model=ApiResponse)
async def update_carousel(
    carousel_id: str,
    title: str = Form(...),
    description: str = Form(""),
    linkUrl: str = Form(""),
    isActive: bool = Form(True),
    sortOrder: int = Form(0),
    image: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a carousel with optional image upload (admin only)."""
    carousel = db.query(Carousel).filter(Carousel.id == carousel_id).first()
    if not carousel:
        raise HTTPException(status_code=404, detail="Carousel not found")

    # Update basic fields
    setattr(carousel, 'title', title)
    setattr(carousel, 'description', description)
    setattr(carousel, 'link_url', linkUrl)
    setattr(carousel, 'is_active', isActive)
    setattr(carousel, 'sort_order', sortOrder)

    # Handle image update if provided
    if image and image.filename:
        # Delete old image
        if carousel.image_url:
            delete_file(carousel.image_url)

        # Save new image with carousel-specific optimization
        try:
            new_image_url = await save_carousel_image(image)
            setattr(carousel, 'image_url', new_image_url)
        except Exception:
            logger.exception("Failed to save carousel image during update", extra={"carousel_id": carousel_id})
            raise HTTPException(status_code=400, detail="Failed to save image")

    db.commit()
    db.refresh(carousel)

    return ApiResponse(
        data={
            "id": carousel.id,
            "title": carousel.title,
            "description": carousel.description,
            "imageUrl": carousel.image_url,
            "linkUrl": carousel.link_url,
            "isActive": carousel.is_active,
            "sortOrder": carousel.sort_order,
            "createdAt": carousel.created_at.isoformat(),
            "updatedAt": carousel.updated_at.isoformat()
        },
        message="Carousel updated successfully"
    )

@router.delete("/{carousel_id}", response_model=ApiResponse)
async def delete_carousel(
    carousel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a carousel (admin only)."""
    carousel = db.query(Carousel).filter(Carousel.id == carousel_id).first()
    if not carousel:
        raise HTTPException(status_code=404, detail="Carousel not found")

    # Delete associated image file
    delete_file(carousel.image_url)  # type: ignore

    # Delete carousel
    db.delete(carousel)
    db.commit()

    return ApiResponse(
        data=None,
        message="Carousel deleted successfully"
    )
