#!/usr/bin/env python3
"""Backfill breeder_events from legacy products.description.

This script scans female breeders' description fields, extracts historical mating/egg
records, and (optionally) writes them into breeder_events using the admin API.

Design goals:
- Default is safe: dry-run only.
- Idempotent writes via source_type='description' + source_id (SHA1).
- Robust-ish parsing for common operator formats: mm.dd / mm-dd / yyyy-mm-dd, etc.

Examples:
  # Dry-run scan on prod (no login required)
  python3 scripts/backfill_events_from_description.py --env prod --dry-run

  # Apply on staging
  python3 scripts/backfill_events_from_description.py --env staging --apply --username admin --password '***'

  # Apply on prod requires explicit confirm
  python3 scripts/backfill_events_from_description.py --env prod --apply --confirm-prod --username admin --password '***'
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests


def _strip_quotes(v: str) -> str:
    v = v.strip()
    if (len(v) >= 2) and ((v[0] == v[-1]) and v[0] in {'"', "'"}):
        return v[1:-1]
    return v


def load_dotenv(path: Path) -> bool:
    """Load KEY=VALUE pairs into os.environ (does not override existing values)."""
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
        v = _strip_quotes(v)
        os.environ.setdefault(k, v)
    return True


def autoload_dotenv(explicit: Optional[str] = None) -> Optional[Path]:
    """Try to load a .env from common locations; returns loaded path (or None)."""
    candidates: List[Path] = []
    if explicit:
        candidates.append(Path(explicit).expanduser())
    else:
        candidates.extend(
            [
                Path.cwd() / ".env",
                Path(__file__).resolve().parent.parent / ".env",
            ]
        )

    for p in candidates:
        if load_dotenv(p):
            return p
    return None


ENV_URLS = {
    "dev": "http://localhost:8000",
    "staging": "https://staging.turtlealbum.com",
    "prod": "https://qmngzrlhklmt.sealoshzh.site",
}

DEFAULT_TIMEOUT = 20


class BackfillError(RuntimeError):
    pass


@dataclass
class ParseFailure:
    code: str
    product_id: str
    reason: str
    snippet: str


@dataclass
class ParsedEvent:
    product_id: str
    code: str
    event_type: str  # mating|egg
    event_date: datetime
    male_code: Optional[str] = None
    egg_count: Optional[int] = None
    note: Optional[str] = None

    # Traceability/idempotency
    source_type: str = "description"
    source_id: str = ""

    # Flags for reporting only
    year_assumed: bool = False
    male_inferred: bool = False


class TurtleAlbumClient:
    def __init__(
        self,
        base_url: str,
        *,
        username: Optional[str] = None,
        password: Optional[str] = None,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.token: Optional[str] = None
        if username and password:
            self.token = self._login(username=username, password=password)

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
        auth: bool = False,
    ) -> Dict[str, Any]:
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if auth:
            if not self.token:
                raise BackfillError("Auth requested but client has no token")
            headers["Authorization"] = f"Bearer {self.token}"

        url = f"{self.base_url}{path}"
        try:
            resp = requests.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=json_body,
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise BackfillError(f"Request failed: {method} {url} -> {exc}") from exc

        body: Dict[str, Any]
        try:
            body = resp.json() if resp.content else {}
        except ValueError:
            body = {"message": resp.text}

        if resp.status_code >= 400:
            detail = body.get("message") or body.get("detail") or resp.text
            raise BackfillError(f"HTTP {resp.status_code}: {detail}")

        if isinstance(body, dict) and body.get("success") is False:
            raise BackfillError(f"API reported failure: {body.get('message') or body}")

        return body

    def _login(self, username: str, password: str) -> str:
        body = self._request(
            "POST",
            "/api/auth/login",
            json_body={"username": username, "password": password},
            auth=False,
        )
        token = ((body or {}).get("data") or {}).get("token")
        if not token:
            raise BackfillError("Login succeeded but token missing in response")
        return token

    def list_female_breeders(self, *, limit: int = 1000) -> List[Dict[str, Any]]:
        body = self._request(
            "GET",
            "/api/breeders",
            params={"sex": "female", "limit": limit},
            auth=False,
        )
        data = body.get("data")
        if not isinstance(data, list):
            return []
        return data

    def create_breeder_event(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        # Return the full API response so callers can inspect message for idempotency.
        return self._request(
            "POST",
            "/api/admin/breeder-events",
            json_body=payload,
            auth=True,
        )


_RE_YEAR_LINE = re.compile(r"^\s*(20\d{2})\s*(?:年)?\s*$")
_RE_LEADING_YEAR = re.compile(r"^\s*(20\d{2})\s*(?:年)?\s*[:：\-]?\s*(.*)$")

# Matches common date formats in operator notes.
_RE_DATE = re.compile(
    r"(?P<ymd>(?P<y>20\d{2})[\./\-](?P<m>\d{1,2})[\./\-](?P<d>\d{1,2}))"
    r"|(?P<md_dash>(?P<m2>\d{1,2})\-(?P<d2>\d{1,2}))"
    r"|(?P<md_dot>(?P<m3>\d{1,2})\s*\.\s*(?P<d3>\d{1,2}))"
)

_RE_EGG_COUNT = re.compile(r"(?:产|下)\s*(?:蛋|卵)?\s*(?P<n>\d{1,2})\s*(?:个|枚|颗)?\s*(?:蛋|卵)?")
_RE_EGG_KW = re.compile(r"(产蛋|下蛋|产卵|下卵)")
_RE_MATING_KW = re.compile(r"(交配|配对|配)")

# Candidate code formats seen in the dataset (ASCII prefix or CJK prefix, dash, then token).
_RE_CODE = re.compile(r"(?P<code>(?:[A-Za-z]{1,8}|[\u4e00-\u9fff]{1,8})\-[A-Za-z0-9]{1,8})\s*(?:公)?")


def _collapse_ws(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def _normalize_code_token(code: str) -> str:
    c = (code or "").strip()
    if not c:
        return ""
    if c.endswith("公"):
        c = c[:-1]
    # Uppercase ASCII letters only (keep CJK).
    out = []
    for ch in c:
        if "a" <= ch <= "z":
            out.append(chr(ord(ch) - 32))
        else:
            out.append(ch)
    return "".join(out)


def _safe_snippet(s: str, max_len: int = 120) -> str:
    t = _collapse_ws(s)
    if len(t) <= max_len:
        return t
    return t[: max_len - 3] + "..."


def _build_source_id(*, code: str, event_type: str, event_date: datetime, male_code: Optional[str], egg_count: Optional[int], note_key: str, year_assumed: bool, male_inferred: bool) -> str:
    parts = [
        "v1",
        _normalize_code_token(code),
        event_type,
        event_date.strftime("%Y-%m-%d"),
        _normalize_code_token(male_code or ""),
        str(egg_count) if egg_count is not None else "",
        _collapse_ws(note_key),
        "year_assumed=1" if year_assumed else "year_assumed=0",
        "male_inferred=1" if male_inferred else "male_inferred=0",
    ]
    raw = "|".join(parts).encode("utf-8")
    return hashlib.sha1(raw).hexdigest()


def _parse_date_match(
    m: re.Match[str],
    *,
    current_year: Optional[int],
    now_year: int,
    now_month: int,
) -> Tuple[Optional[datetime], bool, Optional[str]]:
    """Return (datetime, year_assumed, error_reason)."""

    y: Optional[int] = None
    mm: Optional[int] = None
    dd: Optional[int] = None
    year_assumed = False

    if m.group("ymd"):
        y = int(m.group("y"))
        mm = int(m.group("m"))
        dd = int(m.group("d"))
    elif m.group("md_dash"):
        mm = int(m.group("m2"))
        dd = int(m.group("d2"))
        if current_year is not None:
            y = current_year
        else:
            # Rollover heuristic: in early-year ops notes, months greater than now_month
            # usually refer to the previous year (e.g. Feb scanning sees 11.25).
            y = now_year - 1 if mm > now_month else now_year
            year_assumed = True
    elif m.group("md_dot"):
        mm = int(m.group("m3"))
        dd = int(m.group("d3"))
        if current_year is not None:
            y = current_year
        else:
            y = now_year - 1 if mm > now_month else now_year
            year_assumed = True
    else:
        return (None, False, "unknown_date_format")

    try:
        if y is None or mm is None or dd is None:
            return (None, False, "incomplete_date")
        if not (1 <= mm <= 12 and 1 <= dd <= 31):
            return (None, False, "invalid_month_or_day")
        return (datetime(y, mm, dd), year_assumed, None)
    except Exception:
        return (None, False, "invalid_date")


def _infer_event_type(segment: str) -> Tuple[Optional[str], Optional[int], bool, Optional[str]]:
    """Return (event_type, egg_count, ambiguous, reason_if_none)."""

    seg = segment or ""
    egg_count = None

    # Allow loose forms like "产一窝蛋" / "下了蛋".
    egg_loose_hit = (("产" in seg) or ("下" in seg)) and (("蛋" in seg) or ("卵" in seg))
    egg_hit = bool(_RE_EGG_KW.search(seg) or _RE_EGG_COUNT.search(seg) or egg_loose_hit)
    mating_hit = bool(_RE_MATING_KW.search(seg))

    if egg_hit and mating_hit:
        return (None, None, True, "ambiguous_keywords")

    if egg_hit:
        m = _RE_EGG_COUNT.search(seg)
        if m:
            try:
                egg_count = int(m.group("n"))
            except Exception:
                egg_count = None
        return ("egg", egg_count, False, None)

    if mating_hit:
        return ("mating", None, False, None)

    return (None, None, False, "no_event_keyword")


def _extract_male_code(*, segment: str, female_code: str, fallback_mate_code: Optional[str]) -> Tuple[Optional[str], bool]:
    """Return (male_code, inferred)."""

    seg = segment or ""
    female_norm = _normalize_code_token(female_code)

    candidates: List[str] = []
    for m in _RE_CODE.finditer(seg):
        c = _normalize_code_token(m.group("code"))
        if not c:
            continue
        # Skip self-reference.
        if female_norm and c == female_norm:
            continue
        candidates.append(c)

    if candidates:
        return (candidates[0], False)

    fb = _normalize_code_token(fallback_mate_code or "")
    if fb:
        return (fb, True)

    return (None, True)


def parse_description_events(
    *,
    product_id: str,
    code: str,
    description: Optional[str],
    mate_code: Optional[str],
    now_year: int,
) -> Tuple[List[ParsedEvent], List[ParseFailure]]:
    """Parse description into ParsedEvent list."""

    desc = description or ""
    if not desc.strip():
        return ([], [])

    events: List[ParsedEvent] = []
    failures: List[ParseFailure] = []

    current_year: Optional[int] = None

    for raw_line in desc.splitlines():
        line = (raw_line or "").strip()
        if not line:
            continue

        year_only = _RE_YEAR_LINE.match(line)
        if year_only:
            current_year = int(year_only.group(1))
            continue

        leading_year = _RE_LEADING_YEAR.match(line)
        if leading_year and leading_year.group(2).strip():
            current_year = int(leading_year.group(1))
            line = leading_year.group(2).strip()

        matches = list(_RE_DATE.finditer(line))
        if not matches:
            continue

        for i, m in enumerate(matches):
            dt, year_assumed, date_err = _parse_date_match(
                m,
                current_year=current_year,
                now_year=now_year,
                now_month=datetime.utcnow().month,
            )
            if date_err or dt is None:
                failures.append(
                    ParseFailure(
                        code=code,
                        product_id=product_id,
                        reason=f"date_parse_failed:{date_err}",
                        snippet=_safe_snippet(line),
                    )
                )
                continue

            seg_start = m.end()
            seg_end = matches[i + 1].start() if i + 1 < len(matches) else len(line)
            segment = line[seg_start:seg_end]
            segment = segment.strip(" \t:：,，;；|-—")

            event_type, egg_count, ambiguous, no_kw_reason = _infer_event_type(segment)
            if ambiguous:
                failures.append(
                    ParseFailure(
                        code=code,
                        product_id=product_id,
                        reason="ambiguous_event_type",
                        snippet=_safe_snippet(f"{m.group(0)} {segment}"),
                    )
                )
                continue

            if not event_type:
                failures.append(
                    ParseFailure(
                        code=code,
                        product_id=product_id,
                        reason=no_kw_reason or "unknown",
                        snippet=_safe_snippet(f"{m.group(0)} {segment}"),
                    )
                )
                continue

            male_code_val: Optional[str] = None
            male_inferred = False
            if event_type == "mating":
                male_code_val, male_inferred = _extract_male_code(
                    segment=segment,
                    female_code=code,
                    fallback_mate_code=mate_code,
                )

            flags = []
            if year_assumed:
                flags.append("year_assumed")
            if event_type == "mating" and male_inferred:
                flags.append("male_inferred")

            # Keep note short and operator-friendly.
            note_key = _safe_snippet(f"{m.group(0)} {segment}", max_len=160)
            note = "backfill:description"
            if flags:
                note += f"; flags={','.join(flags)}"
            note += f"; raw={note_key}"

            source_id = _build_source_id(
                code=code,
                event_type=event_type,
                event_date=dt,
                male_code=male_code_val,
                egg_count=egg_count,
                note_key=note_key,
                year_assumed=year_assumed,
                male_inferred=male_inferred,
            )

            events.append(
                ParsedEvent(
                    product_id=product_id,
                    code=code,
                    event_type=event_type,
                    event_date=dt,
                    male_code=male_code_val,
                    egg_count=egg_count,
                    note=note,
                    source_type="description",
                    source_id=source_id,
                    year_assumed=year_assumed,
                    male_inferred=male_inferred,
                )
            )

    return (events, failures)


def _has_keywords(description: Optional[str]) -> bool:
    d = description or ""
    if not d.strip():
        return False

    # Heuristic: require at least one date token + at least one event keyword.
    if not _RE_DATE.search(d):
        return False

    if re.search(r"(交配|配对|产蛋|下蛋|产卵|下卵)", d):
        return True

    # Loose egg forms: "产一窝蛋" / "下了蛋".
    if (("产" in d) or ("下" in d)) and (("蛋" in d) or ("卵" in d)):
        return True

    # Digit egg form: "产 4 蛋".
    if re.search(r"(?:产|下)\s*\d+\s*(?:个|枚|颗)?\s*(?:蛋|卵)", d):
        return True

    return False


def _print_report(
    *,
    scanned: int,
    matched: int,
    events: List[ParsedEvent],
    failures: List[ParseFailure],
    preview_per_code: int,
    irregular_top_n: int,
):
    by_type: Dict[str, int] = {}
    year_assumed = 0
    male_inferred = 0
    for e in events:
        by_type[e.event_type] = by_type.get(e.event_type, 0) + 1
        if e.year_assumed:
            year_assumed += 1
        if e.event_type == "mating" and e.male_inferred:
            male_inferred += 1

    print("\n=== Dry-run report ===")
    print(f"Scanned breeders: {scanned}")
    print(f"Matched (keyword heuristic): {matched}")
    print(f"Parsed events: {len(events)}")
    print(f"  by type: {json.dumps(by_type, ensure_ascii=False)}")
    print(f"  year_assumed: {year_assumed}")
    print(f"  male_inferred (mating): {male_inferred}")
    print(f"Parse failures: {len(failures)}")

    if failures:
        print(f"\n--- Top irregular samples (up to {irregular_top_n}) ---")
        for f in failures[:irregular_top_n]:
            print(f"- {f.code} ({f.reason}): {f.snippet}")

    if events:
        print(f"\n--- Preview (up to {preview_per_code} events per breeder) ---")
        grouped: Dict[str, List[ParsedEvent]] = {}
        for e in events:
            grouped.setdefault(e.code, []).append(e)

        for code in sorted(grouped.keys()):
            items = sorted(grouped[code], key=lambda x: (x.event_date, x.event_type, x.source_id))
            print(f"\n{code}:")
            for e in items[:preview_per_code]:
                dt = e.event_date.strftime("%Y-%m-%d")
                extra = []
                if e.event_type == "mating":
                    extra.append(f"male={e.male_code or '∅'}")
                    if e.male_inferred:
                        extra.append("male_inferred")
                if e.event_type == "egg":
                    extra.append(f"egg_count={e.egg_count if e.egg_count is not None else '∅'}")
                if e.year_assumed:
                    extra.append("year_assumed")
                extra_s = ("; " + ", ".join(extra)) if extra else ""
                print(f"  - {dt} {e.event_type}{extra_s} (src={e.source_id[:10]})")


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Backfill breeder_events from products.description")
    p.add_argument("--env", choices=sorted(ENV_URLS.keys()), default="dev")
    p.add_argument("--base-url", default=None)

    p.add_argument("--limit", type=int, default=1000, help="Max number of female breeders to scan")
    p.add_argument("--only-code", action="append", default=[], help="Filter to specific breeder code(s)")
    p.add_argument("--include-all", action="store_true", help="Scan all breeders (skip keyword prefilter)")

    p.add_argument("--dry-run", action="store_true", help="Dry run (default)")
    p.add_argument("--apply", action="store_true", help="Actually write via admin API")
    p.add_argument("--confirm-prod", action="store_true", help="Required when --apply on prod")

    p.add_argument("--dotenv", default=None, help="Optional .env path (default: auto-load) ")
    p.add_argument("--no-dotenv", action="store_true", help="Disable .env autoload")

    p.add_argument(
        "--username",
        default=(
            os.getenv("TURTLEALBUM_ADMIN_USERNAME")
            or os.getenv("TURTLEALBUM_USERNAME")
        ),
    )
    p.add_argument(
        "--password",
        default=(
            os.getenv("TURTLEALBUM_ADMIN_PASSWORD")
            or os.getenv("TURTLEALBUM_PASSWORD")
        ),
    )

    p.add_argument("--preview-per-code", type=int, default=5)
    p.add_argument("--irregular-top-n", type=int, default=20)
    p.add_argument("--max-write", type=int, default=0, help="0 = no limit")

    args = p.parse_args(argv)

    loaded_env = None
    if not args.no_dotenv:
        loaded_env = autoload_dotenv(explicit=args.dotenv)
        # Resolve creds after loading .env
        args.username = args.username or os.getenv("TURTLEALBUM_ADMIN_USERNAME") or os.getenv("TURTLEALBUM_USERNAME")
        args.password = args.password or os.getenv("TURTLEALBUM_ADMIN_PASSWORD") or os.getenv("TURTLEALBUM_PASSWORD")

    if not args.apply:
        args.dry_run = True

    base_url = (args.base_url or ENV_URLS[args.env]).rstrip("/")
    now_year = datetime.utcnow().year

    print(f"Base URL: {base_url}")
    print(f"Mode: {'APPLY' if args.apply else 'DRY-RUN'}")
    if loaded_env:
        print(f"Loaded .env: {loaded_env}")

    ro_client = TurtleAlbumClient(base_url)
    breeders = ro_client.list_female_breeders(limit=args.limit)

    only_codes = [_normalize_code_token(c) for c in (args.only_code or []) if (c or "").strip()]

    scanned = 0
    matched = 0
    all_events: List[ParsedEvent] = []
    all_failures: List[ParseFailure] = []

    for b in breeders:
        product_id = str(b.get("id") or "")
        code = str(b.get("code") or "")
        if not product_id or not code:
            continue

        code_norm = _normalize_code_token(code)
        if only_codes and code_norm not in set(only_codes):
            continue

        scanned += 1

        desc = b.get("description")
        mate_code = b.get("mateCode") or b.get("mate_code")

        if not args.include_all and not _has_keywords(desc):
            continue

        matched += 1
        events, failures = parse_description_events(
            product_id=product_id,
            code=code,
            description=desc,
            mate_code=mate_code,
            now_year=now_year,
        )
        all_events.extend(events)
        all_failures.extend(failures)

    # Stable ordering for report.
    all_failures.sort(key=lambda x: (x.code, x.reason, x.snippet))

    _print_report(
        scanned=scanned,
        matched=matched,
        events=all_events,
        failures=all_failures,
        preview_per_code=args.preview_per_code,
        irregular_top_n=args.irregular_top_n,
    )

    if not args.apply:
        return 0

    if args.env == "prod" and not args.confirm_prod:
        print("\nRefusing to apply on prod without --confirm-prod")
        return 2

    if not args.username or not args.password:
        print("\n--apply requires --username/--password (or TURTLEALBUM_USERNAME/TURTLEALBUM_PASSWORD env vars)")
        return 2

    wr_client = TurtleAlbumClient(base_url, username=args.username, password=args.password)

    print("\n=== Apply ===")
    created = 0
    skipped = 0
    failed = 0

    # Post in deterministic order.
    events_sorted = sorted(all_events, key=lambda e: (e.code, e.event_date, e.event_type, e.source_id))

    for i, e in enumerate(events_sorted):
        if args.max_write and i >= args.max_write:
            print(f"Hit --max-write={args.max_write}; stopping")
            break

        payload: Dict[str, Any] = {
            "product_id": e.product_id,
            "event_type": e.event_type,
            "event_date": e.event_date.isoformat(),
            "male_code": e.male_code,
            "egg_count": e.egg_count,
            "note": e.note,
            "source_type": e.source_type,
            "source_id": e.source_id,
        }

        try:
            body = wr_client.create_breeder_event(payload)
            message = str(body.get("message") or "")
            if "already exists" in message.lower():
                skipped += 1
            else:
                created += 1
        except BackfillError as exc:
            # If API uses the idempotency skip message as success, we won't be here.
            failed += 1
            print(f"❌ {e.code} {e.event_date.strftime('%Y-%m-%d')} {e.event_type} -> {exc}")

    print("\nApply summary:")
    print(f"  created: {created}")
    print(f"  skipped: {skipped}")
    print(f"  failed: {failed}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
