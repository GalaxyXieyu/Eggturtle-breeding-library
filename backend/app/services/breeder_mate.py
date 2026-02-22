import re
from typing import Optional

# Note: mating/egg/change-mate events are currently stored in Product.description.
# Change-mate event format: "M.D 更换配偶为<公龟编号>" (e.g. "2.22 更换配偶为B公").
_CHANGE_MATE_RE = re.compile(r"(?:^|\n)\s*\d{1,2}\.\d{1,2}\s*更换配偶为\s*([^\s\n]+)")


def parse_current_mate_code(description: Optional[str]) -> Optional[str]:
    """Parse the latest mate code from breeder description.

    Returns the extracted code (trimmed). If the extracted token ends with "公",
    we also strip that suffix because some notes use that as a gender marker.

    NOTE: Machine tags (e.g. "#TA_PAIR_TRANSITION=...") should be separated by
    whitespace so this parser still extracts just the mate token.
    """

    if not description:
        return None

    matches = _CHANGE_MATE_RE.findall(description)
    if not matches:
        return None

    raw = (matches[-1] or "").strip()
    if not raw:
        return None

    if raw.endswith("公") and len(raw) > 1:
        raw = raw[: -1].strip()

    return raw or None
