"""
Integration Tests for Institutional Profile and Regulatory Trust standing (/api/v1/institutions).
Verifies Profile & Trust requirements:
1. Unauthenticated access and updates return 401 Unauthorized.
2. Institution Officer can load their own institution profile including contact and sponsoring trust.
3. Cross-institution access and update attempts (IDOR) return 403 Forbidden.
4. Institution Officer can update their own sponsoring trust and campus location, creating an audit log.
5. Oversight roles (Verification Officer, Approving Authority) are rejected with 403 Forbidden (separation of duties).
6. AICTE Admin can update authorized institutions with regulatory audit logging.
"""

import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.models.institution import Institution
from app.models.audit import AuditLog
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app


@pytest.fixture(scope="module")
def setup_profile_test_db():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_profile_trust.db")
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    apply_migrations(engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()

    seed_database(session, storage_root=temp_dir)
    session.commit()

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    yield {
        "client": client,
        "session": session,
        "TestingSession": TestingSession,
    }

    app.dependency_overrides.clear()
    session.close()


def get_token(session, username: str) -> str:
    user = session.query(User).filter_by(username=username).first()
    assert user is not None, f"User {username} not found in test database"
    return create_access_token({
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "institution_id": user.institution_id,
    })


def test_unauthenticated_profile_access_and_update(setup_profile_test_db):
    client = setup_profile_test_db["client"]

    # GET without token
    resp_get = client.get("/api/v1/institutions/1")
    assert resp_get.status_code == 401

    # PATCH without token
    resp_patch = client.patch("/api/v1/institutions/1", json={"sponsoring_trust": "Hacked Trust"})
    assert resp_patch.status_code == 401


def test_institution_officer_loads_own_profile(setup_profile_test_db):
    client = setup_profile_test_db["client"]
    session = setup_profile_test_db["session"]
    token = get_token(session, "officer_deshmukh")

    resp = client.get("/api/v1/institutions/1", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 1
    assert data["aicte_pid"] == "1-10928374"
    assert data["name"] == "St. Xavier's Engineering College"
    assert data["sponsoring_trust"] == "St. Xavier's Technical Education Society"
    assert data["contact_name"] == "Dr. Anand Deshmukh"
    assert data["contact_email"] == "anand.deshmukh@stxaviers.edu.in"
    assert data["city"] == "Pune"
    assert data["state"] == "Maharashtra"


def test_institution_officer_cross_institution_idor_blocked(setup_profile_test_db):
    client = setup_profile_test_db["client"]
    session = setup_profile_test_db["session"]
    token = get_token(session, "officer_deshmukh")

    # Officer 1 attempts to read Institution 2 (BMS College)
    resp_get = client.get("/api/v1/institutions/2", headers={"Authorization": f"Bearer {token}"})
    assert resp_get.status_code == 403
    assert "forbidden" in resp_get.json()["detail"].lower()

    # Officer 1 attempts to patch Institution 2
    resp_patch = client.patch(
        "/api/v1/institutions/2",
        json={"sponsoring_trust": "Malicious Hijack"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_patch.status_code == 403
    assert "forbidden" in resp_patch.json()["detail"].lower()


def test_institution_officer_updates_own_profile(setup_profile_test_db):
    client = setup_profile_test_db["client"]
    session = setup_profile_test_db["session"]
    token = get_token(session, "officer_deshmukh")

    update_payload = {
        "sponsoring_trust": "St. Xavier's Higher Technical Education Trust",
        "city": "Pune Metropolitan",
        "contact_name": "Dr. Anand K. Deshmukh",
    }

    resp = client.patch(
        "/api/v1/institutions/1",
        json=update_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sponsoring_trust"] == "St. Xavier's Higher Technical Education Trust"
    assert data["city"] == "Pune Metropolitan"
    assert data["contact_name"] == "Dr. Anand K. Deshmukh"

    # Verify audit log entry was created
    audit = session.query(AuditLog).filter_by(
        target_type="INSTITUTION",
        target_id="1",
        action="UPDATE_INSTITUTION_PROFILE",
    ).order_by(AuditLog.id.desc()).first()
    assert audit is not None
    assert "St. Xavier" in audit.details


def test_oversight_roles_cannot_update_institution_profile(setup_profile_test_db):
    client = setup_profile_test_db["client"]
    session = setup_profile_test_db["session"]
    verif_token = get_token(session, "verif_malhotra")
    approver_token = get_token(session, "approver_kumar")

    # Verification Officer
    resp_v = client.patch(
        "/api/v1/institutions/1",
        json={"sponsoring_trust": "Unauthorized Change"},
        headers={"Authorization": f"Bearer {verif_token}"},
    )
    assert resp_v.status_code == 403

    # Approving Authority
    resp_a = client.patch(
        "/api/v1/institutions/1",
        json={"sponsoring_trust": "Unauthorized Change"},
        headers={"Authorization": f"Bearer {approver_token}"},
    )
    assert resp_a.status_code == 403


def test_aicte_admin_can_update_institution_profile(setup_profile_test_db):
    client = setup_profile_test_db["client"]
    session = setup_profile_test_db["session"]
    admin_token = get_token(session, "admin_sridhar")

    resp = client.patch(
        "/api/v1/institutions/2",
        json={"sponsoring_trust": "BMS Educational and Research Trust (Updated)"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sponsoring_trust"] == "BMS Educational and Research Trust (Updated)"

    # Verify audit log for admin update
    audit = session.query(AuditLog).filter_by(
        target_type="INSTITUTION",
        target_id="2",
        action="UPDATE_INSTITUTION_PROFILE",
    ).order_by(AuditLog.id.desc()).first()
    assert audit is not None
    assert audit.actor_role == UserRole.AICTE_ADMIN.value
