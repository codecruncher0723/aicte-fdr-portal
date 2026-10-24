from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from app.database import Base

class Institution(Base):
    __tablename__ = "institutions"

    id = Column(Integer, primary_key=True, index=True)
    aicte_pid = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    region = Column(String(50), nullable=False)  # e.g., wro, sro, nro
    state = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
    sponsoring_trust = Column(String(255), nullable=False)
    status = Column(String(50), default="Active", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    users = relationship("User", back_populates="institution", cascade="all, delete-orphan")
    fdrs = relationship("FDR", back_populates="institution", cascade="all, delete-orphan")
