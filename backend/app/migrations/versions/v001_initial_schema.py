"""
001_initial_schema: Initial relational schema for AICTE FDR Management Portal.
Creates core tables, foreign keys, and check constraints:
- institutions
- users
- fdrs
- field_provenance
- fdr_renewal_history
- document_versions
- workflow_requests
- verification_records
- approval_records
- status_transition_history
- audit_logs
- notifications
"""

from app.database import Base
import app.models  # Ensure all model tables are registered with Base.metadata

REVISION = "001_initial_schema"
DESCRIPTION = "Create core relational schema, foreign keys, and check constraints"


def upgrade(conn):
    """Creates all registered tables and check constraints."""
    Base.metadata.create_all(bind=conn)


def downgrade(conn):
    """Drops all registered tables."""
    Base.metadata.drop_all(bind=conn)
