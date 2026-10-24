"""
002_workflow_document_evidence: Add document_version_id to verification_records
and approval_records for immutable workflow evidence linking.
"""

from sqlalchemy import text

REVISION = "002_workflow_document_evidence"
DESCRIPTION = "Add document_version_id to verification_records and approval_records for workflow evidence linking"


def upgrade(conn):
    """Adds document_version_id foreign key column to verification_records and approval_records if not present."""
    # Check verification_records
    verif_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(verification_records)")).fetchall()]
    if "document_version_id" not in verif_cols:
        conn.execute(text("ALTER TABLE verification_records ADD COLUMN document_version_id INTEGER REFERENCES document_versions(id)"))

    # Check approval_records
    appr_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(approval_records)")).fetchall()]
    if "document_version_id" not in appr_cols:
        conn.execute(text("ALTER TABLE approval_records ADD COLUMN document_version_id INTEGER REFERENCES document_versions(id)"))


def downgrade(conn):
    """Downgrade is a no-op on SQLite to avoid data loss."""
    pass
