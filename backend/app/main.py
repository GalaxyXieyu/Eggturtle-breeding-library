from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import os
import logging
from datetime import datetime

from app.db.session import get_db, create_tables
from app.core.security import create_admin_user
from app.schemas.schemas import ErrorResponse

# Import routers
from app.api.routers import auth, products, admin, carousels, featured, settings, imports

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
        "http://localhost:8080",
        "http://localhost:8081",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "https://frbzhxxscekk.sealoshzh.site",
        "http://frbzhxxscekk.sealoshzh.site"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
if not os.path.exists("static"):
    os.makedirs("static")
if not os.path.exists("static/images"):
    os.makedirs("static/images")

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/images", StaticFiles(directory="static/images"), name="images")

# Create tables and admin user on startup
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

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Glam Cart Builder API", "version": "1.0.0", "docs": "/docs"}

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
