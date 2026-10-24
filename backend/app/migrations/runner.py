"""
Migration runner for AICTE FDR Portal.
Provides lightweight, dependency-free schema migration management with
deterministic version tracking in the 'schema_migrations' table.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any
from sqlalchemy import text, Engine, Connection

from app.migrations.versions import v001_initial_schema as m001
from app.migrations.versions import v002_workflow_document_evidence as m002

MIGRATIONS = [
    m001,
    m002,
]

MIGRATION_TABLE_DDL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    applied_at DATETIME NOT NULL
);
"""


def ensure_migration_table(conn: Connection) -> None:
    """Creates the schema_migrations table if it does not exist."""
    conn.execute(text(MIGRATION_TABLE_DDL))


def get_applied_migrations(conn: Connection) -> List[str]:
    """Returns list of revision IDs already applied to the database."""
    ensure_migration_table(conn)
    result = conn.execute(text("SELECT version FROM schema_migrations ORDER BY applied_at ASC"))
    return [row[0] for row in result.fetchall()]


def apply_migrations(engine_or_conn: Any) -> List[str]:
    """
    Applies any unapplied migrations in ascending sequential order.
    Returns the list of newly applied revision IDs.
    """
    applied_now: List[str] = []

    def _execute(conn: Connection):
        ensure_migration_table(conn)
        already_applied = set(get_applied_migrations(conn))

        for migration in MIGRATIONS:
            rev = migration.REVISION
            desc = getattr(migration, "DESCRIPTION", "")
            if rev not in already_applied:
                migration.upgrade(conn)
                now = datetime.now(timezone.utc).isoformat()
                conn.execute(
                    text("INSERT INTO schema_migrations (version, description, applied_at) VALUES (:ver, :desc, :at)"),
                    {"ver": rev, "desc": desc, "at": now},
                )
                applied_now.append(rev)

    if isinstance(engine_or_conn, Engine):
        with engine_or_conn.begin() as conn:
            _execute(conn)
    elif isinstance(engine_or_conn, Connection):
        _execute(engine_or_conn)
    else:
        bind = getattr(engine_or_conn, "bind", engine_or_conn)
        if isinstance(bind, Engine):
            with bind.begin() as conn:
                _execute(conn)
        else:
            _execute(bind)

    return applied_now


def get_migration_status(engine_or_conn: Any) -> Dict[str, Any]:
    """Returns the current status of applied and pending migrations."""
    def _inspect(conn: Connection) -> Dict[str, Any]:
        ensure_migration_table(conn)
        applied = set(get_applied_migrations(conn))
        all_revs = [m.REVISION for m in MIGRATIONS]
        pending = [rev for rev in all_revs if rev not in applied]
        return {
            "total_available": len(all_revs),
            "applied_count": len(applied),
            "pending_count": len(pending),
            "applied_versions": list(applied),
            "pending_versions": pending,
            "is_up_to_date": len(pending) == 0,
        }

    if isinstance(engine_or_conn, Engine):
        with engine_or_conn.connect() as conn:
            return _inspect(conn)
    elif isinstance(engine_or_conn, Connection):
        return _inspect(engine_or_conn)
    else:
        bind = getattr(engine_or_conn, "bind", engine_or_conn)
        if isinstance(bind, Engine):
            with bind.connect() as conn:
                return _inspect(conn)
        return _inspect(bind)


def init_schema(engine_or_conn: Any) -> List[str]:
    """Convenience alias for running all pending migrations."""
    return apply_migrations(engine_or_conn)
