from app.models.models import Product
import os
from pathlib import Path
from urllib.parse import urlparse

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
    local_path = _to_local_static_path(image_url)
    if not local_path:
        return False

    p = Path(local_path)
    stem = p.stem
    if not stem:
        return False

    parts = p.parts
    try:
        idx = parts.index("images")
        code_in_path = parts[idx + 1] if len(parts) > idx + 1 else ""
        size_in_path = parts[idx + 2] if len(parts) > idx + 2 else ""
        if code_in_path and size_in_path in {"thumbnail", "small", "medium", "large"}:
            return _file_exists(local_path)
    except ValueError:
        pass

    base_dir = os.path.join("static", "images", product_code, "small")
    return _file_exists(os.path.join(base_dir, f"{stem}.webp")) or _file_exists(os.path.join(base_dir, f"{stem}.jpg"))

def convert_product_to_response(product: Product) -> dict:
    """Convert Product model to response format matching frontend expectations."""
    # Convert functional_designs from string to list
    functional_designs = []
    if product.functional_designs:
        functional_designs = [design.strip() for design in product.functional_designs.split(',') if design.strip()]

    images = []
    for img in sorted(product.images, key=lambda x: x.sort_order):
        url = getattr(img, "url", None)
        if not url or not _image_has_small_variant(product.code, url):
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
        "productType": product.product_type,
        "tubeType": product.tube_type,
        "boxType": product.box_type,
        "processType": product.process_type,
        "functionalDesigns": functional_designs,
        "shape": product.shape,
        "material": product.material,
        "dimensions": product.dimensions or {},
        "images": images,
        "pricing": {
            "costPrice": product.cost_price,
            "factoryPrice": product.factory_price,
            "hasSample": product.has_sample,
            "boxDimensions": product.box_dimensions,
            "boxQuantity": product.box_quantity
        },
        "inStock": product.in_stock,
        "popularityScore": product.popularity_score,
        "isFeatured": product.is_featured,
        "createdAt": product.created_at.isoformat(),
        "updatedAt": product.updated_at.isoformat()
    }
