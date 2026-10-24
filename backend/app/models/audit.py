from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name = Column(String(150), nullable=True)
    actor_role = Column(String(50), nullable=True)
    
    action = Column(String(100), nullable=False)  # e.g., FDR_SUBMITTED, RELEASE_APPROVED, READINESS_CONFIRMED
    target_type = Column(String(50), nullable=False)  # FDR, REQUEST, DOCUMENT
    target_id = Column(String(100), nullable=False)
    
    details = Column(String(1000), nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
