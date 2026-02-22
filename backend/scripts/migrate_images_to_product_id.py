#!/usr/bin/env python3
"""TurtleAlbum 图片存储迁移：从 code 目录迁移到 product_id 目录（不保留兼容）。

目标：
- 落盘目录：<UPLOAD_DIR>/<product_id>/...
- DB product_images.url：images/<product_id>/<filename>

兼容性策略：
- 外链（http/https）与 /api/images/... 不参与迁移
- 其余本地图片路径只支持 images/<folder>/<filename> 与 /static/images/<folder>/<filename> 等常见形式
- 迁移后不再兼容 images/<code>/...

用法：
- Dry-run:  python scripts/migrate_images_to_product_id.py --dry-run
- Apply:    python scripts/migrate_images_to_product_id.py --apply

注意：该脚本会移动/合并目录并更新 DB，请务必在停机窗口执行。
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple
from urllib.parse import urlparse


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app.db.session import DATABASE_URL, SessionLocal
from app.models.models import ProductImage


@dataclass(frozen=True)
class ImageRow:
    image_id: str
    product_id: str
    old_url: str
    src_folder: str
    filename: str
    new_url: str
    skip_fs: bool
    skip_db: bool


def _resolve_images_root() -> Path:
    upload_dir = os.getenv("UPLOAD_DIR", "static/images")
    images_root = Path(upload_dir)
    if not images_root.is_absolute():
        images_root = (BACKEND_DIR / images_root).resolve()
    return images_root


def _parse_local_folder_and_filename(raw_url: str) -> Tuple[str, str]:
    """Parse `images/<folder>/<filename>` from common local URL forms.

    支持：
    - images/<folder>/<filename>
    - /images/<folder>/<filename>
    - static/images/<folder>/<filename>
    - /static/images/<folder>/<filename>

    为了避免误操作，严格要求最后只剩 2 段：<folder>/<filename>。
    """

    parsed = urlparse(raw_url)
    path = parsed.path or raw_url

    prefix: Optional[str] = None
    for candidate in ("/static/images/", "static/images/", "/images/", "images/"):
        if path.startswith(candidate):
            prefix = candidate
            break

    if prefix is None:
        raise ValueError(f"unsupported local url format: {raw_url}")

    rest = path[len(prefix) :].lstrip("/")
    parts = [p for p in rest.split("/") if p]

    if len(parts) != 2:
        raise ValueError(
            f"unsupported local url depth (expected 2 segments): url={raw_url} parsed={parts}"
        )

    return parts[0], parts[1]


def _iter_files(root: Path) -> Iterable[Path]:
    for p in root.rglob("*"):
        if p.is_file():
            yield p


def _ensure_no_file_conflicts(src_dir: Path, dst_dir: Path) -> None:
    """确保合并目录时不会覆盖任何已有文件。"""
    for src_file in _iter_files(src_dir):
        rel = src_file.relative_to(src_dir)
        dst_file = dst_dir / rel
        if dst_file.exists():
            raise RuntimeError(f"file conflict: {dst_file} already exists")


def _merge_move_dir(src_dir: Path, dst_dir: Path) -> None:
    """合并移动目录（不覆盖，最后删除源目录）。

    前置条件：已调用 `_ensure_no_file_conflicts` 做过全量冲突检查。
    """

    dst_dir.mkdir(parents=True, exist_ok=True)

    for entry in list(src_dir.iterdir()):
        target = dst_dir / entry.name

        if not target.exists():
            shutil.move(str(entry), str(target))
            continue

        # Both exist.
        if entry.is_dir() and target.is_dir():
            _merge_move_dir(entry, target)
            continue

        # Should not happen due to preflight conflict check.
        raise RuntimeError(f"conflict while merging: {target} already exists")

    # Delete now-empty source directory.
    shutil.rmtree(src_dir)


def _load_images() -> List[ProductImage]:
    db = SessionLocal()
    try:
        return db.query(ProductImage).all()
    finally:
        db.close()


def _plan(images: List[ProductImage]) -> Tuple[List[ImageRow], Dict[str, str]]:
    """Return planned row updates and planned folder moves (src_folder -> product_id)."""

    planned_rows: List[ImageRow] = []
    folder_to_product: Dict[str, str] = {}
    folder_to_products: Dict[str, Set[str]] = {}
    product_to_filenames: Dict[str, Set[str]] = {}

    for img in images:
        image_id = str(getattr(img, "id"))
        product_id = str(getattr(img, "product_id"))
        old_url = str(getattr(img, "url"))

        if not old_url:
            continue

        # 外链与 API 原图不参与迁移。
        if old_url.startswith("http://") or old_url.startswith("https://") or old_url.startswith("/api/images/"):
            planned_rows.append(
                ImageRow(
                    image_id=image_id,
                    product_id=product_id,
                    old_url=old_url,
                    src_folder="",
                    filename="",
                    new_url=old_url,
                    skip_fs=True,
                    skip_db=True,
                )
            )
            continue

        src_folder, filename = _parse_local_folder_and_filename(old_url)
        new_url = f"images/{product_id}/{filename}"

        skip_fs = src_folder == product_id
        skip_db = old_url == new_url

        planned_rows.append(
            ImageRow(
                image_id=image_id,
                product_id=product_id,
                old_url=old_url,
                src_folder=src_folder,
                filename=filename,
                new_url=new_url,
                skip_fs=skip_fs,
                skip_db=skip_db,
            )
        )

        # filename 冲突（同一 product_id 下不能出现重复 filename）
        seen = product_to_filenames.setdefault(product_id, set())
        if filename in seen:
            raise RuntimeError(f"filename conflict for product_id={product_id}: {filename}")
        seen.add(filename)

        # 源目录 -> product_id 的唯一性约束
        if not skip_fs:
            folder_to_products.setdefault(src_folder, set()).add(product_id)
            folder_to_product[src_folder] = product_id

    # 源目录被多个 product_id 使用则直接停止（避免误删/误并）。
    for folder, products in folder_to_products.items():
        if len(products) > 1:
            raise RuntimeError(f"source folder used by multiple products: folder={folder} product_ids={sorted(products)}")

    return planned_rows, folder_to_product


def _apply(planned_rows: List[ImageRow], folder_moves: Dict[str, str], images_root: Path) -> Tuple[int, int]:
    """Execute filesystem moves then update DB. Returns (moved_dirs, updated_rows)."""

    # Preflight filesystem safety checks.
    for src_folder, product_id in folder_moves.items():
        src_dir = images_root / src_folder
        dst_dir = images_root / product_id

        if not src_dir.exists():
            raise RuntimeError(f"source dir missing: {src_dir}")
        if not src_dir.is_dir():
            raise RuntimeError(f"source path is not a dir: {src_dir}")

        if dst_dir.exists():
            if not dst_dir.is_dir():
                raise RuntimeError(f"dest path exists but is not a dir: {dst_dir}")
            _ensure_no_file_conflicts(src_dir, dst_dir)

    moved_dirs = 0

    # Filesystem moves.
    for src_folder, product_id in folder_moves.items():
        src_dir = images_root / src_folder
        dst_dir = images_root / product_id

        if not dst_dir.exists():
            # Prefer rename for speed/atomicity when possible.
            try:
                src_dir.rename(dst_dir)
            except OSError:
                shutil.move(str(src_dir), str(dst_dir))
            moved_dirs += 1
            continue

        _merge_move_dir(src_dir, dst_dir)
        moved_dirs += 1

    # DB updates.
    db = SessionLocal()
    try:
        img_by_id: Dict[str, ProductImage] = {str(img.id): img for img in db.query(ProductImage).all()}

        updated_rows = 0
        for row in planned_rows:
            if row.skip_db:
                continue
            if row.skip_fs and row.skip_db:
                continue

            img = img_by_id.get(row.image_id)
            if img is None:
                raise RuntimeError(f"image row missing during apply: id={row.image_id}")
            if img.url != row.old_url:
                raise RuntimeError(
                    f"image url changed during run, refusing to continue: id={row.image_id} expected={row.old_url} got={img.url}"
                )

            img.url = row.new_url
            updated_rows += 1

        db.commit()
    finally:
        db.close()

    return moved_dirs, updated_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate product images from code folder to product_id folder")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Only print planned changes")
    mode.add_argument("--apply", action="store_true", help="Apply filesystem + DB changes")

    args = parser.parse_args()

    images_root = _resolve_images_root()
    print(f"DATABASE_URL={DATABASE_URL}")
    print(f"UPLOAD_DIR={os.getenv('UPLOAD_DIR', 'static/images')} => images_root={images_root}")

    images = _load_images()
    planned_rows, folder_moves = _plan(images)

    # Summary.
    external_or_api = sum(
        1
        for r in planned_rows
        if r.old_url.startswith("http://")
        or r.old_url.startswith("https://")
        or r.old_url.startswith("/api/images/")
    )
    local_rows = sum(1 for r in planned_rows if r.src_folder)
    already_id_rows = sum(1 for r in planned_rows if r.src_folder and r.src_folder == r.product_id)
    to_update_db = sum(1 for r in planned_rows if not r.skip_db)
    to_move_dirs = len(folder_moves)

    print("---")
    print(f"product_images rows scanned: {len(images)}")
    print(f"local rows parsed: {local_rows}")
    print(f"skip external/api rows: {external_or_api}")
    print(f"planned folder moves: {to_move_dirs}")
    print(f"planned DB url updates: {to_update_db}")
    print(f"skipped rows (already id folder): {already_id_rows}")

    if args.dry_run:
        # Show a small sample to make operator confident.
        print("--- DRY RUN (sample up to 20 rows) ---")
        shown = 0
        for row in planned_rows:
            if row.skip_db and row.skip_fs:
                continue
            if shown >= 20:
                break
            print(
                f"image_id={row.image_id} product_id={row.product_id} old={row.old_url} -> new={row.new_url}"
            )
            shown += 1

        print("--- DRY RUN (folder moves) ---")
        for src_folder, product_id in list(folder_moves.items())[:50]:
            print(f"{src_folder} -> {product_id}")

        print("OK (dry-run).")
        return

    moved_dirs, updated_rows = _apply(planned_rows, folder_moves, images_root)
    print("--- APPLY RESULT ---")
    print(f"moved_dirs: {moved_dirs}")
    print(f"updated_db_rows: {updated_rows}")
    print(f"skipped rows (already id folder): {already_id_rows}")
    print("OK (apply).")


if __name__ == "__main__":
    main()
