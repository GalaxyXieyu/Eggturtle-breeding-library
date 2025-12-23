#!/usr/bin/env python3
"""
Product data import script
Imports product data from Excel file and associated images
"""

import pandas as pd
import os
import shutil
import json
from sqlalchemy.orm import sessionmaker
from database import engine, get_db
from models import Product, ProductImage, Base
import uuid
from datetime import datetime
from PIL import Image, ImageOps
from pathlib import Path
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except:
    pass

def clean_string(value):
    """Clean and normalize string values."""
    if pd.isna(value) or value is None:
        return None
    return str(value).strip()

def safe_float(value):
    """Safely convert to float."""
    if pd.isna(value) or value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None

def safe_int(value):
    """Safely convert to integer."""
    if pd.isna(value) or value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None

def optimize_image(input_path, output_path, size=None, quality=85, format='JPEG'):
    """Optimize single image."""
    try:
        with Image.open(input_path) as img:
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            
            img = ImageOps.exif_transpose(img)
            
            if size:
                img.thumbnail(size, Image.Resampling.LANCZOS)
                
                if img.size != size:
                    new_img = Image.new('RGB', size, (255, 255, 255))
                    paste_x = (size[0] - img.size[0]) // 2
                    paste_y = (size[1] - img.size[1]) // 2
                    new_img.paste(img, (paste_x, paste_y))
                    img = new_img
            
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            save_params = {'format': format}
            if format == 'JPEG':
                save_params.update({
                    'quality': quality,
                    'optimize': True,
                    'progressive': True
                })
            elif format == 'WebP':
                save_params.update({
                    'quality': quality,
                    'method': 6,
                    'lossless': False
                })
            
            img.save(output_path, **save_params)
            return True
            
    except Exception as e:
        print(f"  Error optimizing image {input_path}: {e}")
        return False

def copy_and_optimize_images(product_code, source_folder, dest_folder):
    """Copy and optimize product images with multiple sizes."""
    images = []
    
    # Define sizes for optimization
    sizes = {
        'thumbnail': (150, 150),
        'small': (300, 300),
        'medium': (500, 500), 
        'large': (800, 800)
    }
    
    # Create product destination directory
    product_dest = os.path.join(dest_folder, product_code)
    os.makedirs(product_dest, exist_ok=True)
    
    # Create size subdirectories
    for size_name in sizes.keys():
        size_dest = os.path.join(product_dest, size_name)
        os.makedirs(size_dest, exist_ok=True)
    
    # Find source folder (case insensitive)
    source_path = None
    if os.path.exists(source_folder):
        for folder_name in os.listdir(source_folder):
            if folder_name.lower() == product_code.lower():
                source_path = os.path.join(source_folder, folder_name)
                break
    
    if not source_path or not os.path.exists(source_path):
        print(f"  Warning: No image folder found for product {product_code}")
        return images
    
    # Process images
    image_files = [f for f in os.listdir(source_path) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.heic'))]
    
    for i, image_file in enumerate(image_files):
        source_file = os.path.join(source_path, image_file)
        file_stem = Path(image_file).stem
        
        # Copy original image to product root directory (both JPEG and WebP)
        original_jpg = os.path.join(product_dest, f"{file_stem}.jpg")
        original_webp = os.path.join(product_dest, f"{file_stem}.webp")
        optimize_image(source_file, original_jpg, None, quality=90, format='JPEG')
        optimize_image(source_file, original_webp, None, quality=80, format='WebP')
        
        # Create optimized versions for each size in subdirectories
        for size_name, size_dims in sizes.items():
            # JPEG version
            jpg_dest = os.path.join(product_dest, size_name, f"{file_stem}.jpg")
            optimize_image(source_file, jpg_dest, size_dims, quality=85, format='JPEG')
            
            # WebP version
            webp_dest = os.path.join(product_dest, size_name, f"{file_stem}.webp")
            optimize_image(source_file, webp_dest, size_dims, quality=80, format='WebP')
        
        # Add to database (using original image path)
        relative_path = f"images/{product_code}/{file_stem}.jpg"
        image_type = "main" if i == 0 else "gallery"
        
        images.append({
            "url": relative_path,
            "alt": f"{product_code} - Image {i+1}",
            "type": image_type
        })
    
    print(f"  Processed and optimized {len(images)} images for product {product_code}")
    return images

def import_products_from_excel(excel_file=None, images_source=None, images_dest=None):
    """Import products from Excel file."""

    # Default file paths (for B series)
    if not excel_file:
        excel_file = "/data/glam-cart/backend/B产品数据.xlsx"
    if not images_source:
        images_source = "/data/glam-cart/backend/B"
    if not images_dest:
        images_dest = "/data/glam-cart/backend/static/images"
    
    # Ensure destination directory exists
    os.makedirs(images_dest, exist_ok=True)
    
    # Read Excel file
    print("Reading Excel file...")
    df = pd.read_excel(excel_file)
    
    # Remove rows where product code is missing
    df = df.dropna(subset=['货号'])
    df = df[df['货号'].notna()]
    
    # Remove duplicate product codes, keep first occurrence
    df = df.drop_duplicates(subset=['货号'], keep='first')
    
    print(f"Found {len(df)} products to import")
    
    # Create database session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create tables if they don't exist (for incremental import)
        print("Creating database tables if not exist...")
        Base.metadata.create_all(bind=engine)
        
        imported_count = 0
        
        for idx, row in df.iterrows():
            try:
                # Extract data from Excel row
                product_code = clean_string(row['货号'])
                if not product_code:
                    continue
                    
                product_name = clean_string(row['产品名称']) or f"Product {product_code}"
                description = clean_string(row['产品描述']) or ""
                product_type = clean_string(row['产品类型']) or "tube"
                
                # Extract type information
                tube_type = clean_string(row['管型'])
                box_type = clean_string(row['盒型'])
                
                # Basic properties
                shape = clean_string(row['形状']) or "圆形"
                material = clean_string(row['材质']) or "AS"
                functional_designs = clean_string(row['功能设计']) or ""
                
                # Pricing
                factory_price = safe_float(row['出厂价格']) or 1.0
                has_sample = clean_string(row['是否有样品']) == '是'
                
                # Dimensions
                weight = safe_float(row['重量'])
                length = safe_float(row['长度'])
                width = safe_float(row['宽度'])
                height = safe_float(row['高度'])
                capacity_min = safe_float(row['容量最小值'])
                capacity_max = safe_float(row['容量最大值'])
                compartments = safe_int(row['分隔数量'])
                
                # Build dimensions JSON
                dimensions = {}
                if weight: dimensions['weight'] = weight
                if length: dimensions['length'] = length
                if width: dimensions['width'] = width
                if height: dimensions['height'] = height
                if capacity_min or capacity_max:
                    dimensions['capacity'] = {}
                    if capacity_min: dimensions['capacity']['min'] = capacity_min
                    if capacity_max: dimensions['capacity']['max'] = capacity_max
                if compartments: dimensions['compartments'] = compartments
                
                # Box info
                box_dimensions = clean_string(row['纸箱尺寸'])
                box_quantity = safe_int(row['装箱数量'])
                
                # Check if product already exists
                existing_product = db.query(Product).filter(Product.code == product_code).first()
                
                if existing_product:
                    print(f"  Product {product_code} already exists, skipping...")
                    continue
                
                print(f"Importing product: {product_code} - {product_name}")
                
                # Copy and optimize images
                images_data = copy_and_optimize_images(product_code, images_source, images_dest)
                
                # Create product
                product = Product(
                    id=str(uuid.uuid4()),
                    name=product_name,
                    code=product_code,
                    description=description,
                    product_type=product_type,
                    tube_type=tube_type,
                    box_type=box_type,
                    functional_designs=functional_designs,
                    shape=shape,
                    material=material,
                    dimensions=dimensions,
                    cost_price=0.0,
                    factory_price=factory_price,
                    has_sample=has_sample,
                    box_dimensions=box_dimensions,
                    box_quantity=box_quantity,
                    in_stock=True,
                    popularity_score=50  # Default popularity
                )
                
                db.add(product)
                db.flush()  # Get product ID
                
                # Add images
                for img_data in images_data:
                    image = ProductImage(
                        id=str(uuid.uuid4()),
                        product_id=product.id,
                        url=img_data['url'],
                        alt=img_data['alt'],
                        type=img_data['type']
                    )
                    db.add(image)
                
                imported_count += 1
                
            except Exception as e:
                print(f"Error importing product {product_code}: {e}")
                db.rollback()  # Rollback the failed transaction
                continue
        
        # Commit all changes
        db.commit()
        print(f"\nSuccessfully imported {imported_count} products!")
        
        # Print summary statistics
        print("\n=== Import Summary ===")
        total_products = db.query(Product).count()
        total_images = db.query(ProductImage).count()
        
        print(f"Total products in database: {total_products}")
        print(f"Total images in database: {total_images}")
        
        # Show unique values for key fields
        unique_tube_types = db.query(Product.tube_type).filter(Product.tube_type.isnot(None)).distinct().all()
        unique_box_types = db.query(Product.box_type).filter(Product.box_type.isnot(None)).distinct().all()
        unique_shapes = db.query(Product.shape).distinct().all()
        unique_materials = db.query(Product.material).distinct().all()
        
        print(f"\nUnique tube types: {[t[0] for t in unique_tube_types if t[0]]}")
        print(f"Unique box types: {[b[0] for b in unique_box_types if b[0]]}")
        print(f"Unique shapes: {[s[0] for s in unique_shapes if s[0]]}")
        print(f"Unique materials: {[m[0] for m in unique_materials if m[0]]}")
        
    except Exception as e:
        print(f"Critical error during import: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    import_products_from_excel() 