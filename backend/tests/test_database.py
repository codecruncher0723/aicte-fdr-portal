import pytest
from sqlalchemy import text
from app.database import engine, Base, SessionLocal

def test_database_connection():
    """Verify engine connects and executes basic query."""
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1")).scalar()
        assert result == 1

def test_foreign_keys_pragma_enabled():
    """Verify SQLite foreign key constraints are enforced."""
    with engine.connect() as conn:
        fk_status = conn.execute(text("PRAGMA foreign_keys")).scalar()
        assert fk_status == 1, "Foreign keys pragma must be 1 (enabled) in SQLite"

def test_session_lifecycle():
    """Verify session can open and close cleanly."""
    db = SessionLocal()
    try:
        val = db.execute(text("SELECT 'AICTE_OK'")).scalar()
        assert val == 'AICTE_OK'
    finally:
        db.close()
