from __future__ import annotations

import re
from typing import Optional, Tuple


_SINGLE_LETTER_RE = re.compile(r"^[A-Za-z]$")


def parse_code_sort_fields(
    code: Optional[str],
) -> Tuple[Optional[str], Optional[int], Optional[int], Optional[str]]:
    """Parse products.code into sortable components.

    Supported business formats (hyphen-separated):

    - <prefix>-<num> => parent_number
    - <prefix>-<num>-<num> => parent_number, child_number
    - <prefix>-<num>-<letter> => parent_number, child_letter (upper)
    - <prefix>-<letter> => child_letter (upper)

    For any unrecognized format, we still return the prefix (best-effort) and
    leave the other fields as None.
    """

    if code is None:
        return None, None, None, None
    if not isinstance(code, str):
        return None, None, None, None

    raw = code.strip()
    if not raw:
        return None, None, None, None

    parts = raw.split("-")
    prefix = parts[0] if parts else None

    parent_number: Optional[int] = None
    child_number: Optional[int] = None
    child_letter: Optional[str] = None

    if len(parts) == 2:
        suffix = parts[1]
        if suffix.isdigit():
            parent_number = int(suffix)
        elif _SINGLE_LETTER_RE.match(suffix):
            child_letter = suffix.upper()
    elif len(parts) == 3:
        parent_part = parts[1]
        child_part = parts[2]
        if parent_part.isdigit():
            parent_number = int(parent_part)
            if child_part.isdigit():
                child_number = int(child_part)
            elif _SINGLE_LETTER_RE.match(child_part):
                child_letter = child_part.upper()

    return prefix, parent_number, child_number, child_letter
