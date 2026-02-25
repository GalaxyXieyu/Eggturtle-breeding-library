#!/usr/bin/env python3
"""Clean legacy date/event records from products.description after backfill.

Goal: After breeder_events is populated, keep products.description as *free-form turtle description only*.
We remove segments that look like historical records (date + mating/egg keywords) while preserving
any non-record text on the same line.

Safety:
- Default is dry-run.
- PROD writes require --apply --confirm-prod.
- Uses /api/auth/login with creds from .env (TURTLEALBUM_ADMIN_USERNAME/PASSWORD).
- Read-back verification per product.

This script does NOT delete events from breeder_events.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

ENV_URLS = {
    "dev": "http://localhost:8000",
    "staging": "https://staging.turtlealbum.com",
    "prod": "https://qmngzrlhklmt.sealoshzh.site",
}


def _strip_quotes(v: str) -> str:
    v = v.strip()
    if (len(v) >= 2) and (v[0] == v[-1]) and (v[0] in {"\"", "'"}):
        return v[1:-1]
    return v


def load_dotenv(path: Path) -> bool:
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return False

    for line in raw.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith("export "):
            s = s[len("export ") :].lstrip()
        if "=" not in s:
            continue
        k, v = s.split("=", 1)
        k = k.strip()
        if not k:
            continue
        os.environ.setdefault(k, _strip_quotes(v))
    return True


def autoload_dotenv(explicit: Optional[str] = None) -> Optional[Path]:
    candidates: List[Path] = []
    if explicit:
        candidates.append(Path(explicit).expanduser())
    else:
        candidates.extend([Path.cwd() / ".env", Path(__file__).resolve().parent.parent / ".env"])

    for p in candidates:
        if load_dotenv(p):
            return p
    return None


class API:
    def __init__(self, base_url: str, token: Optional[str]):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _headers(self) -> Dict[str, str]:
        if not self.token:
            return {"Content-Type": "application/json"}
        t = self.token.strip()
        if not t.lower().startswith("bearer "):
            t = f"Bearer {t}"
        return {"Authorization": t, "Content-Type": "application/json"}

    def login(self, username: str, password: str) -> None:
        r = requests.post(
            f"{self.base_url}/api/auth/login",
            json={"username": username, "password": password},
            timeout=20,
        )
        r.raise_for_status()
        payload = r.json() or {}
        data = payload.get("data") or payload
        token = data.get("access_token") or data.get("accessToken") or data.get("token")
        if not token:
            raise RuntimeError("Login succeeded but token missing")
        self.token = token

    def list_female_breeders(self, limit: int) -> List[Dict[str, Any]]:
        r = requests.get(
            f"{self.base_url}/api/breeders",
            params={"sex": "female", "limit": limit},
            timeout=30,
        )
        r.raise_for_status()
        body = r.json() or {}
        data = body.get("data")
        return data if isinstance(data, list) else []

    def get_product(self, pid: str) -> Dict[str, Any]:
        r = requests.get(f"{self.base_url}/api/products/{pid}", timeout=20)
        r.raise_for_status()
        return (r.json() or {}).get("data") or {}

    def update_description(self, pid: str, desc: str) -> None:
        r = requests.put(
            f"{self.base_url}/api/products/{pid}",
            headers=self._headers(),
            json={"description": desc},
            timeout=30,
        )
        r.raise_for_status()


@dataclass
class Change:
    code: str
    product_id: str
    old: str
    new: str


_RE_DATE = re.compile(
    r"(?P<ymd>(?P<y>20\d{2})[\./\-](?P<m>\d{1,2})[\./\-](?P<d>\d{1,2}))"
    r"|(?P<md_dash>(?P<m2>\d{1,2})\-(?P<d2>\d{1,2}))"
    r"|(?P<md_dot>(?P<m3>\d{1,2})\s*\.\s*(?P<d3>\d{1,2}))"
)

# Event keywords that indicate a segment is a record (not free description).
# Keep this fairly permissive; it is only used after a date token is detected.
_RE_EVENT_KW = re.compile(
    r"(交配|配对|配"
    r"|产蛋|下蛋|产卵|下卵"
    r"|(?:产|下)\s*\d{1,2}\s*(?:个|枚|颗)?\s*受精(?:蛋|卵)?"
    r"|(?:产|下)\s*\d{1,2}\s*(?:受精)?\s*(?:个|枚|颗)?\s*(?:蛋|卵)"
    r"|(?:产|下)\s*(?:一窝)?\s*(?:蛋|卵))"
)


def _norm_newlines(s: str) -> str:
    return (s or "").replace("\r\n", "\n").replace("\r", "\n")


def _cleanup_line(line: str) -> str:
    """Remove date+event segments from a single line, preserving other text."""
    s = line
    matches = list(_RE_DATE.finditer(s))
    if not matches:
        return s

    keep_parts: List[str] = []
    cursor = 0

    for i, m in enumerate(matches):
        seg_start = m.start()
        seg_after_date = m.end()
        seg_end = matches[i + 1].start() if i + 1 < len(matches) else len(s)

        prefix = s[cursor:seg_start]
        segment = s[seg_after_date:seg_end]

        # If the segment contains event keywords, drop date+segment; otherwise keep intact.
        if _RE_EVENT_KW.search(segment):
            if prefix.strip():
                keep_parts.append(prefix)
        else:
            keep_parts.append(s[cursor:seg_end])

        cursor = seg_end

    out = "".join(keep_parts)
    out = re.sub(r"\s+", " ", out).strip()
    return out


def cleanup_description(desc: str) -> str:
    d = _norm_newlines(desc)

    out_lines: List[str] = []
    for raw in d.split("\n"):
        line = raw.rstrip()
        if not line.strip():
            continue

        # Drop obvious record headers.
        if re.search(r"(产蛋/交配记录|交配记录|产蛋记录)", line):
            continue
        if line.lstrip().startswith("-") and _RE_DATE.search(line) and _RE_EVENT_KW.search(line):
            # Bullet record line.
            continue

        cleaned = _cleanup_line(line)
        if not cleaned:
            continue
        out_lines.append(cleaned)

    return "\n".join(out_lines).strip()


def main() -> int:
    p = argparse.ArgumentParser(description="Clean legacy record lines from product.description")
    p.add_argument("--env", choices=sorted(ENV_URLS.keys()), default="dev")
    p.add_argument("--base-url", default=None)
    p.add_argument("--limit", type=int, default=1000)
    p.add_argument("--only-code", action="append", default=[])

    p.add_argument("--dry-run", action="store_true", help="Dry run (default)")
    p.add_argument("--apply", action="store_true", help="Write to API")
    p.add_argument("--confirm-prod", action="store_true")

    p.add_argument("--dotenv", default=None)
    p.add_argument("--no-dotenv", action="store_true")

    p.add_argument("--max-write", type=int, default=0, help="0 = no limit")
    p.add_argument("--show", type=int, default=8, help="Show up to N diffs in dry-run")

    args = p.parse_args()

    if not args.apply:
        args.dry_run = True

    loaded = None
    if not args.no_dotenv:
        loaded = autoload_dotenv(explicit=args.dotenv)

    base_url = (args.base_url or ENV_URLS[args.env]).rstrip("/")

    print(f"Base URL: {base_url}")
    print(f"Mode: {'APPLY' if args.apply else 'DRY-RUN'}")
    if loaded:
        print(f"Loaded .env: {loaded}")

    only = {c.strip().upper() for c in (args.only_code or []) if (c or "").strip()}

    api = API(base_url, token=None)

    breeders = api.list_female_breeders(limit=args.limit)
    changes: List[Change] = []

    for b in breeders:
        code = str(b.get("code") or "")
        pid = str(b.get("id") or "")
        if not code or not pid:
            continue
        if only and code.strip().upper() not in only:
            continue

        # b already includes description, but we do a fresh get_product for correctness.
        prod = api.get_product(pid)
        old = _norm_newlines(str(prod.get("description") or "")).strip()
        new = cleanup_description(old)

        if new != old:
            changes.append(Change(code=code, product_id=pid, old=old, new=new))

    print(f"Scanned female breeders: {len(breeders)}")
    print(f"Will change descriptions: {len(changes)}")

    if args.dry_run:
        for ch in changes[: max(args.show, 0)]:
            print("\n---", ch.code, ch.product_id)
            print("OLD:\n" + ch.old)
            print("NEW:\n" + ch.new)
        return 0

    if args.env == "prod" and not args.confirm_prod:
        print("Refusing to write to prod without --confirm-prod", file=sys.stderr)
        return 2

    username = os.environ.get("TURTLEALBUM_ADMIN_USERNAME")
    password = os.environ.get("TURTLEALBUM_ADMIN_PASSWORD")
    if not username or not password:
        print("Missing TURTLEALBUM_ADMIN_USERNAME/PASSWORD", file=sys.stderr)
        return 2

    api.login(username=username, password=password)

    wrote = 0
    for i, ch in enumerate(changes):
        if args.max_write and i >= args.max_write:
            print(f"Hit --max-write={args.max_write}; stopping")
            break

        api.update_description(ch.product_id, ch.new)
        rb = api.get_product(ch.product_id)
        got = _norm_newlines(str((rb.get("description") or ""))).strip()
        if got != _norm_newlines(ch.new).strip():
            raise RuntimeError(f"Readback mismatch for {ch.code} {ch.product_id}")
        wrote += 1

    print(f"WRITE OK: updated={wrote}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
