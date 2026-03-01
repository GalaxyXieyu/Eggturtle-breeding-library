import re
from collections import Counter
from typing import Optional

# Note: mating/egg/change-mate events are currently stored in Product.description.
# Change-mate event format: "M.D 更换配偶为<公龟编号>" (e.g. "2.22 更换配偶为B公").
_CHANGE_MATE_RE = re.compile(r"(?:^|\n)\s*\d{1,2}\.\d{1,2}\s*更换配偶为\s*([^\s\n]+)")

# Line-level helpers (used for transition-period automation).
_CHANGE_MATE_LINE_RE = re.compile(r"^\s*\d{1,2}\.\d{1,2}\s*更换配偶为\s*[^\s\n]+")
_CHANGE_MATE_KEY_RE = re.compile(r"^\s*(\d{1,2}\.\d{1,2})\s*更换配偶为\s*([^\s\n#]+)")
_EGG_EVENT_LINE_RE = re.compile(r"^\s*\d{1,2}\.\d{1,2}\s*产\s*\d+\s*蛋\b")

_PAIR_TRANSITION_SUFFIX = "-换公过渡期"
_PAIR_TRANSITION_TAG_RE = re.compile(r"#TA_PAIR_TRANSITION=(\d+)\b")


def parse_current_mate_code(description: Optional[str]) -> Optional[str]:
    """Parse the latest mate code from breeder description.

    Returns the extracted code (trimmed). If the extracted token ends with "公",
    we also strip that suffix because some notes use that as a gender marker.

    NOTE: We intentionally keep this parser independent from any machine tags
    (e.g. "#TA_PAIR_TRANSITION=...") by ensuring those tags are separated by
    whitespace in the stored notes.
    """

    if not description:
        return None

    matches = _CHANGE_MATE_RE.findall(description)
    if not matches:
        return None

    raw = (matches[-1] or "").strip()
    if not raw:
        return None

    # Common note style: "B公" where the actual code may be "B".
    if raw.endswith("公") and len(raw) > 1:
        raw = raw[: -1].strip()

    return raw or None


def _split_lines(text: str) -> tuple[list[str], bool]:
    normalized = (text or "").replace("\r\n", "\n")
    trailing_newline = normalized.endswith("\n")
    lines = normalized.split("\n")
    if trailing_newline:
        lines = lines[:-1]
    return lines, trailing_newline


def _join_lines(lines: list[str], trailing_newline: bool) -> str:
    out = "\n".join(lines)
    if trailing_newline:
        out += "\n"
    return out


def _change_mate_key(line: str) -> Optional[tuple[str, str]]:
    m = _CHANGE_MATE_KEY_RE.match(line or "")
    if not m:
        return None
    return m.group(1), m.group(2)


def _parse_transition_remaining(line: str) -> Optional[int]:
    m = _PAIR_TRANSITION_TAG_RE.search(line or "")
    if not m:
        return None
    try:
        return max(0, int(m.group(1)))
    except Exception:
        return None


def _set_transition_remaining(line: str, remaining: int) -> str:
    remaining = max(0, int(remaining))
    if _PAIR_TRANSITION_TAG_RE.search(line or ""):
        return _PAIR_TRANSITION_TAG_RE.sub(f"#TA_PAIR_TRANSITION={remaining}", line)
    return (line or "").rstrip() + f" #TA_PAIR_TRANSITION={remaining}"


def _count_egg_events_after_change(lines: list[str], change_idx: int) -> int:
    count = 0
    for l in lines[change_idx + 1 :]:
        if _CHANGE_MATE_LINE_RE.match(l or ""):
            break
        if _EGG_EVENT_LINE_RE.match(l or ""):
            count += 1
    return count


def _compute_new_line_indices(old_lines: list[str], new_lines: list[str]) -> set[int]:
    # Fast path: user appends new lines (the expected workflow).
    if len(old_lines) <= len(new_lines) and old_lines == new_lines[: len(old_lines)]:
        return set(range(len(old_lines), len(new_lines)))

    # Conservative fallback: treat lines not "accounted for" by the old multiset as new.
    # This avoids rewriting old lines when the user only appends, while still handling
    # minor reorder/edit cases reasonably.
    old_counts = Counter(l.rstrip() for l in old_lines)
    new_indices: set[int] = set()
    for idx, line in enumerate(new_lines):
        k = (line or "").rstrip()
        if old_counts.get(k, 0) > 0:
            old_counts[k] -= 1
        else:
            new_indices.add(idx)
    return new_indices


def process_pair_transition_description(
    old_description: Optional[str],
    new_description: Optional[str],
) -> Optional[str]:
    """Apply "change-mate transition period" automation to breeder descriptions.

    Business rules (stored in Product.description lines):
    - Change-mate event line: "M.D 更换配偶为B公" (no year).
    - After a change-mate event, the next 2 egg events should be marked with
      a suffix "-换公过渡期".
    - Egg event line format: "M.D 产N蛋" (e.g. "2.22 产4蛋").
    - We persist remaining transition count in a machine tag appended to the
      change-mate line: "#TA_PAIR_TRANSITION=<n>".

    This function is intentionally conservative: it only annotates *newly added*
    egg-event lines and only updates the latest change-mate line's tag.
    """

    if new_description is None:
        return None

    old_lines, _old_trailing_nl = _split_lines(old_description or "")
    new_lines, new_trailing_nl = _split_lines(new_description or "")

    # Locate latest change-mate line in the new description.
    change_idx: Optional[int] = None
    for i, line in enumerate(new_lines):
        if _CHANGE_MATE_LINE_RE.match(line or ""):
            change_idx = i

    if change_idx is None:
        return new_description

    change_line = new_lines[change_idx]
    remaining = _parse_transition_remaining(change_line)

    new_indices = _compute_new_line_indices(old_lines, new_lines)
    new_egg_indices = [
        i
        for i in sorted(new_indices)
        if i > change_idx and _EGG_EVENT_LINE_RE.match(new_lines[i] or "")
    ]

    should_activate = remaining is not None or (change_idx in new_indices) or bool(new_egg_indices)

    # If there's no tag yet, only start tracking when the user adds a new change-mate
    # line or when they add an egg event after a change-mate line.
    if remaining is None and not should_activate:
        return new_description

    # No tag yet: infer how many egg events already happened after this change-mate
    # line in the old description, then persist a tag.
    if remaining is None:
        key = _change_mate_key(change_line)
        old_change_idx = None
        if key is not None:
            for i, line in enumerate(old_lines):
                if _change_mate_key(line) == key:
                    old_change_idx = i
        already = _count_egg_events_after_change(old_lines, old_change_idx) if old_change_idx is not None else 0
        remaining = max(0, 2 - already)

    # Apply suffix to newly added egg-event lines after the latest change-mate line.
    for i in new_egg_indices:
        if remaining <= 0:
            break
        line = new_lines[i] or ""
        if _PAIR_TRANSITION_SUFFIX not in line:
            new_lines[i] = line.rstrip() + _PAIR_TRANSITION_SUFFIX
        remaining -= 1

    # Persist updated remaining count on the change-mate line.
    new_lines[change_idx] = _set_transition_remaining(new_lines[change_idx], remaining)

    return _join_lines(new_lines, new_trailing_nl)
