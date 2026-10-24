"""
Tests for Database Migrations, Runner, Deterministic Demo Seeding, and Role/Institution Coverage.
Verifies Phase 2 Definition of Done:
- Fresh database creation entirely from migrations and seed
- Repeatable seeding idempotency without duplicates
- Role coverage for all four roles
- Multi-institution isolation and coverage
- Check constraints and foreign key enforcement on seeded data
"""

import os
import tempfile
import pytest
from datetime import date
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.enums import UserRole, FDRStatus, RequestType
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR
from app.models.document import DocumentVersion
from app.models.workflow import WorkflowRequest, ApprovalRecord
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.migrations.runner import (
    apply_migrations,
    get_migration_status,
    get_applied_migrations,
    ensure_migration_table,
)
from app.seeds import seed_database
from app.security import hash_password, verify_password


@pytest.fixture
def fresh_engine():
    """Provides a fresh, temporary SQLite database engine."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name
    
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    yield engine
    engine.dispose()
    try:
        if os.path.exists(db_path):
            os.remove(db_path)
    except Exception:
        pass


@pytest.fixture
def migrated_session(fresh_engine):
    """Provides a session bound to a freshly migrated engine."""
    apply_migrations(fresh_engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=fresh_engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


def test_migration_runner_initializes_and_tracks_versions(fresh_engine):
    """Verifies that migration runner applies unapplied revisions and records them in schema_migrations."""
    # Initially no tables exist
    status_before = get_migration_status(fresh_engine)
    assert status_before["applied_count"] == 0
    assert status_before["pending_count"] >= 1
    assert status_before["is_up_to_date"] is False

    # Apply migrations
    applied = apply_migrations(fresh_engine)
    assert "001_initial_schema" in applied

    # Verify status is now up to date
    status_after = get_migration_status(fresh_engine)
    assert status_after["applied_count"] >= 1
    assert status_after["pending_count"] == 0
    assert status_after["is_up_to_date"] is True
    assert "001_initial_schema" in status_after["applied_versions"]


def test_migration_idempotency_on_repeated_runs(fresh_engine):
    """Verifies that running apply_migrations a second time is a no-op."""
    first_run = apply_migrations(fresh_engine)
    assert len(first_run) >= 1

    second_run = apply_migrations(fresh_engine)
    assert second_run == []  # No pending migrations to apply


def test_seed_database_covers_all_four_roles(migrated_session):
    """Verifies that all 4 canonical roles exist with valid hashed passwords and attributes."""
    counts = seed_database(migrated_session)
    assert counts["users"] >= 4

    roles_to_check = {
        UserRole.AICTE_ADMIN.value: ("admin_sridhar", "AdminDemo@2026", None),
        UserRole.INSTITUTION_OFFICER.value: ("officer_deshmukh", "OfficerDemo@2026", "1-10928374"),
        UserRole.VERIFICATION_OFFICER.value: ("verif_malhotra", "VerifDemo@2026", None),
        UserRole.APPROVING_AUTHORITY.value: ("approver_kumar", "ApproverDemo@2026", None),
    }

    for role_name, (expected_username, raw_pw, expected_pid) in roles_to_check.items():
        user = migrated_session.query(User).filter_by(role=role_name, username=expected_username).first()
        assert user is not None, f"User with role {role_name} and username {expected_username} not found"
        assert user.is_active is True
        assert user.email is not None

        # Passwords must be hashed (never stored plaintext)
        assert user.hashed_password != raw_pw
        assert user.hashed_password.startswith("pbkdf2:sha256:")
        assert verify_password(raw_pw, user.hashed_password) is True
        assert verify_password("IncorrectPassword", user.hashed_password) is False

        # Institution checks
        if expected_pid:
            assert user.institution is not None
            assert user.institution.aicte_pid == expected_pid
        else:
            assert user.institution_id is None


def test_seed_database_covers_at_least_two_institutions(migrated_session):
    """Verifies that at least two distinct institutions exist with isolated officers and FDR records."""
    seed_database(migrated_session)

    inst_a = migrated_session.query(Institution).filter_by(aicte_pid="1-10928374").first()
    inst_b = migrated_session.query(Institution).filter_by(aicte_pid="1-88492011").first()

    assert inst_a is not None, "Institution A (St. Xavier's) must exist in seed"
    assert inst_b is not None, "Institution B (BMS) must exist in seed"
    assert inst_a.id != inst_b.id

    # Check distinct officers
    officer_a = migrated_session.query(User).filter_by(username="officer_deshmukh").first()
    officer_b = migrated_session.query(User).filter_by(username="officer_venkatesh").first()

    assert officer_a.institution_id == inst_a.id
    assert officer_b.institution_id == inst_b.id
    assert officer_a.institution_id != officer_b.institution_id

    # Check FDRs assigned to each institution
    fdrs_a = migrated_session.query(FDR).filter_by(institution_id=inst_a.id).all()
    fdrs_b = migrated_session.query(FDR).filter_by(institution_id=inst_b.id).all()

    assert len(fdrs_a) >= 2, "Institution A must have seeded FDRs"
    assert len(fdrs_b) >= 2, "Institution B must have seeded FDRs"

    fdr_numbers_a = {f.fdr_number for f in fdrs_a}
    fdr_numbers_b = {f.fdr_number for f in fdrs_b}
    assert fdr_numbers_a.isdisjoint(fdr_numbers_b), "FDRs must be isolated per institution"


def test_seed_database_is_idempotent_and_repeatable(migrated_session):
    """Verifies that running seed_database multiple times does NOT duplicate records or error."""
    # First seed run
    counts_first = seed_database(migrated_session)

    # Second seed run
    counts_second = seed_database(migrated_session)

    # Third seed run
    counts_third = seed_database(migrated_session)

    assert counts_first == counts_second == counts_third

    # Query counts directly from DB
    assert migrated_session.query(Institution).count() == counts_first["institutions"]
    assert migrated_session.query(User).count() == counts_first["users"]
    assert migrated_session.query(FDR).count() == counts_first["fdrs"]
    assert migrated_session.query(DocumentVersion).count() == counts_first["documents"]
    assert migrated_session.query(WorkflowRequest).count() == counts_first["requests"]
    assert migrated_session.query(Notification).count() == counts_first["notifications"]
    assert migrated_session.query(AuditLog).count() == counts_first["audit_logs"]


def test_fresh_database_creation_end_to_end(fresh_engine):
    """Definition of Done: A fresh database can be created entirely from migrations and seed commands."""
    # 1. Apply migrations
    applied = apply_migrations(fresh_engine)
    assert len(applied) >= 1

    # 2. Seed database
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=fresh_engine)
    session = TestingSession()
    try:
        counts = seed_database(session)
        assert counts["institutions"] >= 2
        assert counts["users"] >= 4
        assert counts["fdrs"] >= 4

        # 3. Verify relations
        fdr = session.query(FDR).filter_by(fdr_number="FDR-PNB-883921").first()
        assert fdr is not None
        assert fdr.institution.name == "St. Xavier's Engineering College"
        assert len(fdr.documents) >= 1
    finally:
        session.close()


def test_seeded_data_rejects_invalid_constraints(migrated_session):
    """Definition of Done: Relationships and constraints reject invalid amounts/dates on seeded tables."""
    from sqlalchemy.exc import IntegrityError
    seed_database(migrated_session)
    inst = migrated_session.query(Institution).first()

    # Reject zero / negative deposit amount
    invalid_fdr = FDR(
        institution_id=inst.id,
        fdr_number="FDR-INVALID-001",
        bank_name="Test Bank",
        branch="Test Branch",
        ifsc="TEST0001234",
        amount=0.0,
        issue_date=date(2025, 1, 1),
        maturity_date=date(2026, 1, 1),
    )
    migrated_session.add(invalid_fdr)
    with pytest.raises(IntegrityError):
        migrated_session.commit()
    migrated_session.rollback()

    # Reject maturity date earlier than issue date
    invalid_fdr_dates = FDR(
        institution_id=inst.id,
        fdr_number="FDR-INVALID-002",
        bank_name="Test Bank",
        branch="Test Branch",
        ifsc="TEST0001234",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2025, 1, 1),  # earlier than issue date
    )
    migrated_session.add(invalid_fdr_dates)
    with pytest.raises(IntegrityError):
        migrated_session.commit()
    migrated_session.rollback()


def test_approval_record_exclusive_target_constraint(migrated_session):
    """Definition of Done: Database test confirms approval records cannot reference both/neither FDR and request."""
    from sqlalchemy.exc import IntegrityError
    seed_database(migrated_session)
    admin = migrated_session.query(User).filter_by(role=UserRole.AICTE_ADMIN.value).first()
    fdr = migrated_session.query(FDR).first()
    req = migrated_session.query(WorkflowRequest).first()

    # Attempt dual reference (both fdr_id and request_id set) -> MUST FAIL
    dual_approval = ApprovalRecord(
        fdr_id=fdr.id,
        request_id=req.id,
        approver_id=admin.id,
        decision="APPROVED",
    )
    migrated_session.add(dual_approval)
    with pytest.raises(IntegrityError):
        migrated_session.commit()
    migrated_session.rollback()

    # Attempt null reference (neither fdr_id nor request_id set) -> MUST FAIL
    null_approval = ApprovalRecord(
        fdr_id=None,
        request_id=None,
        approver_id=admin.id,
        decision="APPROVED",
    )
    migrated_session.add(null_approval)
    with pytest.raises(IntegrityError):
        migrated_session.commit()
    migrated_session.rollback()
