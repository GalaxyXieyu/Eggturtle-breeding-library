#!/usr/bin/env python3
"""
Create admin user for testing
"""

from sqlalchemy.orm import Session
from database import get_db, create_tables
from models import User
from auth import get_password_hash

def create_admin_user():
    """Create an admin user for testing."""
    # Create tables if they don't exist
    create_tables()
    
    # Get database session
    db = next(get_db())
    
    try:
        # Check if admin user already exists
        existing_user = db.query(User).filter(User.username == "admin").first()
        if existing_user:
            print("✅ Admin user already exists")
            return
        
        # Create admin user
        hashed_password = get_password_hash("admin123")
        admin_user = User(
            username="admin",
            hashed_password=hashed_password,
            role="admin",
            is_active=True
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print("✅ Admin user created successfully")
        print("   Username: admin")
        print("   Password: admin123")
        
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_user()
