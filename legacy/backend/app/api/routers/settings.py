from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
import logging
import os

from app.db.session import get_db
from app.models.models import Settings
from app.schemas.schemas import ApiResponse
from app.core.security import get_current_active_user, User
from app.core.file_utils import save_multiple_files

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("", response_model=ApiResponse)
async def get_settings(db: Session = Depends(get_db)):
    """Get application settings."""
    settings = db.query(Settings).first()
    if not settings:
        # Create default settings if none exist
        settings = Settings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return ApiResponse(
        data={
            "id": settings.id,
            "companyName": settings.company_name,
            "companyLogo": settings.company_logo,
            "companyDescription": settings.company_description,
            "contactPhone": settings.contact_phone,
            "contactEmail": settings.contact_email,
            "contactAddress": settings.contact_address,
            "customerServiceQrCode": settings.customer_service_qr_code,
            "wechatNumber": settings.wechat_number,
            "updatedAt": settings.updated_at.isoformat()
        },
        message="Settings retrieved successfully"
    )

@router.put("", response_model=ApiResponse)
async def update_settings(
    company_name: str = Form(...),
    company_logo: str = Form(...),
    company_description: str = Form(...),
    contact_phone: str = Form(...),
    contact_email: str = Form(...),
    contact_address: str = Form(...),
    wechat_number: str = Form(...),
    qr_code_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update application settings (admin only)."""
    settings = db.query(Settings).first()
    if not settings:
        settings = Settings()
        db.add(settings)

    # Update basic settings
    settings.company_name = company_name
    settings.company_logo = company_logo
    settings.company_description = company_description
    settings.contact_phone = contact_phone
    settings.contact_email = contact_email
    settings.contact_address = contact_address
    settings.wechat_number = wechat_number

    # Handle QR code file upload
    if qr_code_file and qr_code_file.filename:
        try:
            # Delete old QR code file if exists
            if settings.customer_service_qr_code:
                old_file_path = os.path.join("static", settings.customer_service_qr_code)
                if os.path.exists(old_file_path):
                    os.remove(old_file_path)

            # Save new QR code file
            qr_code_files = await save_multiple_files([qr_code_file], "qr_codes")
            if qr_code_files:
                settings.customer_service_qr_code = qr_code_files[0]["url"]
        except Exception:
            logger.exception("Failed to upload QR code")
            raise HTTPException(status_code=400, detail="QR code upload failed")

    db.commit()
    db.refresh(settings)

    return ApiResponse(
        data={
            "id": settings.id,
            "companyName": settings.company_name,
            "companyLogo": settings.company_logo,
            "companyDescription": settings.company_description,
            "contactPhone": settings.contact_phone,
            "contactEmail": settings.contact_email,
            "contactAddress": settings.contact_address,
            "customerServiceQrCode": settings.customer_service_qr_code,
            "wechatNumber": settings.wechat_number,
            "updatedAt": settings.updated_at.isoformat()
        },
        message="Settings updated successfully"
    )
