"""
Create admin user
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def create_admin():
    db = SessionLocal()
    try:
        # Check if user exists
        existing = db.query(User).filter(User.email == "jallusandeep0902@gmail.com").first()
        if existing:
            print("[INFO] User already exists")
            return
        
        # Create admin user
        admin = User(
            user_id=str(__import__('uuid').uuid4()),
            email="jallusandeep0902@gmail.com",
            mobile="9999999999",  # Placeholder mobile
            username="admin",
            name="Admin User",
            hashed_password=get_password_hash("admin123"),  # Change this password!
            role="super_admin",
            is_active=True,
            account_status="ACTIVE"
        )
        db.add(admin)
        db.commit()
        print("[OK] Admin user created successfully!")
        print(f"Email: jallusandeep0902@gmail.com")
        print(f"Password: admin123")
        print("\n⚠️  IMPORTANT: Change this password after first login!")
    except Exception as e:
        print(f"[ERROR] Failed to create user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
