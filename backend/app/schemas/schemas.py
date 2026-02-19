from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

class SortOption(str, Enum):
    NEWEST = "newest"
    POPULAR = "popular"
    PRICE_LOW = "price_low"
    PRICE_HIGH = "price_high"

# Base schemas
class ProductDimensions(BaseModel):
    weight: Optional[float] = None
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    capacity: Optional[Dict[str, float]] = None  # {"min": float, "max": float}
    compartments: Optional[int] = None

class ProductPricing(BaseModel):
    has_sample: bool = False
    box_dimensions: Optional[str] = None
    box_quantity: Optional[int] = None

class ProductImageBase(BaseModel):
    url: str
    alt: str
    type: str  # 'main', 'gallery', 'dimensions', 'detail'
    sort_order: int = 0

class ProductImageCreate(ProductImageBase):
    pass

class ProductImageResponse(ProductImageBase):
    id: str
    product_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# Product schemas - 完全没有枚举约束
class ProductBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None

    # Turtle-album extensions (optional in generic Product schema for backward compatibility)
    series_id: Optional[str] = None
    sex: Optional[str] = None  # 'male' | 'female'
    offspring_unit_price: Optional[float] = None
    sire_code: Optional[str] = None
    dam_code: Optional[str] = None
    sire_image_url: Optional[str] = None
    dam_image_url: Optional[str] = None

    product_type: Optional[str] = None
    tube_type: Optional[str] = None
    box_type: Optional[str] = None
    process_type: Optional[str] = None
    functional_designs: List[str] = []
    shape: str
    material: str
    dimensions: ProductDimensions
    cost_price: Optional[float] = None
    factory_price: float
    has_sample: bool = False
    box_dimensions: Optional[str] = None
    box_quantity: Optional[int] = None
    in_stock: bool = True
    popularity_score: int = 0
    is_featured: bool = False

class ProductCreate(ProductBase):
    images: List[ProductImageCreate] = []

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None

    # Turtle-album extensions (optional)
    series_id: Optional[str] = None
    sex: Optional[str] = None
    offspring_unit_price: Optional[float] = None
    sire_code: Optional[str] = None
    dam_code: Optional[str] = None
    sire_image_url: Optional[str] = None
    dam_image_url: Optional[str] = None

    product_type: Optional[str] = None
    tube_type: Optional[str] = None
    box_type: Optional[str] = None
    process_type: Optional[str] = None
    functional_designs: Optional[List[str]] = None
    shape: Optional[str] = None
    material: Optional[str] = None
    dimensions: Optional[ProductDimensions] = None
    cost_price: Optional[float] = None
    factory_price: Optional[float] = None
    has_sample: Optional[bool] = None
    box_dimensions: Optional[str] = None
    box_quantity: Optional[int] = None
    in_stock: Optional[bool] = None
    popularity_score: Optional[int] = None
    is_featured: Optional[bool] = None

class ProductResponse(ProductBase):
    id: str
    images: List[ProductImageResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProductFilters(BaseModel):
    tube_types: Optional[List[str]] = None
    box_types: Optional[List[str]] = None
    process_types: Optional[List[str]] = None
    functional_designs: Optional[List[str]] = None
    shapes: Optional[List[str]] = None
    materials: Optional[List[str]] = None
    capacity_range: Optional[Dict[str, float]] = None  # {"min": float, "max": float}
    compartment_range: Optional[Dict[str, int]] = None  # {"min": int, "max": int}
    search_text: Optional[str] = None

class SortOption(str, Enum):
    NEWEST = 'newest'
    POPULAR = 'popular'
    PRICE_LOW = 'price_low'
    PRICE_HIGH = 'price_high'

class ProductListResponse(BaseModel):
    products: List[ProductResponse]
    total: int
    page: int
    total_pages: int

class FilterOptionsResponse(BaseModel):
    tube_types: List[str]
    box_types: List[str]
    process_types: List[str]
    functional_designs: List[str]
    shapes: List[str]
    materials: List[str]
    capacity_range: Dict[str, float]
    price_range: Dict[str, float]

# Authentication schemas
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    token: str
    user: Dict[str, Any]
    expires_at: str

class UserResponse(BaseModel):
    id: str
    username: str
    role: str

# Response schemas
class ApiResponse(BaseModel):
    data: Any
    message: Optional[str] = None
    success: bool = True


# Turtle-album: Series admin schemas
class SeriesCreate(BaseModel):
    code: Optional[str] = None
    name: str
    sort_order: Optional[int] = None
    is_active: bool = True


class SeriesUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


# Turtle-album: mating / egg record schemas (admin write, public read)
class MatingRecordCreate(BaseModel):
    female_id: str
    male_id: str
    mated_at: datetime
    notes: Optional[str] = None


class EggRecordCreate(BaseModel):
    female_id: str
    laid_at: datetime
    count: Optional[int] = None
    notes: Optional[str] = None

class ErrorResponse(BaseModel):
    message: str
    success: bool = False
    details: Optional[Any] = None

# Image upload schema
class ImageUploadResponse(BaseModel):
    images: List[ProductImageResponse]

# Carousel schemas
class CarouselBase(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: str
    link_url: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0

class CarouselCreate(CarouselBase):
    pass

class CarouselUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None

class CarouselResponse(CarouselBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Featured product schemas
class FeaturedProductBase(BaseModel):
    product_id: str
    is_active: bool = True
    sort_order: int = 0

class FeaturedProductCreate(FeaturedProductBase):
    pass

class FeaturedProductUpdate(BaseModel):
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None

class FeaturedProductResponse(FeaturedProductBase):
    id: str
    product: ProductResponse
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True 