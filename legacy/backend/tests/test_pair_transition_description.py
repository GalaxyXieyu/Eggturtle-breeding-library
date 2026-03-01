import os
import sys

# Allow running tests from backend/ without installing the package.
HERE = os.path.abspath(os.path.dirname(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(HERE, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.services.breeder_mate import parse_current_mate_code, process_pair_transition_description


def test_pair_transition_marks_first_new_egg_event_and_sets_tag() -> None:
    old = "2.22 更换配偶为B公"
    new = "2.22 更换配偶为B公\n2.23 产4蛋"

    out = process_pair_transition_description(old, new)

    assert out == "2.22 更换配偶为B公 #TA_PAIR_TRANSITION=1\n2.23 产4蛋-换公过渡期"
    assert parse_current_mate_code(out) == "B"


def test_pair_transition_marks_second_new_egg_event_and_counts_down_to_zero() -> None:
    old = "2.22 更换配偶为B公 #TA_PAIR_TRANSITION=1\n2.23 产4蛋-换公过渡期"
    new = old + "\n2.24 产3蛋"

    out = process_pair_transition_description(old, new)

    assert out == (
        "2.22 更换配偶为B公 #TA_PAIR_TRANSITION=0\n"
        "2.23 产4蛋-换公过渡期\n"
        "2.24 产3蛋-换公过渡期"
    )


def test_pair_transition_does_not_mark_third_egg_event() -> None:
    old = (
        "2.22 更换配偶为B公 #TA_PAIR_TRANSITION=0\n"
        "2.23 产4蛋-换公过渡期\n"
        "2.24 产3蛋-换公过渡期"
    )
    new = old + "\n2.25 产2蛋"

    out = process_pair_transition_description(old, new)

    assert out.endswith("2.25 产2蛋")
    assert "2.25 产2蛋-换公过渡期" not in out


def test_pair_transition_does_not_duplicate_suffix_if_user_added_it() -> None:
    old = "2.22 更换配偶为B公 #TA_PAIR_TRANSITION=2"
    new = old + "\n2.23 产4蛋-换公过渡期"

    out = process_pair_transition_description(old, new)

    assert out == "2.22 更换配偶为B公 #TA_PAIR_TRANSITION=1\n2.23 产4蛋-换公过渡期"


def test_pair_transition_ignores_non_egg_lines() -> None:
    old = "2.22 更换配偶为B公"
    new = old + "\n2.23 hb-a something\n2.24 喂食"

    out = process_pair_transition_description(old, new)

    # No egg event appended: keep as-is (no tag injected yet).
    assert out == new
