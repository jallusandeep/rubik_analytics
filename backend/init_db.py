"""
Database initialization script
Creates all tables defined in SQLAlchemy models
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import Base, get_db_router
from app.core.config import settings
from app.models.user import User
from app.models.connection import Connection
from app.models.access_request import AccessRequest
from app.models.feature_request import FeatureRequest
from app.models.telegram_channel import TelegramChannel
from app.models.telegram_message import TelegramMessage

def init_database():
    """Initialize database with all tables"""
    print("=" * 60)
    print("  DATABASE INITIALIZATION")
    print("=" * 60)
    print(f"Data directory: {settings.DATA_DIR}")
    print(f"Database URL: {settings.DATABASE_URL}")
    print()
    
    # Get database router
    router = get_db_router(settings.DATA_DIR)
    auth_client = router.get_auth_db()
    
    if not auth_client:
        print("[ERROR] Failed to get auth database client")
        return False
    
    # Get SQLAlchemy engine
    engine = auth_client.engine
    
    print("[INFO] Creating all tables...")
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("[OK] All tables created successfully")
        
        # List created tables
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"\n[INFO] Created {len(tables)} tables:")
        for table in tables:
            print(f"  - {table}")
        
        print("\n" + "=" * 60)
        print("  DATABASE INITIALIZATION COMPLETE")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to create tables: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = init_database()
    sys.exit(0 if success else 1)
