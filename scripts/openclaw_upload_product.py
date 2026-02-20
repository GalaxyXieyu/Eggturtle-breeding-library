#!/usr/bin/env python3
"""OpenClaw product uploader with lineage confirmation and readback verification.

Examples:
  python3 scripts/openclaw_upload_product.py --env dev --username admin --password admin123
  python3 scripts/openclaw_upload_product.py --env prod --username admin --password '***' --payload-file /tmp/product.json --confirm-prod

Key behaviors:
1) By default payload must explicitly contain sire_code and dam_code (values may be null).
2) Write payload only accepts snake_case keys.
3) Code matching policy:
   - 0 exact matches: create
   - 1 exact match: update
   - >1 exact matches: require --product-id
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests


ENV_URLS = {
    "dev": "http://localhost:8000",
    "staging": "https://staging.turtlealbum.com",
    "prod": "https://qmngzrlhklmt.sealoshzh.site",
}

ALLOWED_PRODUCT_KEYS = {
    "name",
    "code",
    "description",
    "stage",
    "status",
    "series_id",
    "sex",
    "offspring_unit_price",
    "sire_code",
    "dam_code",
    "sire_image_url",
    "dam_image_url",
    "cost_price",
    "price",
    "has_sample",
    "in_stock",
    "popularity_score",
    "is_featured",
    "images",
}

DEFAULT_TIMEOUT = 20


class UploadError(RuntimeError):
    """Domain error for uploader flow."""


@dataclass
class UploadResult:
    action: str
    product_id: str
    code: str
    sire_code: Optional[str]
    dam_code: Optional[str]


class TurtleAlbumClient:
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip("/")
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
            raise UploadError("Login succeeded but token is missing in /api/auth/login response")
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
            raise UploadError(f"Request failed: {method} {url} -> {exc}") from exc

        body: Dict[str, Any]
        try:
            body = resp.json()
        except ValueError:
            body = {"message": resp.text}

        if resp.status_code >= 400:
            detail = body.get("message") or body.get("detail") or resp.text
            raise UploadError(f"HTTP {resp.status_code}: {detail}")

        if isinstance(body, dict) and body.get("success") is False:
            raise UploadError(f"API reported failure: {body.get('message') or body}")

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

    def create_product(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        body = self._request("POST", "/api/products", json_body=payload, auth=True)
        return body.get("data") or {}

    def update_product(self, product_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        body = self._request("PUT", f"/api/products/{product_id}", json_body=payload, auth=True)
        return body.get("data") or {}


def _prompt_non_empty(label: str) -> str:
    while True:
        value = input(label).strip()
        if value:
            return value
        print("This field is required.")


def _prompt_with_default(label: str, default: str) -> str:
    raw = input(f"{label} [{default}]: ").strip()
    return raw or default


def _prompt_yes_no(label: str, default_yes: bool = False) -> bool:
    suffix = "Y/n" if default_yes else "y/N"
    raw = input(f"{label} ({suffix}): ").strip().lower()
    if not raw:
        return default_yes
    return raw in {"y", "yes", "1", "true"}


def _prompt_lineage(label: str) -> Optional[str]:
    while True:
        value = input(f"{label} code (blank = unknown): ").strip()
        if value:
            return value
        if _prompt_yes_no(f"Confirm {label} is unknown (null)", default_yes=False):
            return None
        print(f"Please provide {label} code or explicitly confirm unknown.")


def _interactive_payload() -> Dict[str, Any]:
    print("\n=== OpenClaw product upload (interactive) ===")
    print("Write fields use snake_case only.\n")

    code = _prompt_non_empty("code (required): ")
    name = _prompt_non_empty("name (required): ")
    description = input("description (optional): ").strip()

    stage = _prompt_with_default("stage", "hatchling")
    status = _prompt_with_default("status", "active")
    sex = input("sex (male/female, optional): ").strip().lower()
    series_id = input("series_id (optional): ").strip()

    price_raw = _prompt_with_default("price", "0")
    try:
        price = float(price_raw)
    except ValueError as exc:
        raise UploadError(f"Invalid numeric value for price: {price_raw}") from exc

    in_stock = _prompt_yes_no("in_stock", default_yes=True)

    print("\n--- lineage confirmation (required step) ---")
    sire_code = _prompt_lineage("sire_code")
    dam_code = _prompt_lineage("dam_code")

    payload: Dict[str, Any] = {
        "code": code,
        "name": name,
        "description": description or None,
        "stage": stage,
        "status": status,
        "sex": sex or None,
        "series_id": series_id or None,
        "price": price,
        "in_stock": in_stock,
        "sire_code": sire_code,
        "dam_code": dam_code,
        "images": [],
    }

    # drop Nones except lineage fields (explicit unknown is meaningful)
    cleaned: Dict[str, Any] = {}
    for key, value in payload.items():
        if value is None and key not in {"sire_code", "dam_code"}:
            continue
        cleaned[key] = value

    print("\npayload preview:")
    print(json.dumps(cleaned, ensure_ascii=False, indent=2))
    if not _prompt_yes_no("Proceed upload", default_yes=False):
        raise UploadError("Upload canceled by user")

    return cleaned


def _load_payload(payload_file: str) -> Dict[str, Any]:
    try:
        with open(payload_file, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
    except FileNotFoundError as exc:
        raise UploadError(f"Payload file not found: {payload_file}") from exc
    except json.JSONDecodeError as exc:
        raise UploadError(f"Invalid JSON payload: {exc}") from exc

    if not isinstance(payload, dict):
        raise UploadError("Payload top-level must be a JSON object")

    return payload


def _validate_payload(payload: Dict[str, Any], *, require_lineage_keys: bool) -> None:
    unknown_keys = sorted(set(payload.keys()) - ALLOWED_PRODUCT_KEYS)
    if unknown_keys:
        raise UploadError("Unsupported payload keys: " + ", ".join(unknown_keys))

    camel_case_keys = [k for k in payload.keys() if any(ch.isupper() for ch in k)]
    if camel_case_keys:
        raise UploadError("camelCase keys are not allowed: " + ", ".join(sorted(camel_case_keys)))

    code = str(payload.get("code", "")).strip()
    if not code:
        raise UploadError("payload.code is required")

    if require_lineage_keys:
        missing = [k for k in ("sire_code", "dam_code") if k not in payload]
        if missing:
            raise UploadError(
                "payload must explicitly include sire_code and dam_code (null allowed): "
                + ", ".join(missing)
            )


def _resolve_base_url(env: str, base_url: Optional[str]) -> str:
    if base_url:
        return base_url.rstrip("/")
    if env not in ENV_URLS:
        raise UploadError(f"Unknown env: {env}. Choices: {', '.join(sorted(ENV_URLS.keys()))}")
    return ENV_URLS[env]


def _pick_target_record(
    *,
    exact_matches: List[Dict[str, Any]],
    product_id: Optional[str],
) -> Optional[str]:
    if product_id:
        return product_id
    if not exact_matches:
        return None
    if len(exact_matches) == 1:
        return exact_matches[0].get("id")

    print("\nDuplicate code records detected; cannot auto-select target.")
    for idx, item in enumerate(exact_matches, start=1):
        print(
            f"  {idx}. id={item.get('id')} code={item.get('code')} "
            f"name={item.get('name')} sireCode={item.get('sireCode')} damCode={item.get('damCode')}"
        )
    raise UploadError("Multiple records with same code; rerun with --product-id")


def _readback_verify(client: TurtleAlbumClient, product_id: str, payload: Dict[str, Any]) -> UploadResult:
    data = client.get_product(product_id)

    actual_sire = data.get("sireCode")
    actual_dam = data.get("damCode")

    if "sire_code" in payload and payload.get("sire_code") != actual_sire:
        raise UploadError(
            f"Readback mismatch: expected sire_code={payload.get('sire_code')} got {actual_sire}"
        )
    if "dam_code" in payload and payload.get("dam_code") != actual_dam:
        raise UploadError(
            f"Readback mismatch: expected dam_code={payload.get('dam_code')} got {actual_dam}"
        )

    return UploadResult(
        action="readback-ok",
        product_id=product_id,
        code=str(data.get("code") or ""),
        sire_code=actual_sire,
        dam_code=actual_dam,
    )


def run(args: argparse.Namespace) -> UploadResult:
    payload = _load_payload(args.payload_file) if args.payload_file else _interactive_payload()
    _validate_payload(payload, require_lineage_keys=not args.allow_missing_lineage)

    base_url = _resolve_base_url(args.env, args.base_url)
    if args.env == "prod" and not args.confirm_prod:
        raise UploadError("Production upload requires --confirm-prod")

    print(f"\nTarget: {args.env} ({base_url})")
    print("Authenticating...")
    client = TurtleAlbumClient(base_url=base_url, username=args.username, password=args.password)

    code = str(payload["code"]).strip()
    search_results = client.list_products_by_search(code)
    exact_matches = [item for item in search_results if str(item.get("code", "")).strip() == code]
    target_id = _pick_target_record(exact_matches=exact_matches, product_id=args.product_id)

    if target_id:
        if args.dry_run:
            print(f"[dry-run] would update product id={target_id} code={code}")
        else:
            print(f"Updating product id={target_id} code={code}")
            data = client.update_product(target_id, payload)
            target_id = data.get("id") or target_id
    else:
        if "name" not in payload or not str(payload.get("name", "")).strip():
            raise UploadError("Create mode requires payload.name")
        if args.dry_run:
            print(f"[dry-run] would create product code={code}")
        else:
            print(f"Creating product code={code}")
            data = client.create_product(payload)
            target_id = data.get("id")
            if not target_id:
                raise UploadError("Create succeeded but response has no product id")

    if args.dry_run:
        return UploadResult(
            action="dry-run",
            product_id=target_id or "(pending)",
            code=code,
            sire_code=payload.get("sire_code"),
            dam_code=payload.get("dam_code"),
        )

    result = _readback_verify(client, target_id, payload)
    print("\nUpload and readback verification passed.")
    print(f"- product_id: {result.product_id}")
    print(f"- code: {result.code}")
    print(f"- sireCode: {result.sire_code}")
    print(f"- damCode: {result.dam_code}")
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="OpenClaw product uploader")
    parser.add_argument("--env", default="dev", help="Environment: dev/staging/prod")
    parser.add_argument("--base-url", help="Custom base URL (overrides --env)")
    parser.add_argument("--username", required=True, help="Admin username")
    parser.add_argument("--password", required=True, help="Admin password")
    parser.add_argument("--payload-file", help="JSON payload file. If omitted, interactive mode is used.")
    parser.add_argument("--product-id", help="Explicit target product id when code is duplicated")
    parser.add_argument("--confirm-prod", action="store_true", help="Confirm production write")
    parser.add_argument("--dry-run", action="store_true", help="Validate and plan only; do not write")
    parser.add_argument(
        "--allow-missing-lineage",
        action="store_true",
        help="Allow payload without explicit sire_code/dam_code (not recommended)",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        run(args)
        return 0
    except UploadError as exc:
        print(f"\nUpload failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())

