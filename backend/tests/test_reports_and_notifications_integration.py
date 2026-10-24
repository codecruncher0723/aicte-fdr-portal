"""
Integration Tests for Reports and Notifications Endpoints.
Covers:
1. GET /api/v1/reports/fdrs.csv:
   - Admin master export with status and institution filters.
   - Institution officer export scoped strictly to own institution.
   - Cross-institution export attempts rejected with 403.
2. GET /api/v1/reports/requests.csv:
   - Export workflow requests with type/status filters.
   - Institution scoping and cross-institution rejection (403).
3. GET /api/v1/notifications:
   - Dynamic user-, role-, and institution-level notification delivery.
4. PATCH /api/v1/notifications/{id}:
   - Mark as read / unread.
   - Strict owner authorization preventing unauthorized cross-user modifications (403).
   - 404 on missing notifications.
"""

import csv
import io
import os
import tempfile
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.models.enums import UserRole, FDRStatus
from app.models.user import User
from app.models.fdr import FDR
from app.models.workflow import WorkflowRequest
from app.models.notification import Notification
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app


@pytest.fixture(scope="module")
def setup_reports_notif_db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    apply_migrations(engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    seed_database(session)

    # Insert test notifications
    inst_user = session.query(User).filter_by(username="officer_deshmukh").first()
    other_inst_user = session.query(User).filter_by(username="officer_venkatesh").first()
    admin_user = session.query(User).filter_by(username="admin_sridhar").first()
    verif_user = session.query(User).filter_by(username="verif_malhotra").first()

    notifs = [
        Notification(
            title="WRO Deficiency Notice: FDR-PNB-883921",
            message="Joint Account Mandate text omits regional office descriptor.",
            notification_type="ACTION_REQUIRED",
            is_read=False,
            recipient_user_id=inst_user.id,
            institution_id=inst_user.institution_id,
        ),
        Notification(
            title="Institution Specific Notification",
            message="Annual compliance audit scheduled for your institution.",
            notification_type="INFO",
            is_read=False,
            recipient_role=UserRole.INSTITUTION_OFFICER.value,
            institution_id=inst_user.institution_id,
        ),
        Notification(
            title="Other Institution Alert",
            message="Confidential alert for other institution only.",
            notification_type="WARNING",
            is_read=False,
            recipient_user_id=other_inst_user.id,
            institution_id=other_inst_user.institution_id,
        ),
        Notification(
            title="Verifier Review Needed",
            message="A new FDR has been submitted for scrutiny.",
            notification_type="ACTION_REQUIRED",
            is_read=False,
            recipient_role=UserRole.VERIFICATION_OFFICER.value,
        ),
        Notification(
            title="Council Administrative Broadcast",
            message="Updated AICTE FDR Guidelines released.",
            notification_type="INFO",
            is_read=True,
            recipient_role=UserRole.AICTE_ADMIN.value,
        ),
    ]
    session.add_all(notifs)

    # Insert sample workflow request for reports test
    sample_fdr = session.query(FDR).filter_by(institution_id=inst_user.institution_id).first()
    if sample_fdr:
        req = WorkflowRequest(
            fdr_id=sample_fdr.id,
            request_type="RENEWAL",
            status="PENDING_VERIFICATION",
            reason="Standard 3-year term rollover window is active.",
            created_by_id=inst_user.id,
        )
        session.add(req)

    session.commit()
    session.close()

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield engine, TestingSession
    app.dependency_overrides.clear()
    engine.dispose()
    try:
        if os.path.exists(db_path):
            os.remove(db_path)
    except Exception:
        pass


@pytest.fixture
def client(setup_reports_notif_db):
    return TestClient(app)


def token_for(user: User) -> str:
    return create_access_token({
        "sub": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "institution_id": user.institution_id,
    })


# -------------------------------------------------------------
# 1. FDR CSV Report Tests
# -------------------------------------------------------------

def test_fdrs_csv_export_admin(client, setup_reports_notif_db):
    _, TestingSession = setup_reports_notif_db
    db = TestingSession()
    admin_user = db.query(User).filter_by(username="admin_sridhar").first()
    token = token_for(admin_user)

    res = client.get(
        "/api/v1/reports/fdrs.csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "aicte_fdr_export.csv" in res.headers.get("content-disposition", "")

    reader = csv.DictReader(io.StringIO(res.text))
    rows = list(reader)
    assert len(rows) > 0
    assert "fdr_id" in rows[0]
    assert "fdr_number" in rows[0]
    assert "amount_inr" in rows[0]
    assert "status" in rows[0]


def test_fdrs_csv_export_with_filter(client, setup_reports_notif_db):
    _, TestingSession = setup_reports_notif_db
    db = TestingSession()
    admin_user = db.query(User).filter_by(username="admin_sridhar").first()
    token = token_for(admin_user)

    res = client.get(
        "/api/v1/reports/fdrs.csv?status=ACTIVE",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    reader = csv.DictReader(io.StringIO(res.text))
    rows = list(reader)
    for r in rows:
        assert r["status"] == "ACTIVE"


def test_fdrs_csv_institution_isolation(client, setup_reports_notif_db):
    _, TestingSession = setup_reports_notif_db
    db = TestingSession()
    inst_user = db.query(User).filter_by(username="officer_deshmukh").first()
    other_user = db.query(User).filter_by(username="officer_venkatesh").first()
    token = token_for(inst_user)

    # 1. Export own FDRs without institution param -> succeeds and only contains own institution FDRs
    res = client.get(
        "/api/v1/reports/fdrs.csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    reader = csv.DictReader(io.StringIO(res.text))
    rows = list(reader)
    for r in rows:
        assert int(r["institution_id"]) == inst_user.institution_id

    # 2. Attempt to export other institution's FDRs explicitly -> 403 Forbidden
    res_forbidden = client.get(
        f"/api/v1/reports/fdrs.csv?institution_id={other_user.institution_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_forbidden.status_code == 403


# -------------------------------------------------------------
# 2. Requests CSV Report Tests
# -------------------------------------------------------------

def test_requests_csv_export_admin_and_filters(client, setup_reports_notif_db):
    _, TestingSession = setup_reports_notif_db
    db = TestingSession()
    admin_user = db.query(User).filter_by(username="admin_sridhar").first()
    token = token_for(admin_user)

    res = client.get(
        "/api/v1/reports/requests.csv?request_type=RENEWAL",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "aicte_requests_export.csv" in res.headers.get("content-disposition", "")

    reader = csv.DictReader(io.StringIO(res.text))
    rows = list(reader)
    assert len(rows) > 0
    for r in rows:
        assert r["request_type"] == "RENEWAL"
        assert "request_id" in r
        assert "fdr_number" in r


def test_requests_csv_institution_isolation(client, setup_reports_notif_db):
    _, TestingSession = setup_reports_notif_db
    db = TestingSession()
    inst_user = db.query(User).filter_by(username="officer_deshmukh").first()
    other_user = db.query(User).filter_by(username="officer_venkatesh").first()
    token = token_for(inst_user)

    # Own requests
    res = client.get(
        "/api/v1/reports/requests.csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200

    # Cross-institution requests -> 403 Forbidden
    res_forbidden = client.get(
        f"/api/v1/reports/requests.csv?institution_id={other_user.institution_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_forbidden.status_code == 403


# -------------------------------------------------------------
# 3. Notifications API Integration Tests
# -------------------------------------------------------------

def test_list_notifications_scoping(client, setup_reports_notif_db):
    _, TestingSession = setup_reports_notif_db
    db = TestingSession()
    inst_user = db.query(User).filter_by(username="officer_deshmukh").first()
    verif_user = db.query(User).filter_by(username="verif_malhotra").first()

    inst_token = token_for(inst_user)
    verif_token = token_for(verif_user)

    # 1. Institution officer receives only their own or their institution's notifications
    res_inst = client.get(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert res_inst.status_code == 200
    inst_notifs = res_inst.json()
    assert len(inst_notifs) >= 2
    titles = [n["title"] for n in inst_notifs]
    assert "WRO Deficiency Notice: FDR-PNB-883921" in titles
    assert "Institution Specific Notification" in titles
    # Must NOT see other institution's notification
    assert "Other Institution Alert" not in titles
    assert "Verifier Review Needed" not in titles

    # 2. Verifier officer receives verifier notifications
    res_verif = client.get(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {verif_token}"},
    )
    assert res_verif.status_code == 200
    verif_notifs = res_verif.json()
    verif_titles = [n["title"] for n in verif_notifs]
    assert "Verifier Review Needed" in verif_titles
    assert "WRO Deficiency Notice: FDR-PNB-883921" not in verif_titles


def test_update_notification_read_unread(client, setup_reports_notif_db):
    _, TestingSession = setup_reports_notif_db
    db = TestingSession()
    inst_user = db.query(User).filter_by(username="officer_deshmukh").first()
    token = token_for(inst_user)

    # Fetch notifications to find one for inst_user
    res = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {token}"})
    notifs = res.json()
    target_notif = notifs[0]
    notif_id = target_notif["id"]

    # Mark as read
    patch_res = client.patch(
        f"/api/v1/notifications/{notif_id}",
        json={"is_read": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_read"] is True

    # Mark as unread
    patch_res_unread = client.patch(
        f"/api/v1/notifications/{notif_id}",
        json={"is_read": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_res_unread.status_code == 200
    assert patch_res_unread.json()["is_read"] is False


def test_update_notification_ownership_enforcement(client, setup_reports_notif_db):
    _, TestingSession = setup_reports_notif_db
    db = TestingSession()
    other_user = db.query(User).filter_by(username="officer_venkatesh").first()
    other_token = token_for(other_user)

    # Get notification belonging to officer_deshmukh
    deshmukh_notif = db.query(Notification).filter_by(title="WRO Deficiency Notice: FDR-PNB-883921").first()

    # Officer from another institution attempts to modify it -> 403 Forbidden
    patch_res = client.patch(
        f"/api/v1/notifications/{deshmukh_notif.id}",
        json={"is_read": True},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert patch_res.status_code == 403
    assert "Cannot modify notification" in patch_res.json()["detail"]

    # Non-existent notification ID -> 404 Not Found
    res_404 = client.patch(
        "/api/v1/notifications/999999",
        json={"is_read": True},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_404.status_code == 404
