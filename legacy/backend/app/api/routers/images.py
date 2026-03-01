import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

# Store originals in UPLOAD_DIR (default: static/images) and serve them via API
# instead of a direct StaticFiles mount. This keeps a single choke point for
# future auth / signed URL logic.
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "static/images"))


@router.get("/images/{filename}")
async def get_image(filename: str):
    # Prevent path traversal and directory access.
    if not filename or "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename")

    path = UPLOAD_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")

    # Let browser cache; images are content-addressed by filename in our usage.
    return FileResponse(path)
