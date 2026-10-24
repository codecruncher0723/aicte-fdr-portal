from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, Boolean, Date, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class FDR(Base):
    __tablename__ = "fdrs"

    id = Column(Integer, primary_key=True, index=True)
    fdr_number = Column(String(100), index=True, nullable=False)  # Not globally unique per invariant
    cert_number = Column(String(100), nullable=True)
    tripartite_ref = Column(String(150), nullable=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False)
    
    bank_name = Column(String(150), nullable=False)
    branch = Column(String(150), nullable=False)
    ifsc = Column(String(20), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    interest_rate = Column(String(50), nullable=True)
    
    issue_date = Column(Date, nullable=False)
    maturity_date = Column(Date, nullable=False)
    tenure_years = Column(Integer, nullable=True)
    auto_rollover = Column(Boolean, default=False, nullable=False)
    
    status = Column(String(50), default="SUBMITTED", nullable=False)  # FDRStatus
    lien_status = Column(String(100), default="Lien Registered", nullable=True)
    mandate_clause = Column(String(255), nullable=True)
    notes = Column(String(1000), nullable=True)
    
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint('amount > 0', name='chk_fdr_amount_positive'),
        CheckConstraint('maturity_date >= issue_date', name='chk_fdr_maturity_after_issue'),
    )

    institution = relationship("Institution", back_populates="fdrs")
    documents = relationship("DocumentVersion", back_populates="fdr", cascade="all, delete-orphan")
    requests = relationship("WorkflowRequest", back_populates="fdr", cascade="all, delete-orphan")
    provenance_records = relationship("FieldProvenance", back_populates="fdr", cascade="all, delete-orphan")

class FieldProvenance(Base):
    __tablename__ = "field_provenance"

    id = Column(Integer, primary_key=True, index=True)
    fdr_id = Column(Integer, ForeignKey("fdrs.id", ondelete="CASCADE"), nullable=False)
    field_name = Column(String(100), nullable=False)
    old_value = Column(String(500), nullable=True)
    new_value = Column(String(500), nullable=False)
    source_category = Column(String(50), nullable=False)  # ProvenanceSource
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    fdr = relationship("FDR", back_populates="provenance_records")
