from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.orm import Session
from typing import Optional
import logging

from app.db.session import get_db
from app.schemas.schemas import ApiResponse
from app.core.security import get_current_active_user, User
from app.services.import_service import BatchImportService

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/template")
async def get_import_template(
    current_user: User = Depends(get_current_active_user)
):
    """Download the Excel template for batch import."""
    try:
        content = BatchImportService.generate_template()
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=product_import_template.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate template: {str(e)}")

@router.post("", response_model=ApiResponse)
async def batch_import_products(
    excel_file: UploadFile = File(...),
    zip_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Batch import products from Excel and optional ZIP of images.
    Returns a detailed report of success/failure.
    """
    if not excel_file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an Excel file.")
    if zip_file and not zip_file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a ZIP file for images.")

    try:
        excel_content = await excel_file.read()
        zip_content = await zip_file.read() if zip_file else None
        
        result = await BatchImportService.process_import(db, excel_content, zip_content)
        
        if not result["success"]:
            # If the process itself failed (not just individual rows)
            raise HTTPException(status_code=400, detail=result["message"])
            
        return ApiResponse(
            data=result,
            message=f"Import completed. Processed: {result['total']}, Success: {result['imported']}, Failed: {result['failed']}"
        )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch import error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error during import: {str(e)}")
