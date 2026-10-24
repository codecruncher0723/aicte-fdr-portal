from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class WorkflowRequest(Base):
    __tablename__ = "workflow_requests"

    id = Column(Integer, primary_key=True, index=True)
    fdr_id = Column(Integer, ForeignKey("fdrs.id", ondelete="CASCADE"), nullable=False)
    request_type = Column(String(50), nullable=False)  # RequestType: RENEWAL, RELEASE_REFUND
    status = Column(String(50), default="REQUESTED", nullable=False)  # RenewalStatus or ReleaseStatus
    
    reason = Column(String(255), nullable=False)
    applicant_notes = Column(String(1000), nullable=True)
    officer_remarks = Column(String(1000), nullable=True)
    
    council_order_ref = Column(String(100), nullable=True)
    approval_date = Column(Date, nullable=True)
    readiness_remarks = Column(String(1000), nullable=True)
    
    confirmation_reference = Column(String(100), nullable=True)  # UTR or Bank Voucher number
    confirmation_timestamp = Column(DateTime, nullable=True)
    
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    fdr = relationship("FDR", back_populates="requests")
    documents = relationship("DocumentVersion", back_populates="request", cascade="all, delete-orphan")
    verifications = relationship("VerificationRecord", back_populates="request", cascade="all, delete-orphan")
    approvals = relationship("ApprovalRecord", back_populates="request", cascade="all, delete-orphan")

class VerificationRecord(Base):
    __tablename__ = "verification_records"

    id = Column(Integer, primary_key=True, index=True)
    fdr_id = Column(Integer, ForeignKey("fdrs.id", ondelete="CASCADE"), nullable=True)
    request_id = Column(Integer, ForeignKey("workflow_requests.id", ondelete="CASCADE"), nullable=True)
    
    officer_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    decision = Column(String(50), nullable=False)  # VERIFIED, CORRECTION_REQUIRED, REJECTED
    remarks = Column(String(1000), nullable=True)
    
    discrepancy_code = Column(String(50), nullable=True)
    discrepancy_severity = Column(String(50), nullable=True)  # DiscrepancySeverity
    discrepancy_note = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    request = relationship("WorkflowRequest", back_populates="verifications")

class ApprovalRecord(Base):
    __tablename__ = "approval_records"

    id = Column(Integer, primary_key=True, index=True)
    fdr_id = Column(Integer, ForeignKey("fdrs.id", ondelete="CASCADE"), nullable=True)
    request_id = Column(Integer, ForeignKey("workflow_requests.id", ondelete="CASCADE"), nullable=True)
    
    approver_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    decision = Column(String(50), nullable=False)  # APPROVED, REJECTED, RELEASE_APPROVED
    council_order_ref = Column(String(100), nullable=True)
    reason = Column(String(1000), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint(
            '(fdr_id IS NOT NULL AND request_id IS NULL) OR (fdr_id IS NULL AND request_id IS NOT NULL)',
            name='chk_approval_target_exclusive'
        ),
    )

    request = relationship("WorkflowRequest", back_populates="approvals")
