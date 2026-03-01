from fastapi.exceptions import RequestValidationError

from app.core.request_validation import has_removed_product_field_error


def test_removed_fields_detected() -> None:
    exc = RequestValidationError(
        [
            {
                "type": "extra_forbidden",
                "loc": ("body", "stage"),
                "msg": "Extra inputs are not permitted",
                "input": "hatchling",
            }
        ]
    )
    assert has_removed_product_field_error(exc) is True


def test_other_validation_errors_not_detected() -> None:
    exc = RequestValidationError(
        [
            {
                "type": "missing",
                "loc": ("body", "code"),
                "msg": "Field required",
                "input": {},
            }
        ]
    )
    assert has_removed_product_field_error(exc) is False
