import pandas as pd
import os
import io
import zipfile
import shutil
import uuid
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from pathlib import Path

from app.models.models import Product, ProductImage
from app.core.file_utils import optimize_single_image, IMAGES_DIR

# Configure logging
logger = logging.getLogger(__name__)

class ImportResult:
    def __init__(self):
        self.total_processed = 0
        self.success_count = 0
        self.failed_count = 0
        self.errors: List[str] = []
        self.warnings: List[str] = []

class BatchImportService:
    # Standard columns expected in the Excel file
    REQUIRED_COLUMNS = ['货号']
    COLUMN_MAPPING = {
        '货号': 'code',
        '产品名称': 'name',
        '产品描述': 'description',
        '产品类型': 'product_type',
        '管型': 'tube_type',
        '盒型': 'box_type',
        '形状': 'shape',
        '材质': 'material',
        '功能设计': 'functional_designs',
        '出厂价格': 'factory_price',
        '是否有样品': 'has_sample',
        '重量': 'weight',
        '长度': 'length',
        '宽度': 'width',
        '高度': 'height',
        '容量最小值': 'capacity_min',
        '容量最大值': 'capacity_max',
        '分隔数量': 'compartments',
        '纸箱尺寸': 'box_dimensions',
        '装箱数量': 'box_quantity'
    }
    MAX_ZIP_FILES = 5000
    MAX_ZIP_UNCOMPRESSED_BYTES = 500 * 1024 * 1024

    @staticmethod
    def generate_template() -> bytes:
        """Generate a template Excel file with instructions."""
        # Create a DataFrame with empty columns
        columns = list(BatchImportService.COLUMN_MAPPING.keys())
        df = pd.DataFrame(columns=columns)
        
        # Add a sample row
        sample_data = {
            '货号': 'P001',
            '产品名称': 'Sample Product',
            '产品描述': 'This is a sample product',
            '产品类型': 'tube',
            '管型': 'Round Tube',
            '盒型': '',
            '形状': 'Circular',
            '材质': 'ABS',
            '功能设计': 'Magnetic',
            '出厂价格': 1.5,
            '是否有样品': '是',
            '重量': 10.5,
            '长度': 100,
            '宽度': 20,
            '高度': 20,
            '容量最小值': 5,
            '容量最大值': 10,
            '分隔数量': 0,
            '纸箱尺寸': '50x50x50',
            '装箱数量': 100
        }
        df.loc[0] = sample_data

        # Write to bytes
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Products')
            
            # Add instructions sheet
            instructions = pd.DataFrame({
                'Field': columns,
                'Description': [
                    'Required. Unique identifier.',
                    'Product Name',
                    'Detailed description',
                    'tube, box, or other',
                    'Specific tube type',
                    'Specific box type',
                    'Product shape',
                    'Material composition',
                    'Comma separated features',
                    'Price (Number)',
                    '是 (Yes) or 否 (No)',
                    'Weight in grams',
                    'Length in mm',
                    'Width in mm',
                    'Height in mm',
                    'Min capacity',
                    'Max capacity',
                    'Number of compartments',
                    'Carton dimensions',
                    'Units per carton'
                ]
            })
            instructions.to_excel(writer, index=False, sheet_name='Instructions')
            
        return output.getvalue()

    @staticmethod
    def _safe_extract_zip(zip_bytes: bytes, dest_dir: str) -> None:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            infos = zf.infolist()
            if len(infos) > BatchImportService.MAX_ZIP_FILES:
                raise ValueError(f"ZIP contains too many files ({len(infos)}).")

            total_size = sum(i.file_size for i in infos)
            if total_size > BatchImportService.MAX_ZIP_UNCOMPRESSED_BYTES:
                raise ValueError("ZIP is too large after decompression.")

            dest_real = os.path.realpath(dest_dir)
            prefix = dest_real + os.sep
            for info in infos:
                name = info.filename
                if not name or name.endswith("/"):
                    continue
                target = os.path.realpath(os.path.join(dest_dir, name))
                if not target.startswith(prefix):
                    raise ValueError("ZIP contains invalid paths.")

            zf.extractall(dest_dir)

    @staticmethod
    def _clean_string(value: Any) -> Optional[str]:
        if pd.isna(value) or value is None:
            return None
        return str(value).strip()

    @staticmethod
    def _safe_float(value: Any) -> Optional[float]:
        if pd.isna(value) or value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _safe_int(value: Any) -> Optional[int]:
        if pd.isna(value) or value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None

    @staticmethod
    async def process_import(
        db: Session,
        excel_file: bytes,
        zip_file: Optional[bytes] = None
    ) -> Dict[str, Any]:
        result = ImportResult()
        
        # 1. Parse Excel
        try:
            df = pd.read_excel(io.BytesIO(excel_file))
        except Exception as e:
            return {"success": False, "message": f"Failed to read Excel file: {str(e)}"}

        # Validate columns
        missing_columns = [col for col in BatchImportService.REQUIRED_COLUMNS if col not in df.columns]
        if missing_columns:
            return {
                "success": False, 
                "message": f"Missing required columns: {', '.join(missing_columns)}"
            }

        # 2. Handle Zip File (if provided)
        temp_dir = None
        if zip_file:
            try:
                temp_dir = f"/tmp/import_{uuid.uuid4()}"
                os.makedirs(temp_dir, exist_ok=True)
                BatchImportService._safe_extract_zip(zip_file, temp_dir)
            except Exception as e:
                if temp_dir and os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)
                return {"success": False, "message": f"Failed to process ZIP file: {str(e)}"}

        # 3. Process Rows
        try:
            for index, row in df.iterrows():
                result.total_processed += 1
                row_num = index + 2  # Excel row number (1-based, +header)

                product_code = None
                try:
                    product_code = BatchImportService._clean_string(row.get('货号'))
                    if not product_code:
                        result.warnings.append(f"Row {row_num}: Skipped due to missing product code")
                        result.failed_count += 1
                        continue

                    with db.begin_nested():
                        existing_product = db.query(Product).filter(Product.code == product_code).first()

                        product_data = {
                            'name': BatchImportService._clean_string(row.get('产品名称')) or f"Product {product_code}",
                            'description': BatchImportService._clean_string(row.get('产品描述')) or "",
                            'product_type': BatchImportService._clean_string(row.get('产品类型')) or "tube",
                            'tube_type': BatchImportService._clean_string(row.get('管型')),
                            'box_type': BatchImportService._clean_string(row.get('盒型')),
                            'shape': BatchImportService._clean_string(row.get('形状')) or "圆形",
                            'material': BatchImportService._clean_string(row.get('材质')) or "AS",
                            'functional_designs': BatchImportService._clean_string(row.get('功能设计')) or "",
                            'factory_price': BatchImportService._safe_float(row.get('出厂价格')) or 0.0,
                            'has_sample': BatchImportService._clean_string(row.get('是否有样品')) == '是',
                            'box_dimensions': BatchImportService._clean_string(row.get('纸箱尺寸')),
                            'box_quantity': BatchImportService._safe_int(row.get('装箱数量')),
                            'cost_price': 0.0,
                            'in_stock': True,
                            'popularity_score': 50
                        }

                        dimensions = {}
                        w = BatchImportService._safe_float(row.get('重量'))
                        l = BatchImportService._safe_float(row.get('长度'))
                        wd = BatchImportService._safe_float(row.get('宽度'))
                        h = BatchImportService._safe_float(row.get('高度'))
                        c_min = BatchImportService._safe_float(row.get('容量最小值'))
                        c_max = BatchImportService._safe_float(row.get('容量最大值'))
                        comp = BatchImportService._safe_int(row.get('分隔数量'))

                        if w is not None: dimensions['weight'] = w
                        if l is not None: dimensions['length'] = l
                        if wd is not None: dimensions['width'] = wd
                        if h is not None: dimensions['height'] = h
                        if c_min is not None or c_max is not None:
                            dimensions['capacity'] = {}
                            if c_min is not None: dimensions['capacity']['min'] = c_min
                            if c_max is not None: dimensions['capacity']['max'] = c_max
                        if comp is not None: dimensions['compartments'] = comp

                        product_data['dimensions'] = dimensions

                        if existing_product:
                            for key, value in product_data.items():
                                setattr(existing_product, key, value)
                            product = existing_product
                        else:
                            product = Product(
                                id=str(uuid.uuid4()),
                                code=product_code,
                                **product_data
                            )
                            db.add(product)
                            db.flush()

                        if temp_dir:
                            images_found = BatchImportService._process_product_images(
                                product.code, temp_dir, product.id, db
                            )
                            if images_found > 0:
                                result.warnings.append(f"Row {row_num}: Added {images_found} images for {product_code}")

                    result.success_count += 1

                except Exception as e:
                    result.failed_count += 1
                    code = product_code or "unknown"
                    result.errors.append(f"Row {row_num}: Error importing {code}: {str(e)}")
                    continue
            
            db.commit()
            
        except Exception as e:
            return {"success": False, "message": f"Critical import error: {str(e)}"}
        finally:
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

        return {
            "success": True,
            "total": result.total_processed,
            "imported": result.success_count,
            "failed": result.failed_count,
            "errors": result.errors,
            "warnings": result.warnings
        }

    @staticmethod
    def _process_product_images(product_code: str, source_root: str, product_id: str, db: Session) -> int:
        """
        Find and process images for a product in the extracted ZIP directory.
        Looks for a folder named `product_code` (case-insensitive).
        """
        found_folder = None
        
        # 1. Search for folder match
        for root, dirs, files in os.walk(source_root):
            for dir_name in dirs:
                if dir_name.lower() == product_code.lower():
                    found_folder = os.path.join(root, dir_name)
                    break
            if found_folder:
                break
        
        # 2. If not found, try loose matching (e.g. F1 -> F01 or F01 -> F1)
        if not found_folder:
            # Simple logic: try adding/removing leading zeros for numeric parts
            # This is a simplified version of the logic in old scripts
            pass 

        if not found_folder:
            return 0

        # 3. Process images in folder
        count = 0
        image_files = [
            f for f in os.listdir(found_folder) 
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.heic'))
        ]
        image_files.sort() # Ensure consistent order

        # Get current max sort order
        from sqlalchemy import func
        max_sort = db.query(func.max(ProductImage.sort_order)).filter(
            ProductImage.product_id == product_id
        ).scalar() or -1

        for i, filename in enumerate(image_files):
            try:
                src_path = os.path.join(found_folder, filename)
                
                # Define destination
                # We reuse the structure: static/images/{code}/{size}/{name}.jpg
                # We need to generate unique names to avoid conflicts if re-importing
                file_stem = Path(filename).stem
                unique_stem = f"{file_stem}_{uuid.uuid4().hex[:6]}"
                
                # Define sizes
                sizes = {
                    'thumbnail': (150, 150),
                    'small': (300, 300),
                    'medium': (500, 500), 
                    'large': (800, 800)
                }

                product_dir = os.path.join(IMAGES_DIR, product_code)
                os.makedirs(product_dir, exist_ok=True)
                
                # Optimize Main Images
                original_jpg = os.path.join(product_dir, f"{unique_stem}.jpg")
                original_webp = os.path.join(product_dir, f"{unique_stem}.webp")
                
                optimize_single_image(src_path, original_jpg, None, quality=90, format='JPEG')
                optimize_single_image(src_path, original_webp, None, quality=80, format='WebP')

                # Optimize Sizes
                for size_name, size_dims in sizes.items():
                    size_dir = os.path.join(product_dir, size_name)
                    os.makedirs(size_dir, exist_ok=True)
                    
                    jpg_path = os.path.join(size_dir, f"{unique_stem}.jpg")
                    webp_path = os.path.join(size_dir, f"{unique_stem}.webp")
                    
                    optimize_single_image(src_path, jpg_path, size_dims, quality=85, format='JPEG')
                    optimize_single_image(src_path, webp_path, size_dims, quality=80, format='WebP')

                # Add to DB
                image = ProductImage(
                    id=str(uuid.uuid4()),
                    product_id=product_id,
                    url=f"images/{product_code}/{unique_stem}.jpg",
                    alt=f"{product_code} - {filename}",
                    type="main" if (max_sort == -1 and i == 0) else "gallery",
                    sort_order=max_sort + 1 + i
                )
                db.add(image)
                count += 1

            except Exception as e:
                logger.error(f"Error processing image {filename} for {product_code}: {e}")
                continue

        return count
