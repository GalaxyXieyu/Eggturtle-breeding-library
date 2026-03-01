from __future__ import annotations

from typing import Optional


def normalize_code_upper(value: Optional[str]) -> Optional[str]:
    """Normalize identifier-like codes to uppercase.

    Business rule: we only change letter case; we intentionally do not trim or
    otherwise mutate the value (e.g. keep hyphens/spaces as-is).
    """

    if value is None:
        return None
    if not isinstance(value, str):
        return value  # type: ignore[return-value]
    return value.upper()
