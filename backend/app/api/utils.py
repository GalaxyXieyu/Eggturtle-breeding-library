from app.models.models import Product
import os
from pathlib import Path
from urllib.parse import urlparse

# 获取实际的图片目录（支持 Docker 环境）
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "static/images")

def split_category_values(value_list):
    """展开分隔符分割的分类值"""
    expanded_set = set()
    for item in value_list:
        if item[0]:
            raw = str(item[0])
            for chunk in raw.split('/'):
                for value in chunk.split(','):
                    v = value.strip()
                    if v:
                        expanded_set.add(v)
    return sorted(list(expanded_set))

def group_categories(items, group_mapping):
    """将分类项按组织结构分组"""
    grouped = {}
    ungrouped = []

    for item in items:
        assigned = False
        for group_name, group_items in group_mapping.items():
            if item in group_items:
                if group_name not in grouped:
                    grouped[group_name] = []
                grouped[group_name].append(item)
                assigned = True
                break

        if not assigned:
            ungrouped.append(item)

    if ungrouped:
        grouped['其他'] = ungrouped

    return grouped

def _file_exists(path: str) -> bool:
    try:
        return bool(path) and os.path.exists(path)
    except Exception:
        return False

def _to_local_static_path(image_url: str) -> str:
    if not image_url:
        return ""

    parsed = urlparse(image_url)
    path = parsed.path or image_url

    if path.startswith("http://") or path.startswith("https://"):
        parsed = urlparse(path)
        path = parsed.path

    if path.startswith("/static/"):
        return path.lstrip("/")
    if path.startswith("/images/"):
        return os.path.join("static", "images", path[len("/images/"):].lstrip("/"))
    if path.startswith("static/"):
        return path
    if path.startswith("images/"):
        return os.path.join("static", path)
    if path.startswith("/"):
        return os.path.join("static", "images", path.lstrip("/"))
    return os.path.join("static", "images", path)

def _image_has_small_variant(product_code: str, image_url: str) -> bool:
    """检查图片是否有 small 变体，支持 Docker 环境"""
    if not image_url:
        return False
    
    # 从 URL 中提取文件名
    p = Path(image_url)
    stem = p.stem
    if not stem:
        return False
    
    # 检查 UPLOAD_DIR 下的 small 目录
    base_dir = os.path.join(UPLOAD_DIR, product_code, "small")
    return _file_exists(os.path.join(base_dir, f"{stem}.webp")) or _file_exists(os.path.join(base_dir, f"{stem}.jpg"))

def convert_product_to_response(product: Product) -> dict:
    """Convert Product model to response format matching frontend expectations."""
    # Convert images

    images = []
    for img in sorted(product.images, key=lambda x: x.sort_order):
        url = getattr(img, "url", None)
        if not url:
            continue

        # Turtle-album may use:
        # - external URLs
        # - API-served originals (e.g. /api/images/xxx.jpg)
        # - local optimized variants under /static/images/...
        # For local paths we should not drop images just because small variants don't exist.
        if not (url.startswith("http://") or url.startswith("https://")):
            if url.startswith("/api/images/") or url.startswith("/images/") or url.startswith("/static/"):
                pass
            elif not _image_has_small_variant(product.code, url):
                continue

        images.append(
            {
                "id": img.id,
                "url": url,
                "alt": img.alt,
                "type": img.type,
                "sort_order": img.sort_order,
            }
        )
    
    return {
        "id": product.id,
        "name": product.name,
        "code": product.code,
        "description": product.description,

        "stage": getattr(product, "stage", "unknown"),
        "status": getattr(product, "status", "draft"),

        # Turtle-album extensions
        "seriesId": product.series_id,
        "sex": product.sex,
        "offspringUnitPrice": product.offspring_unit_price,
        "sireCode": product.sire_code,
        "damCode": product.dam_code,
        "sireImageUrl": product.sire_image_url,
        "damImageUrl": product.dam_image_url,

        "images": images,
        "pricing": {
            "costPrice": product.cost_price,
            "price": product.price,
            "hasSample": product.has_sample,
        },
        "inStock": product.in_stock,
        "popularityScore": product.popularity_score,
        "isFeatured": product.is_featured,
        "createdAt": product.created_at.isoformat(),
        "updatedAt": product.updated_at.isoformat()
    }
