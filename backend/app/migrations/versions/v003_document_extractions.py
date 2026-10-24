"""
003_document_extractions: Add document_extractions to hold text-extraction suggestions
for uploaded documents, kept separate from institution-entered FDR values.
"""

from app.database import Base
import app.models  # Ensure all model tables are registered with Base.metadata

REVISION = "003_document_extractions"
DESCRIPTION = "Add document_extractions table for non-authoritative text extraction suggestions"


def upgrade(conn):
    """Creates document_extractions if absent (fresh databases already get it from 001)."""
    Base.metadata.tables["document_extractions"].create(bind=conn, checkfirst=True)


def downgrade(conn):
    """Downgrade is a no-op to avoid data loss."""
    pass
