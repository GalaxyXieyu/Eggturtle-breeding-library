#!/usr/bin/env python3
"""Test image loading."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, joinedload
from app.models.models import Product

engine = create_engine("sqlite:///./data/app.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    # Get CBF-002 with images
    breeder = (
        db.query(Product)
        .options(joinedload(Product.images))
        .filter(Product.code == "CBF-002")
        .first()
    )

    if breeder:
        print(f"Breeder: {breeder.code}")
        print(f"Images count: {len(breeder.images) if breeder.images else 0}")
        if breeder.images:
            for img in breeder.images:
                print(f"  - {img.type}: {img.url}")
        else:
            print("  No images found")
    else:
        print("Breeder not found")
finally:
    db.close()
