# Backend Refactoring & Batch Import Implementation Plan

I will refactor the backend into a standard, modular Python/FastAPI architecture as requested, and then integrate the Batch Import feature within this new structure.

## 1. Backend Architecture Refactoring

I will reorganize `backend/` into a structured `app/` package:

```
backend/
├── app/
│   ├── main.py                 # Application factory & middleware
│   ├── api/                    # API Route Handlers
│   │   └── routers/
│   │       ├── auth.py         # Login/Logout
│   │       ├── products.py     # Public & Admin product operations
│   │       ├── carousels.py    # Carousel management
│   │       ├── featured.py     # Featured products
│   │       ├── settings.py     # System settings
│   │       └── imports.py      # New Batch Import endpoints
│   ├── core/                   # Core functionality
│   │   ├── security.py         # Auth logic (moved from auth.py)
│   │   └── file_utils.py       # File handling (moved from file_utils.py)
│   ├── db/                     # Database
│   │   └── session.py          # Database connection (moved from database.py)
│   ├── models/                 # SQLAlchemy Models
│   │   └── ...                 # (moved from models.py)
│   ├── schemas/                # Pydantic Schemas
│   │   └── ...                 # (moved from schemas.py)
│   └── services/               # Business Logic
│       └── import_service.py   # Batch import logic
└── run.py                      # Entry point script
```

**Steps:**
1.  **Move & Rename Files**: Move existing files to their new locations.
2.  **Fix Imports**: Update all internal imports to use the new package structure (e.g., `from app.db.session import get_db`).
3.  **Split `main.py`**: Extract logic from the giant `main.py` into the separate routers listed above.
4.  **Standardize**: Ensure consistent dependency injection and error handling across all modules.

## 2. Batch Import Implementation

Within the new `app/api/routers/imports.py` and `app/services/import_service.py`:
- **Robust Excel Parsing**: Strict validation of columns and data types.
- **Image Processing**: Support for ZIP upload with folder-based matching (e.g., folder "P001" -> Product "P001").
- **Feedback System**: Detailed success/failure report with specific error messages for the user.
- **Template Generation**: Auto-generate a downloadable Excel template with instructions.

## 3. Frontend Integration

- **Update API Service**: Point to the endpoints (URLs will remain compatible).
- **Import Dialog**: Complete the "Batch Import" UI with file drag-and-drop and progress feedback.
- **Error Display**: Show clear, actionable instructions when imports fail (e.g., "Row 5: Missing Price").

## 4. Execution Order

1.  **Refactor**: Create folders, move files, update imports, and split `main.py`.
2.  **Verify**: Ensure the app still runs and existing features work.
3.  **Implement Import**: Add the import service and router.
4.  **Frontend**: Finalize the React components.

This approach ensures a clean, maintainable codebase that is easy to extend and optimize in the future.
