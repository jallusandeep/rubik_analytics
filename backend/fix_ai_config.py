"""
Fix AI enrichment configuration to use the correct connection
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal
from app.models.connection import Connection
import duckdb

# Connect to AI database
AI_DB_PATH = "../data/News/Final/news_ai.duckdb"

try:
    conn = duckdb.connect(AI_DB_PATH)
    
    # Check current config
    print("Current AI enrichment configurations:")
    configs = conn.execute("SELECT * FROM ai_enrichment_config").fetchall()
    for config in configs:
        print(f"  Config ID: {config[0]}, Connection ID: {config[1]}, Active: {config[4]}")
    
    # Get available AI connections from SQLite
    db = SessionLocal()
    ai_connections = db.query(Connection).filter(Connection.connection_type == "AI_ML").all()
    print(f"\nAvailable AI connections:")
    for c in ai_connections:
        print(f"  ID {c.id}: {c.name} ({c.provider}) - Status: {c.status}")
    
    if ai_connections:
        # Use the first available AI connection
        new_conn_id = ai_connections[0].id
        print(f"\nUpdating AI enrichment config to use connection ID {new_conn_id}...")
        
        # Update all configs to use the new connection
        conn.execute(f"UPDATE ai_enrichment_config SET connection_id = {new_conn_id}")
        conn.commit()
        print("[OK] Configuration updated successfully!")
    else:
        print("[WARNING] No AI connections found. Please create an AI connection first.")
    
    conn.close()
    db.close()
    
except Exception as e:
    print(f"[ERROR] {e}")
    import traceback
    traceback.print_exc()
