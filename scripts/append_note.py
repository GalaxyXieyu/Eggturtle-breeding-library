#!/usr/bin/env python3
"""Append a note/event line to a product description.

Flow:
1) POST /api/auth/login -> token
2) GET  /api/products?search=<code>&page=1&limit=1000 -> exact code match
3) GET  /api/products/{id} -> current product (used to build safe PUT payload)
4) PUT  /api/products/{id} -> update description
5) GET  /api/products/{id} -> readback verification

Examples:
  TURTLEALBUM_ADMIN_PASSWORD=*** python3 scripts/append_note.py --env dev --code MG-001 --note "2026-02-23: laid eggs x4" --dry-run
  TURTLEALBUM_ADMIN_PASSWORD=*** python3 scripts/append_note.py --env staging --code MG-001 --note "2026-02-23: laid eggs x4"
  TURTLEALBUM_ADMIN_PASSWORD=*** python3 scripts/append_note.py --env prod --code MG-001 --note "2026-02-23: laid eggs x4" --confirm-prod
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests


ENV_URLS = {
    "dev": "http://localhost:8000",
    "staging": "https://staging.turtlealbum.com",
    "prod": "https://qmngzrlhklmt.sealoshzh.site",
}

DEFAULT_TIMEOUT = 20


class AppendNoteError(RuntimeError):
    pass


@dataclass
class TargetProduct:
    product_id: str
    code: str


class TurtleAlbumClient:
    def __init__(
        self,
        base_url: str,
        *,
        username: Optional[str] = None,
        password: Optional[str] = None,
        token: Optional[str] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.token: Optional[str] = token

        # For read-only operations we can skip login entirely; token is required only for PUT.
        if self.token is None and username and password:
            self.token = self._login(username=username, password=password)

    def _login(self, username: str, password: str) -> str:
        body = self._request(
            "POST",
            "/api/auth/login",
            json_body={"username": username, "password": password},
            auth=False,
        )
        token = ((body or {}).get("data") or {}).get("token")
        if not token:
            raise AppendNoteError("Login succeeded but token is missing in /api/auth/login response")
        return token

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
        auth: bool = True,
    ) -> Dict[str, Any]:
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if auth:
            if not self.token:
                raise AppendNoteError(
                    "Missing auth token. Provide --password / TURTLEALBUM_ADMIN_PASSWORD (or pass token explicitly)."
                )
            headers["Authorization"] = f"Bearer {self.token}"

        url = f"{self.base_url}{path}"
        try:
            resp = requests.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=json_body,
                timeout=DEFAULT_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise AppendNoteError(f"Request failed: {method} {url} -> {exc}") from exc

        try:
            body: Dict[str, Any] = resp.json()
        except ValueError:
            body = {"message": resp.text}

        if resp.status_code >= 400:
            detail = body.get("message") or body.get("detail") or resp.text
            raise AppendNoteError(f"HTTP {resp.status_code}: {detail}")

        if isinstance(body, dict) and body.get("success") is False:
            raise AppendNoteError(f"API reported failure: {body.get('message') or body}")

        return body

    def list_products_by_search(self, search: str) -> List[Dict[str, Any]]:
        body = self._request(
            "GET",
            "/api/products",
            params={"search": search, "page": 1, "limit": 1000},
            auth=False,
        )
        data = body.get("data") or {}
        return data.get("products") or []

    def get_product(self, product_id: str) -> Dict[str, Any]:
        body = self._request("GET", f"/api/products/{product_id}", auth=False)
        return body.get("data") or {}

    def update_product(self, product_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        body = self._request("PUT", f"/api/products/{product_id}", json_body=payload, auth=True)
        return body.get("data") or {}


def _normalize_code(value: str) -> str:
    return (value or "").strip().upper()


def _pick_target_product(
    products: List[Dict[str, Any]],
    *,
    code: str,
    product_id: Optional[str],
) -> TargetProduct:
    wanted = _normalize_code(code)
    exact = [p for p in products if _normalize_code(str(p.get("code") or "")) == wanted]

    if not exact:
        raise AppendNoteError(f"No product found with exact code match: {wanted}")

    if len(exact) == 1:
        pid = str(exact[0].get("id") or "").strip()
        if not pid:
            raise AppendNoteError("Matched product has no id in list response")
        return TargetProduct(product_id=pid, code=str(exact[0].get("code") or wanted))

    if not product_id:
        ids = [str(p.get("id") or "").strip() for p in exact]
        raise AppendNoteError(
            "Multiple products matched the same code. Please specify --product-id. "
            f"Candidates: {', '.join([i for i in ids if i])}"
        )

    for p in exact:
        if str(p.get("id") or "").strip() == product_id:
            return TargetProduct(product_id=product_id, code=str(p.get("code") or wanted))

    raise AppendNoteError("--product-id did not match any exact code candidates")


def _compute_new_description(
    old_description: Optional[str],
    note: str,
    *,
    newline_enabled: bool,
) -> str:
    old = old_description or ""
    note = note or ""

    if not old:
        return note

    if not newline_enabled:
        return old + note

    if old.endswith("\n"):
        return old + note

    return old + "\n" + note


def _build_put_payload_from_get(product: Dict[str, Any], *, description: str) -> Dict[str, Any]:
    # The GET /api/products/{id} response is frontend-oriented (camelCase + nested pricing).
    # For PUT /api/products/{id}, the backend expects snake_case keys.
    pricing = product.get("pricing") or {}

    mapped = [
        ("code", product.get("code")),
        ("description", description),
        ("series_id", product.get("seriesId")),
        ("sex", product.get("sex")),
        ("offspring_unit_price", product.get("offspringUnitPrice")),
        ("sire_code", product.get("sireCode")),
        ("dam_code", product.get("damCode")),
        ("mate_code", product.get("mateCode")),
        ("sire_image_url", product.get("sireImageUrl")),
        ("dam_image_url", product.get("damImageUrl")),
        ("cost_price", pricing.get("costPrice")),
        ("price", pricing.get("price")),
        ("has_sample", pricing.get("hasSample")),
        ("in_stock", product.get("inStock")),
        ("popularity_score", product.get("popularityScore")),
        ("is_featured", product.get("isFeatured")),
    ]

    payload: Dict[str, Any] = {}
    for key, value in mapped:
        if value is None:
            continue
        if isinstance(value, str) and value == "":
            continue
        payload[key] = value

    # Always include description even if empty string.
    payload["description"] = description
    return payload


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Append a note to a product description")
    parser.add_argument("--env", choices=["dev", "staging", "prod"], default="dev")
    parser.add_argument("--base-url", help="Custom base URL (overrides --env)")

    default_username = os.environ.get("TURTLEALBUM_ADMIN_USERNAME") or "admin"
    parser.add_argument("--username", default=default_username, help="Admin username")
    parser.add_argument(
        "--password",
        default=os.environ.get("TURTLEALBUM_ADMIN_PASSWORD"),
        help=(
            "Admin password (or set TURTLEALBUM_ADMIN_PASSWORD). "
            "Required for writes; optional for --dry-run."
        ),
    )

    parser.add_argument("--code", required=True, help="Product code (exact match)")
    parser.add_argument("--note", required=True, help="Note/event to append")
    parser.add_argument("--product-id", help="Required when code is duplicated")
    parser.add_argument("--series-id", help="Override series_id (optional)")

    parser.add_argument("--dry-run", action="store_true", help="Plan only; do not write")
    parser.add_argument("--confirm-prod", action="store_true", help="Confirm production write")
    parser.add_argument(
        "--no-newline",
        action="store_true",
        help="Do not insert a newline before the note (default: newline enabled)",
    )
    parser.add_argument("--dedupe", action="store_true", help="Skip if description already contains the note")

    return parser


def run(args: argparse.Namespace) -> int:
    base_url = (args.base_url or ENV_URLS.get(args.env) or "").rstrip("/")
    if not base_url:
        raise AppendNoteError("Missing base URL (use --base-url or a valid --env)")

    password = (args.password or "").strip() or None
    if (not args.dry_run) and (not password):
        raise AppendNoteError("Missing password. Provide --password or set TURTLEALBUM_ADMIN_PASSWORD")

    if args.env == "prod" and (not args.dry_run) and (not args.confirm_prod):
        raise AppendNoteError("Refusing to write to prod without --confirm-prod")

    newline_enabled = not bool(args.no_newline)

    client = TurtleAlbumClient(base_url, username=args.username, password=password)

    code = _normalize_code(args.code)
    if not code:
        raise AppendNoteError("--code must be non-empty")

    note = str(args.note)
    if not note.strip():
        raise AppendNoteError("--note must be non-empty")

    products = client.list_products_by_search(code)
    target = _pick_target_product(products, code=code, product_id=args.product_id)

    current = client.get_product(target.product_id)
    old_description = current.get("description")

    note_already_present = isinstance(old_description, str) and note in old_description
    if args.dedupe and note_already_present:
        # Keep description unchanged, but still allow other field overrides (e.g. series_id).
        new_description = old_description
    else:
        new_description = _compute_new_description(old_description, note, newline_enabled=newline_enabled)

    put_payload = _build_put_payload_from_get(current, description=new_description)

    series_id_override = (str(args.series_id).strip() if args.series_id else "")
    if series_id_override:
        put_payload["series_id"] = series_id_override

    if args.dry_run:
        print("Dry-run: planned update payload (no PUT will be sent).")
        print(json.dumps({"product_id": target.product_id, "code": target.code, "payload": put_payload}, indent=2))
        return 0

    client.update_product(target.product_id, put_payload)

    readback = client.get_product(target.product_id)
    final_desc = str(readback.get("description") or "")
    if note.strip() and note.strip() not in final_desc:
        raise AppendNoteError("Readback verification failed: appended note not found in description")

    print("Update succeeded.")
    print(f"- product_id: {target.product_id}")
    print(f"- code: {target.code}")
    return 0


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return run(args)
    except AppendNoteError as exc:
        print(f"Append failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
