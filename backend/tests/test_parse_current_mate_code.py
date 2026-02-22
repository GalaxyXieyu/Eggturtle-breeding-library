import os
import sys

# Allow running tests from backend/ without installing the package.
HERE = os.path.abspath(os.path.dirname(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(HERE, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.services.breeder_mate import parse_current_mate_code


def test_parse_current_mate_code_returns_last_change_event() -> None:
    desc = "".join(
        [
            "2.01 交配 A公\n",
            "2.22 更换配偶为B公\n",
            "2.23 更换配偶为 MG-01公\n",
        ]
    )
    assert parse_current_mate_code(desc) == "MG-01"


def test_parse_current_mate_code_handles_single_line() -> None:
    assert parse_current_mate_code("2.22 更换配偶为B公") == "B"


def test_parse_current_mate_code_none_when_missing() -> None:
    assert parse_current_mate_code("2.22 交配 B公") is None
    assert parse_current_mate_code("") is None
    assert parse_current_mate_code(None) is None
