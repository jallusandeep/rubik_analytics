"""
Clean up blank and duplicate announcements from database
"""
import os
import sys
import duckdb
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings

def clean_announcements():
    """Remove blank entries and duplicates from announcements database"""
    data_dir = settings.DATA_DIR
    db_dir = os.path.join(data_dir, "Company Fundamentals")
    db_path = os.path.join(db_dir, "corporate_announcements.duckdb")
    
    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}")
        return
    
    print(f"Connecting to database: {db_path}")
    conn = duckdb.connect(db_path)
    
    try:
        # Count before cleanup
        total_before = conn.execute("SELECT COUNT(*) FROM corporate_announcements").fetchone()[0]
        print(f"\nTotal announcements before cleanup: {total_before}")
        
        # Find blank entries (no headline and no description, or headline is just "-")
        blank_query = """
            SELECT announcement_id, headline, description 
            FROM corporate_announcements
            WHERE (headline IS NULL OR headline = '' OR headline = '-' OR headline = 'null' OR headline = 'None')
              AND (description IS NULL OR description = '' OR description = '-')
        """
        blanks = conn.execute(blank_query).fetchall()
        blank_count = len(blanks)
        print(f"Found {blank_count} blank entries")
        
        # Find duplicates (same announcement_id)
        duplicate_query = """
            SELECT announcement_id, COUNT(*) as cnt
            FROM corporate_announcements
            GROUP BY announcement_id
            HAVING COUNT(*) > 1
        """
        duplicates = conn.execute(duplicate_query).fetchall()
        duplicate_count = sum(row[1] - 1 for row in duplicates)  # Count extra copies
        print(f"Found {len(duplicates)} announcement_ids with duplicates ({duplicate_count} extra copies)")
        
        if blank_count == 0 and duplicate_count == 0:
            print("\n✅ No cleanup needed - database is clean!")
            return
        
        # Delete blank entries
        if blank_count > 0:
            print(f"\nDeleting {blank_count} blank entries...")
            conn.execute("""
                DELETE FROM corporate_announcements
                WHERE (headline IS NULL OR headline = '' OR headline = '-' OR headline = 'null' OR headline = 'None')
                  AND (description IS NULL OR description = '' OR description = '-')
            """)
            print(f"✅ Deleted {blank_count} blank entries")
        
        # Delete duplicates (keep the one with earliest received_at)
        if duplicate_count > 0:
            print(f"\nRemoving {duplicate_count} duplicate entries...")
            conn.execute("""
                DELETE FROM corporate_announcements
                WHERE rowid NOT IN (
                    SELECT MIN(rowid)
                    FROM corporate_announcements
                    GROUP BY announcement_id
                )
            """)
            print(f"✅ Removed duplicate entries")
        
        # Count after cleanup
        total_after = conn.execute("SELECT COUNT(*) FROM corporate_announcements").fetchone()[0]
        removed = total_before - total_after
        
        print(f"\n📊 Cleanup Summary:")
        print(f"  Before: {total_before} announcements")
        print(f"  After:  {total_after} announcements")
        print(f"  Removed: {removed} entries")
        print(f"\n✅ Cleanup complete!")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    clean_announcements()

