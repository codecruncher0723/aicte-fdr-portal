from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id = Column(Integer, primary_key=True, index=True)
    fdr_id = Column(Integer, ForeignKey("fdrs.id", ondelete="CASCADE"), nullable=True)
    request_id = Column(Integer, ForeignKey("workflow_requests.id", ondelete="CASCADE"), nullable=True)
    
    document_type = Column(String(100), nullable=False)  # e.g., FDR_RECEIPT, TRIPARTITE_AGREEMENT, BANK_CONFIRMATION_VOUCHER
    version = Column(Integer, default=1, nullable=False)
    storage_key = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint('file_size > 0', name='chk_doc_size_positive'),
        CheckConstraint('length(sha256_hash) == 64', name='chk_doc_hash_length'),
    )

    fdr = relationship("FDR", back_populates="documents")
    request = relationship("WorkflowRequest", back_populates="documents")
    uploader = relationship("User", back_populates="uploaded_documents")
