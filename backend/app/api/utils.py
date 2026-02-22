from app.models.models import Product
import os
import uuid
from pathlib import Path
from urllib.parse import quote, urlparse

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

def normalize_local_image_url(image_url: str) -> str:
    """将 DB 存储的图片路径规范化为对外可访问的静态 URL（严格模式）。

    规范：只允许产品图片使用 `images/<product_id>/<filename>` 的结构，并输出为：
    - `/static/images/<product_id>/<filename>`

    例外：
    - 外链（http/https）原样返回
    - `/api/images/...`（若部分部署使用 API 提供原图）原样返回

    不再兼容旧的 `images/<code>/...`（迁移后应不存在）。
    """

    if not image_url:
        return ""

    # Keep external URLs as-is
    if image_url.startswith("http://") or image_url.startswith("https://"):
        return image_url

    # Keep explicit API route (if present in some deployments)
    if image_url.startswith("/api/images/"):
        return image_url

    parsed = urlparse(image_url)
    path = parsed.path or image_url

    # Extract `<folder>/<filename>` after known prefixes.
    prefix = None
    for candidate in ("/static/images/", "static/images/", "/images/", "images/"):
        if path.startswith(candidate):
            prefix = candidate
            break

    if prefix is None:
        return ""

    rest = path[len(prefix) :].lstrip("/")
    if not rest or "/" not in rest:
        return ""

    folder, filename = rest.split("/", 1)
    if not folder or not filename or "/" in filename:
        return ""

    # Enforce `<uuid>` folder to fully drop code-based storage.
    try:
        folder = str(uuid.UUID(folder))
    except Exception:
        return ""

    return quote(f"/static/images/{folder}/{filename}", safe="/%")


# Backward compatible name used by older code/tests.
# NOTE: strict mode (no code-based compatibility).
def _normalize_image_url(image_url: str) -> str:
    return normalize_local_image_url(image_url)

def convert_product_to_response(product: Product) -> dict:
    """Convert Product model to response format matching frontend expectations."""
    # Convert images

    images = []
    for img in sorted(product.images, key=lambda x: x.sort_order):
        url = getattr(img, "url", None)
        if not url:
            continue

        url = normalize_local_image_url(url)
        if not url:
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
        "code": product.code,
        "description": product.description,


        # Turtle-album extensions
        "seriesId": product.series_id,
        "sex": product.sex,
        "offspringUnitPrice": product.offspring_unit_price,
        "sireCode": product.sire_code,
        "damCode": product.dam_code,
        "mateCode": getattr(product, "mate_code", None),
        "sireImageUrl": normalize_local_image_url(product.sire_image_url) if product.sire_image_url else None,
        "damImageUrl": normalize_local_image_url(product.dam_image_url) if product.dam_image_url else None,

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
