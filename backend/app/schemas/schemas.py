from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

class SortOption(str, Enum):
    NEWEST = "newest"
    POPULAR = "popular"
    PRICE_LOW = "price_low"
    PRICE_HIGH = "price_high"


# Base schemas
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

# Product schemas
class ProductBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    code: str
    description: Optional[str] = None


    # Turtle-album extensions (optional in generic Product schema for backward compatibility)
    series_id: Optional[str] = None
    sex: Optional[str] = None  # 'male' | 'female'
    offspring_unit_price: Optional[float] = None
    sire_code: Optional[str] = None
    dam_code: Optional[str] = None
    mate_code: Optional[str] = None
    sire_image_url: Optional[str] = None
    dam_image_url: Optional[str] = None

    cost_price: Optional[float] = None
    # Canonical selling price. For breeder records that are not for sale,
    # operators may omit this and the API will default it to 0.
    price: Optional[float] = None
    has_sample: bool = False

    in_stock: bool = True
    popularity_score: int = 0
    is_featured: bool = False

    @model_validator(mode="after")
    def _validate_breeder_rules(self):
        sex = (self.sex or "").lower()
        if self.offspring_unit_price is not None and sex != "female":
            raise ValueError("offspring_unit_price is only allowed for female breeders")
        if self.price is not None and self.price < 0:
            raise ValueError("price must be >= 0")
        return self

class ProductCreate(ProductBase):
    images: List[ProductImageCreate] = []

class ProductUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    code: Optional[str] = None
    description: Optional[str] = None

    # Turtle-album extensions (optional)
    series_id: Optional[str] = None
    sex: Optional[str] = None
    offspring_unit_price: Optional[float] = None
    sire_code: Optional[str] = None
    dam_code: Optional[str] = None
    mate_code: Optional[str] = None
    sire_image_url: Optional[str] = None
    dam_image_url: Optional[str] = None

    cost_price: Optional[float] = None
    price: Optional[float] = None
    has_sample: Optional[bool] = None

    in_stock: Optional[bool] = None
    popularity_score: Optional[int] = None
    is_featured: Optional[bool] = None

    @model_validator(mode="after")
    def _validate_breeder_rules(self):
        sex = (self.sex or "").lower() if self.sex is not None else None
        if self.offspring_unit_price is not None and sex is not None and sex != "female":
            raise ValueError("offspring_unit_price is only allowed for female breeders")
        if self.price is not None and self.price < 0:
            raise ValueError("price must be >= 0")
        return self

class ProductResponse(ProductBase):
    id: str
    images: List[ProductImageResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProductFilters(BaseModel):
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
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: bool = True


class SeriesUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
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
