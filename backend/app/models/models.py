from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

def utc_now():
    """Return current UTC datetime with microsecond precision."""
    return datetime.utcnow()


class Series(Base):
    __tablename__ = "series"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Stable series code (e.g. SER-TURTLES-001). Name is editable and not unique.
    code = Column(String, unique=True, index=True)
    name = Column(String, nullable=False, index=True)

    sort_order = Column(Integer, default=0)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    breeders = relationship("Product", back_populates="series")
    product_relations = relationship(
        "SeriesProductRelation",
        back_populates="series",
        cascade="all, delete-orphan",
    )


class Product(Base):
    __tablename__ = "products"

    __table_args__ = (
        Index(
            "ix_products_series_id_code_sort",
            "series_id",
            "code_prefix",
            "code_parent_number",
            "code_child_number",
            "code_child_letter",
            "code",
        ),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    # Display identifier: code (编号). No separate name/stage/status fields.
    code = Column(String, nullable=False, unique=True, index=True)
    description = Column(Text)

    # Natural sort fields derived from code.
    code_prefix = Column(String)
    code_parent_number = Column(Integer)
    code_child_number = Column(Integer)
    code_child_letter = Column(String(1))

    # Turtle-album extensions (kept optional for backward compatibility; enforced at API-level)
    series_id = Column(String, ForeignKey("series.id"), index=True)
    sex = Column(String, index=True)  # 'male' | 'female'
    offspring_unit_price = Column(Float)  # female-only concept

    # Optional lineage (shown only when provided)
    sire_code = Column(String)
    dam_code = Column(String)
    # Optional spouse/mate code (female-only concept; enforced at API-level)
    mate_code = Column(String)
    sire_image_url = Column(String)
    dam_image_url = Column(String)

    # Pricing information
    cost_price = Column(Float, default=0.0)
    # Canonical selling price
    price = Column(Float, nullable=False)
    has_sample = Column(Boolean, default=False)

    # Status and metadata
    in_stock = Column(Boolean, default=True)
    popularity_score = Column(Integer, default=0)
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    series = relationship("Series", back_populates="breeders")
    series_relations = relationship(
        "SeriesProductRelation",
        back_populates="product",
        cascade="all, delete-orphan",
    )
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    mating_records_as_female = relationship(
        "MatingRecord",
        foreign_keys="MatingRecord.female_id",
        back_populates="female",
        cascade="all, delete-orphan",
    )
    mating_records_as_male = relationship(
        "MatingRecord",
        foreign_keys="MatingRecord.male_id",
        back_populates="male",
        cascade="all, delete-orphan",
    )
    egg_records = relationship(
        "EggRecord",
        back_populates="female",
        cascade="all, delete-orphan",
    )

class SeriesProductRelation(Base):
    __tablename__ = "series_product_rel"

    series_id = Column(String, ForeignKey("series.id"), primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"), primary_key=True, index=True)
    created_at = Column(DateTime, default=utc_now)

    series = relationship("Series", back_populates="product_relations")
    product = relationship("Product", back_populates="series_relations")


class MatingRecord(Base):
    __tablename__ = "mating_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    female_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    male_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    mated_at = Column(DateTime, nullable=False, index=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=utc_now)

    female = relationship("Product", foreign_keys=[female_id], back_populates="mating_records_as_female")
    male = relationship("Product", foreign_keys=[male_id], back_populates="mating_records_as_male")


class EggRecord(Base):
    __tablename__ = "egg_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    female_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    laid_at = Column(DateTime, nullable=False, index=True)
    count = Column(Integer)
    notes = Column(Text)
    created_at = Column(DateTime, default=utc_now)

    female = relationship("Product", back_populates="egg_records")


class BreederEvent(Base):
    __tablename__ = "breeder_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    # The female breeder/product id this event belongs to.
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)

    # 'mating' | 'egg' | 'change_mate'
    event_type = Column(String, nullable=False, index=True)
    event_date = Column(DateTime, nullable=False, index=True)

    # Event-specific payload
    male_code = Column(String)
    egg_count = Column(Integer)
    note = Column(Text)

    old_mate_code = Column(String)
    new_mate_code = Column(String)

    # Optional bookkeeping so we can keep derived events in sync with legacy tables.
    source_type = Column(String, index=True)
    source_id = Column(String, index=True)

    created_at = Column(DateTime, default=utc_now, index=True, nullable=False)

    product = relationship("Product", backref="breeder_events")


class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    url = Column(String, nullable=False)  # Relative path to image
    alt = Column(String, nullable=False)
    type = Column(String, nullable=False)  # 'main', 'gallery', 'dimensions', 'detail'
    sort_order = Column(Integer, default=0)  # For ordering images
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    product = relationship("Product", back_populates="images")

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="admin")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

class Carousel(Base):
    __tablename__ = "carousels"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    description = Column(Text)
    image_url = Column(String, nullable=False)
    link_url = Column(String)  # Optional link when clicked
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)  # For ordering slides
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

class FeaturedProduct(Base):
    __tablename__ = "featured_products"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)  # For ordering featured products
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    product = relationship("Product", backref="featured_entries")

class Settings(Base):
    __tablename__ = "settings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_name = Column(String, default="汕头博捷科技有限公司")
    company_logo = Column(String, default="博捷科技")
    company_description = Column(Text, default="专业提供化妆品定制、批量生产、样品申请和设计咨询服务")
    contact_phone = Column(String, default="+86 123 4567 8910")
    contact_email = Column(String, default="contact@bojietech.com")
    contact_address = Column(String, default="广东省汕头市某某区某某路88号")
    customer_service_qr_code = Column(String)  # 客服二维码图片路径
    wechat_number = Column(String, default="bojie_tech")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

# Keep original enums for reference, but models are no longer restricted to these
IMAGE_TYPES = ['main', 'gallery', 'dimensions', 'detail']
