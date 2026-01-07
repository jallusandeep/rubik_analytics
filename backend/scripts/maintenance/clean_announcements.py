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
        
        # Find blank entries
        blank_count = conn.execute("""
            SELECT COUNT(*) FROM corporate_announcements
            WHERE (headline IS NULL OR headline = '' OR headline = '-' OR headline = 'null' OR headline = 'None')
              AND (description IS NULL OR description = '' OR description = '-')
        """).fetchone()[0]
        print(f"Found {blank_count} blank entries")
        
        # Find duplicates by announcement_id
        id_dup_count = conn.execute("""
            SELECT COALESCE(SUM(cnt - 1), 0) FROM (
                SELECT COUNT(*) as cnt
                FROM corporate_announcements
                WHERE announcement_id IS NOT NULL AND announcement_id != ''
                GROUP BY announcement_id
                HAVING COUNT(*) > 1
            )
        """).fetchone()[0]
        print(f"Found {id_dup_count} duplicates by announcement_id")
        
        # Find duplicates by headline only (treating NULL symbol same as empty)
        # This is the main fix - use COALESCE to handle NULL symbols
        headline_dup_count = conn.execute("""
            SELECT COALESCE(SUM(cnt - 1), 0) FROM (
                SELECT COUNT(*) as cnt
                FROM corporate_announcements
                WHERE headline IS NOT NULL AND headline != '' AND headline != '-'
                GROUP BY headline, COALESCE(symbol_nse, symbol_bse, symbol, '')
                HAVING COUNT(*) > 1
            )
        """).fetchone()[0]
        print(f"Found {headline_dup_count} duplicates by headline+symbol")
        
        total_to_remove = blank_count + id_dup_count + headline_dup_count
        
        if total_to_remove == 0:
            print("\n[OK] No cleanup needed - database is clean!")
            return
        
        print(f"\n[INFO] Starting cleanup...")
        
        # Step 1: Delete blank entries
        if blank_count > 0:
            print(f"Deleting blank entries...")
            conn.execute("""
                DELETE FROM corporate_announcements
                WHERE (headline IS NULL OR headline = '' OR headline = '-' OR headline = 'null' OR headline = 'None')
                  AND (description IS NULL OR description = '' OR description = '-')
            """)
            conn.commit()
            print(f"[OK] Deleted blank entries")
        
        # Step 2: Delete duplicates by announcement_id (keep first by rowid)
        print(f"Removing duplicates by announcement_id...")
        conn.execute("""
            DELETE FROM corporate_announcements
            WHERE rowid NOT IN (
                SELECT MIN(rowid)
                FROM corporate_announcements
                GROUP BY announcement_id
            )
        """)
        conn.commit()
        print(f"[OK] Removed duplicates by announcement_id")
        
        # Step 3: Delete duplicates by headline + symbol (using COALESCE for NULL)
        # This is the KEY fix - treat NULL/empty symbols as same value
        print(f"Removing duplicates by headline+symbol...")
        conn.execute("""
            DELETE FROM corporate_announcements
            WHERE rowid NOT IN (
                SELECT MIN(rowid)
                FROM corporate_announcements
                GROUP BY headline, COALESCE(symbol_nse, symbol_bse, symbol, '')
            )
        """)
        conn.commit()
        print(f"[OK] Removed duplicates by headline+symbol")
        
        # Count after cleanup
        total_after = conn.execute("SELECT COUNT(*) FROM corporate_announcements").fetchone()[0]
        removed = total_before - total_after
        
        # Verify no more duplicates
        remaining_dups = conn.execute("""
            SELECT COUNT(*) FROM (
                SELECT headline, COALESCE(symbol_nse, symbol_bse, symbol, '') as sym, COUNT(*) as cnt
                FROM corporate_announcements
                WHERE headline IS NOT NULL AND headline != '' AND headline != '-'
                GROUP BY headline, COALESCE(symbol_nse, symbol_bse, symbol, '')
                HAVING COUNT(*) > 1
            )
        """).fetchone()[0]
        
        print(f"\n{'='*50}")
        print(f"[SUMMARY] Cleanup Complete:")
        print(f"  Before: {total_before} announcements")
        print(f"  After:  {total_after} announcements")
        print(f"  Removed: {removed} entries")
        print(f"  Remaining duplicates: {remaining_dups}")
        print(f"{'='*50}")
        
        if remaining_dups == 0:
            print("[OK] Database is now clean!")
        else:
            print(f"[WARNING] Still {remaining_dups} duplicate groups remaining")
        
    except Exception as e:
        print(f"[ERROR] Error during cleanup: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    clean_announcements()
