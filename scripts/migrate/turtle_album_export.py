#!/usr/bin/env python3
"""Export TurtleAlbum sqlite data for Eggturtle migration.

This script exports only non-secret fields from TurtleAlbum sqlite.
It never exports user password hashes.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_SQLITE_PATH = "/Volumes/DATABASE/code/turtle_album/backend/data/app.db"
DEFAULT_OUTPUT_PATH = "./out/turtle_album_export.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export TurtleAlbum products/product_images/users into JSON for migration."
    )
    parser.add_argument(
        "--sqlite-path",
        default=DEFAULT_SQLITE_PATH,
        help=f"Path to TurtleAlbum sqlite database (default: {DEFAULT_SQLITE_PATH})",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT_PATH,
        help=f"Output JSON path (default: {DEFAULT_OUTPUT_PATH})",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Write compact JSON instead of pretty JSON.",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Write export JSON file (default is dry-run).",
    )
    parser.add_argument(
        "--i-know-what-im-doing",
        action="store_true",
        help="Override production-path safety check.",
    )
    return parser.parse_args()


def fetch_all(conn: sqlite3.Connection, query: str) -> list[dict[str, Any]]:
    cursor = conn.execute(query)
    rows = cursor.fetchall()
    return [dict(row) for row in rows]


def validate_products(products: list[dict[str, Any]]) -> list[str]:
    issues: list[str] = []
    seen_codes: set[str] = set()

    for product in products:
        code = (product.get("code") or "").strip()
        if not code:
            issues.append(f"product {product.get('id')} has empty code")
            continue
        if code in seen_codes:
            issues.append(f"duplicate product code: {code}")
        seen_codes.add(code)

    return issues


def validate_images(
    product_images: list[dict[str, Any]],
    product_ids: set[str],
) -> list[str]:
    issues: list[str] = []

    for image in product_images:
        image_id = image.get("id")
        product_id = image.get("product_id")
        url = (image.get("url") or "").strip()
        image_type = (image.get("type") or "").strip()

        if not product_id:
            issues.append(f"image {image_id} has empty product_id")
        elif product_id not in product_ids:
            issues.append(f"image {image_id} points to missing product {product_id}")

        if not url:
            issues.append(f"image {image_id} has empty url")

        if not image_type:
            issues.append(f"image {image_id} has empty type")

    return issues


def looks_like_production_path(path_value: Path) -> bool:
    lowered = str(path_value).lower()
    return any(keyword in lowered for keyword in ["prod", "production", "primary", "master"])


def main() -> int:
    args = parse_args()
    sqlite_path = Path(args.sqlite_path).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()

    if not sqlite_path.exists():
        raise FileNotFoundError(f"sqlite db not found: {sqlite_path}")

    if looks_like_production_path(sqlite_path) and not args.i_know_what_im_doing:
        raise RuntimeError(
            "Refusing to run because sqlite path looks like production. "
            "Use --i-know-what-im-doing to override."
        )

    conn = sqlite3.connect(str(sqlite_path))
    conn.row_factory = sqlite3.Row

    try:
        users = fetch_all(
            conn,
            """
            SELECT
              id,
              username,
              role,
              is_active,
              created_at,
              updated_at
            FROM users
            ORDER BY created_at ASC, id ASC
            """,
        )
        products = fetch_all(
            conn,
            """
            SELECT
              id,
              code,
              description,
              created_at,
              updated_at
            FROM products
            ORDER BY created_at ASC, id ASC
            """,
        )
        product_images = fetch_all(
            conn,
            """
            SELECT
              id,
              product_id,
              url,
              type,
              sort_order,
              created_at
            FROM product_images
            ORDER BY product_id ASC, sort_order ASC, created_at ASC, id ASC
            """,
        )
    finally:
        conn.close()

    product_ids = {str(product["id"]) for product in products}
    validation_issues = [
        *validate_products(products),
        *validate_images(product_images, product_ids),
    ]

    payload = {
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "sqlite_path": str(sqlite_path),
            "tables": ["users", "products", "product_images"],
        },
        "counts": {
            "users": len(users),
            "products": len(products),
            "product_images": len(product_images),
            "validation_issues": len(validation_issues),
        },
        "validation_issues": validation_issues,
        "users": users,
        "products": products,
        "product_images": product_images,
    }

    print("Export plan:")
    print(f"- mode: {'WRITE' if args.confirm else 'DRY-RUN (default)'}")
    print(f"- sqlite: {sqlite_path}")
    print(f"- output: {output_path}")
    print(
        "- counts:",
        {
            "users": len(users),
            "products": len(products),
            "product_images": len(product_images),
            "validation_issues": len(validation_issues),
        },
    )

    if validation_issues:
        print("- validation issues found. review 'validation_issues' in output JSON")

    if not args.confirm:
        print("No file written. Re-run with --confirm to export JSON.")
        return 0

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        if args.compact:
            json.dump(payload, file, ensure_ascii=True, separators=(",", ":"))
        else:
            json.dump(payload, file, ensure_ascii=True, indent=2)
            file.write("\n")

    print("Export complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
