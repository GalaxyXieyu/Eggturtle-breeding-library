from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.schemas import LoginRequest, ApiResponse
from app.core.security import authenticate_user, create_access_token, get_current_active_user, User

router = APIRouter()


def _build_auth_payload(user: User) -> dict:
    """Build a login/refresh payload with a new access token."""
    access_token, expires_at = create_access_token(data={"sub": user.username})
    return {
        "token": access_token,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role
        },
        "expiresAt": expires_at.isoformat()
    }


@router.post("/login", response_model=ApiResponse)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Admin login endpoint."""
    user = authenticate_user(db, login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    return ApiResponse(
        data=_build_auth_payload(user),
        message="Login successful"
    )


@router.post("/refresh", response_model=ApiResponse)
async def refresh_token(current_user: User = Depends(get_current_active_user)):
    """Refresh access token for authenticated admin."""
    return ApiResponse(
        data=_build_auth_payload(current_user),
        message="Token refreshed successfully"
    )


@router.post("/logout", response_model=ApiResponse)
async def logout(current_user: User = Depends(get_current_active_user)):
    """Admin logout endpoint."""
    return ApiResponse(
        data=None,
        message="Logout successful"
    )

@router.get("/verify", response_model=ApiResponse)
async def verify_token_endpoint(current_user: User = Depends(get_current_active_user)):
    """Verify JWT token endpoint."""
    return ApiResponse(
        data={
            "id": current_user.id,
            "username": current_user.username,
            "role": current_user.role
        },
        message="Token is valid"
    )
