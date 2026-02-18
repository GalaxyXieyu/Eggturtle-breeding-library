from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
import os
import logging
from datetime import datetime
from pathlib import Path

from app.db.session import get_db, create_tables
from app.core.security import create_admin_user
from app.schemas.schemas import ErrorResponse

# Import routers
from app.api.routers import auth, products, admin, carousels, featured, settings, imports, series, breeders, admin_series, admin_records

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Glam Cart Builder API",
    description="Backend API for the Glam Cart Builder application",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:5178",
        "http://localhost:5179",
        "http://localhost:5180",
        "http://localhost:5181",
        "http://localhost:8080",
        "http://localhost:8081",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5176",
        "http://127.0.0.1:5177",
        "http://127.0.0.1:5178",
        "http://127.0.0.1:5179",
        "http://127.0.0.1:5180",
        "http://127.0.0.1:5181",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "https://frbzhxxscekk.sealoshzh.site",
        "http://frbzhxxscekk.sealoshzh.site"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件目录配置（支持 PVC 挂载）
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "static/images")
STATIC_DIR = os.path.dirname(UPLOAD_DIR) if "/" in UPLOAD_DIR else "static"

# 确保目录存在
os.makedirs(UPLOAD_DIR, exist_ok=True)
if not os.path.exists("static"):
    os.makedirs("static")

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/images", StaticFiles(directory=UPLOAD_DIR), name="images")

# Initialize schema on startup.
# This project uses SQLAlchemy `create_all()` (no Alembic migrations).
@app.on_event("startup")
async def startup_event():
    create_tables()
    db = next(get_db())
    try:
        admin_user = create_admin_user(db)
        logger.info(f"Admin user created/verified: {admin_user.username}")
    except Exception as e:
        logger.error(f"Failed to create admin user: {e}")
    finally:
        db.close()

# Middleware for request logging
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = datetime.now()
    response = await call_next(request)
    process_time = datetime.now() - start_time
    
    logger.info(
        f"{request.method} {request.url.path} - "
        f"Status: {response.status_code} - "
        f"Time: {process_time.total_seconds():.3f}s"
    )
    
    return response

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            message=exc.detail,
            success=False
        ).model_dump()
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            message="Internal server error",
            success=False
        ).model_dump()
    )

# Include Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(admin.router, prefix="/api/products", tags=["Admin Products"]) 
app.include_router(carousels.router, prefix="/api/carousels", tags=["Carousels"])
app.include_router(featured.router, prefix="/api/featured-products", tags=["Featured Products"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(imports.router, prefix="/api/products/batch-import", tags=["Imports"])

# Turtle-album public APIs
app.include_router(series.router, prefix="/api/series", tags=["Series"])
app.include_router(breeders.router, prefix="/api/breeders", tags=["Breeders"])

# Turtle-album admin APIs
app.include_router(admin_series.router, prefix="/api/admin/series", tags=["Admin Series"])
app.include_router(admin_records.router, prefix="/api/admin", tags=["Admin Records"])

# Health check (放在静态文件之前)
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# 前端静态文件服务（生产环境）
FRONTEND_DIR = Path(__file__).parent.parent / "frontend_dist"

if FRONTEND_DIR.exists():
    # 挂载前端静态资源
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="frontend_assets")
    
    # SPA fallback: 所有非 API 路由返回 index.html
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # API 和静态文件路由已经在上面处理
        file_path = FRONTEND_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        # 返回 index.html 支持前端路由
        return FileResponse(FRONTEND_DIR / "index.html")
else:
    # 开发环境：返回 API 信息
    @app.get("/")
    async def root():
        return {"message": "Glam Cart Builder API", "version": "1.0.0", "docs": "/docs"}
