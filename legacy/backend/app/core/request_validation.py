from __future__ import annotations

from fastapi.exceptions import RequestValidationError


REMOVED_PRODUCT_FIELDS = {"name", "stage", "status"}


def has_removed_product_field_error(exc: RequestValidationError) -> bool:
    """Return True if validation errors are caused by removed Product fields.

    FastAPI/Pydantic surfaces unknown keys as type=extra_forbidden.
    We convert those for removed Product fields into a 400.
    """

    for err in exc.errors():
        if err.get("type") != "extra_forbidden":
            continue
        loc = err.get("loc") or ()
        # Typical loc: ("body", "stage")
        if len(loc) >= 2 and loc[0] == "body" and loc[1] in REMOVED_PRODUCT_FIELDS:
            return True
    return False
