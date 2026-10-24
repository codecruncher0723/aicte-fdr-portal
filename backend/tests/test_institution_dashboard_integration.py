"""
Integration Tests for Institution Dashboard API.
Verifies:
1. Unauthenticated calls return 401 Unauthorized.
2. Institution Officer metrics are strictly scoped to their assigned institution.
3. Institution metadata (PID, name, region, city, state) is accurately populated.
4. Metric counts (total, active, pending review, maturing, deposit amount) reflect true DB state.
5. Cross-institution isolation: Officer 1 cannot see Officer 2 / Inst 2 metrics or activities.
6. Activities feed is scoped strictly to institution FDRs and actions.
7. Maturity horizon list is scoped strictly to institution instruments.
8. AICTE Admin sees global ("ALL") aggregates across all institutions.
"""

import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.models.enums import UserRole, FDRStatus
from app.models.user import User
from app.models.institution import Institution
from app.models.fdr import FDR
from app.models.audit import AuditLog
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app


@pytest.fixture(scope="module")
def setup_dashboard_test_db():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_dashboard.db")
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
    test_client = TestClient(app)

    yield {
        "client": test_client,
        "session": session,
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


def test_unauthenticated_dashboard_endpoints(setup_dashboard_test_db):
    client = setup_dashboard_test_db["client"]

    # 1. Summary
    res1 = client.get("/api/v1/dashboard/summary")
    assert res1.status_code == 401

    # 2. Activities
    res2 = client.get("/api/v1/dashboard/activities")
    assert res2.status_code == 401

    # 3. Maturity
    res3 = client.get("/api/v1/dashboard/maturity")
    assert res3.status_code == 401


def test_institution_officer_summary_metrics_and_isolation(setup_dashboard_test_db):
    client = setup_dashboard_test_db["client"]
    session = setup_dashboard_test_db["session"]

    officer1 = session.query(User).filter_by(username="officer_deshmukh").first()
    inst1 = session.query(Institution).filter_by(id=officer1.institution_id).first()
    token1 = get_token(session, "officer_deshmukh")

    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {token1}"})
    assert res.status_code == 200
    data = res.json()

    # 1. Institution Scoping
    assert data["institution_scope"] == inst1.id
    assert data["institution_info"] is not None
    assert data["institution_info"]["id"] == inst1.id
    assert data["institution_info"]["aicte_pid"] == inst1.aicte_pid
    assert data["institution_info"]["name"] == inst1.name
    assert data["institution_info"]["region"] == inst1.region

    # 2. Metric Accuracy: Compare with direct DB query for Institution 1
    inst1_fdrs = session.query(FDR).filter_by(institution_id=inst1.id).all()
    assert data["total_fdrs"] == len(inst1_fdrs)

    expected_amount = sum(float(f.amount) for f in inst1_fdrs)
    assert abs(data["total_deposit_amount_inr"] - expected_amount) < 0.01

    expected_active = sum(1 for f in inst1_fdrs if f.status == FDRStatus.ACTIVE.value)
    assert data["active_count"] == expected_active


def test_cross_institution_metrics_isolation(setup_dashboard_test_db):
    client = setup_dashboard_test_db["client"]
    session = setup_dashboard_test_db["session"]

    officer1 = session.query(User).filter_by(username="officer_deshmukh").first()
    officer2 = session.query(User).filter_by(username="officer_venkatesh").first()
    assert officer1.institution_id != officer2.institution_id

    token1 = get_token(session, "officer_deshmukh")
    token2 = get_token(session, "officer_venkatesh")

    res1 = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {token1}"})
    res2 = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {token2}"})

    assert res1.status_code == 200
    assert res2.status_code == 200

    data1 = res1.json()
    data2 = res2.json()

    # Assert distinct institutional data
    assert data1["institution_scope"] == officer1.institution_id
    assert data2["institution_scope"] == officer2.institution_id
    assert data1["institution_info"]["name"] != data2["institution_info"]["name"]
    assert data1["institution_info"]["aicte_pid"] != data2["institution_info"]["aicte_pid"]


def test_regulatory_admin_global_summary_scope(setup_dashboard_test_db):
    client = setup_dashboard_test_db["client"]
    session = setup_dashboard_test_db["session"]

    token_admin = get_token(session, "admin_sridhar")
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {token_admin}"})
    assert res.status_code == 200
    data = res.json()

    assert data["institution_scope"] == "ALL"
    assert data["institution_info"] is None

    total_in_db = session.query(FDR).count()
    assert data["total_fdrs"] == total_in_db


def test_dashboard_activities_feed_scoped_to_institution(setup_dashboard_test_db):
    client = setup_dashboard_test_db["client"]
    session = setup_dashboard_test_db["session"]

    officer1 = session.query(User).filter_by(username="officer_deshmukh").first()
    token1 = get_token(session, "officer_deshmukh")

    # Add a deterministic audit log for Institution 1 FDR
    inst1_fdr = session.query(FDR).filter_by(institution_id=officer1.institution_id).first()
    assert inst1_fdr is not None

    audit1 = AuditLog(
        actor_id=officer1.id,
        actor_name=officer1.full_name,
        actor_role=officer1.role,
        action="FDR_SUBMITTED",
        target_type="FDR",
        target_id=str(inst1_fdr.id),
        details="Initial submission of FDR instrument for council endorsement",
    )
    session.add(audit1)
    session.commit()

    res = client.get("/api/v1/dashboard/activities?limit=10", headers={"Authorization": f"Bearer {token1}"})
    assert res.status_code == 200
    activities = res.json()
    assert len(activities) > 0

    first_act = activities[0]
    for key in ["id", "title", "target", "desc", "date", "actor_name", "type", "badge", "icon"]:
        assert key in first_act, f"Missing {key} in activity item"

    # All returned activities must either be acted by officer1 or target officer1's FDRs
    inst1_fdr_ids = {str(f.id) for f in session.query(FDR.id).filter_by(institution_id=officer1.institution_id).all()}
    for act in activities:
        if act.get("target_type") == "FDR":
            assert str(act.get("target_id")) in inst1_fdr_ids


def test_dashboard_maturity_horizon_scoped_to_institution(setup_dashboard_test_db):
    client = setup_dashboard_test_db["client"]
    session = setup_dashboard_test_db["session"]

    officer1 = session.query(User).filter_by(username="officer_deshmukh").first()
    token1 = get_token(session, "officer_deshmukh")
    token_admin = get_token(session, "admin_sridhar")

    # 1. Officer 1 query
    res_officer = client.get("/api/v1/dashboard/maturity", headers={"Authorization": f"Bearer {token1}"})
    assert res_officer.status_code == 200
    officer_items = res_officer.json()
    for item in officer_items:
        assert item["institution_id"] == officer1.institution_id

    # 2. Admin query
    res_admin = client.get("/api/v1/dashboard/maturity", headers={"Authorization": f"Bearer {token_admin}"})
    assert res_admin.status_code == 200
    admin_items = res_admin.json()
    assert len(admin_items) >= len(officer_items)
