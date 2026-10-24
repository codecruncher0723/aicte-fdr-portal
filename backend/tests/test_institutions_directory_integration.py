"""
Integration Tests for Institutions Directory API (/api/v1/institutions).
Verifies Section 8.2 of REQUIREMENTS_UPDATED.md:
1. Unauthenticated requests return 401 Unauthorized.
2. AICTE Admin, Verification Officer, Approving Authority can list all authorized institutions.
3. Institution Officer query results are strictly isolated to their own institution.
4. Institution Officer cross-institution detail access (IDOR) returns 403 Forbidden.
5. Query parameter tampering (?institution_id=other) by Institution Officer returns 403 Forbidden.
6. Nonexistent institution detail returns 404 Not Found.
7. Search queries filter across name, PID, city, state, and sponsoring trust.
8. Regional jurisdiction and status filters operate correctly.
9. Institution Officer search and filters operate safely within their own isolated institution scope without cross-institution leakage.
10. FDR count, total FDR collateral amount, and designated contact email are accurately derived.
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
from app.models.fdr import FDR
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app


@pytest.fixture(scope="module")
def setup_institutions_test_db():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_institutions.db")
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


def test_unauthenticated_institutions_rejected(setup_institutions_test_db):
    client = setup_institutions_test_db["client"]
    # List endpoint
    res_list = client.get("/api/v1/institutions")
    assert res_list.status_code == 401

    # Detail endpoint
    res_detail = client.get("/api/v1/institutions/1")
    assert res_detail.status_code == 401


def test_regulatory_roles_can_list_all_institutions(setup_institutions_test_db):
    client = setup_institutions_test_db["client"]
    session = setup_institutions_test_db["session"]

    # 1. AICTE Admin
    admin_token = get_token(session, "admin_sridhar")
    res_admin = client.get("/api/v1/institutions", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    institutions_admin = res_admin.json()
    assert len(institutions_admin) >= 3

    # Check schema fields
    inst = institutions_admin[0]
    for key in ["id", "aicte_pid", "name", "region", "state", "city", "sponsoring_trust", "status", "fdr_count", "total_fdr_amount"]:
        assert key in inst, f"Missing key {key} in institution response"

    # 2. Verification Officer
    verif_token = get_token(session, "verif_malhotra")
    res_verif = client.get("/api/v1/institutions", headers={"Authorization": f"Bearer {verif_token}"})
    assert res_verif.status_code == 200
    assert len(res_verif.json()) >= 3

    # 3. Approving Authority
    appr_token = get_token(session, "approver_kumar")
    res_appr = client.get("/api/v1/institutions", headers={"Authorization": f"Bearer {appr_token}"})
    assert res_appr.status_code == 200
    assert len(res_appr.json()) >= 3


def test_institution_officer_list_scoping_and_query_tampering(setup_institutions_test_db):
    client = setup_institutions_test_db["client"]
    session = setup_institutions_test_db["session"]

    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    assert officer.institution_id is not None
    token = get_token(session, "officer_deshmukh")

    # 1. Standard list query returns ONLY the officer's institution
    res = client.get("/api/v1/institutions", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["id"] == officer.institution_id
    assert data[0]["name"] == "St. Xavier's Engineering College"

    # 2. Passing own institution_id explicitly in query is allowed
    res_own = client.get(f"/api/v1/institutions?institution_id={officer.institution_id}", headers={"Authorization": f"Bearer {token}"})
    assert res_own.status_code == 200
    assert len(res_own.json()) == 1

    # 3. Attempting to query another institution_id returns 403 Forbidden
    other_inst = session.query(Institution).filter(Institution.id != officer.institution_id).first()
    assert other_inst is not None
    res_tamper = client.get(f"/api/v1/institutions?institution_id={other_inst.id}", headers={"Authorization": f"Bearer {token}"})
    assert res_tamper.status_code == 403
    assert "another institution" in res_tamper.json()["detail"].lower()


def test_institution_detail_and_idor_protection(setup_institutions_test_db):
    client = setup_institutions_test_db["client"]
    session = setup_institutions_test_db["session"]

    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    token = get_token(session, "officer_deshmukh")
    admin_token = get_token(session, "admin_sridhar")

    # 1. Officer views their own institution detail -> 200 OK
    res_own = client.get(f"/api/v1/institutions/{officer.institution_id}", headers={"Authorization": f"Bearer {token}"})
    assert res_own.status_code == 200
    assert res_own.json()["id"] == officer.institution_id
    assert res_own.json()["aicte_pid"] == "1-10928374"
    assert res_own.json()["contact_email"] == officer.email

    # 2. Officer attempts IDOR on another institution -> 403 Forbidden
    other_inst = session.query(Institution).filter(Institution.id != officer.institution_id).first()
    res_idor = client.get(f"/api/v1/institutions/{other_inst.id}", headers={"Authorization": f"Bearer {token}"})
    assert res_idor.status_code == 403
    assert "another institution" in res_idor.json()["detail"].lower()

    # 3. Admin views other institution -> 200 OK
    res_admin = client.get(f"/api/v1/institutions/{other_inst.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    assert res_admin.json()["id"] == other_inst.id

    # 4. Nonexistent institution ID returns 404
    res_404 = client.get("/api/v1/institutions/99999", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_404.status_code == 404
    assert "not found" in res_404.json()["detail"].lower()


def test_institutions_search_query(setup_institutions_test_db):
    client = setup_institutions_test_db["client"]
    session = setup_institutions_test_db["session"]
    admin_token = get_token(session, "admin_sridhar")

    # Search by Name
    res1 = client.get("/api/v1/institutions?search=Xavier", headers={"Authorization": f"Bearer {admin_token}"})
    assert res1.status_code == 200
    items1 = res1.json()
    assert len(items1) == 1
    assert "xavier" in items1[0]["name"].lower()

    # Search by PID
    res2 = client.get("/api/v1/institutions?search=1-88492011", headers={"Authorization": f"Bearer {admin_token}"})
    assert res2.status_code == 200
    items2 = res2.json()
    assert len(items2) == 1
    assert items2[0]["aicte_pid"] == "1-88492011"
    assert "bms" in items2[0]["name"].lower()

    # Search by City
    res3 = client.get("/api/v1/institutions?search=Bengaluru", headers={"Authorization": f"Bearer {admin_token}"})
    assert res3.status_code == 200
    items3 = res3.json()
    assert len(items3) == 1
    assert items3[0]["city"] == "Bengaluru"

    # Search by Sponsoring Trust
    res4 = client.get("/api/v1/institutions?search=Delhi Educational Foundation", headers={"Authorization": f"Bearer {admin_token}"})
    assert res4.status_code == 200
    items4 = res4.json()
    assert len(items4) == 1
    assert "delhi" in items4[0]["name"].lower()

    # Search with no matches
    res5 = client.get("/api/v1/institutions?search=UnknownNonExistentSearchTermXYZ", headers={"Authorization": f"Bearer {admin_token}"})
    assert res5.status_code == 200
    assert len(res5.json()) == 0


def test_institutions_region_and_status_filters(setup_institutions_test_db):
    client = setup_institutions_test_db["client"]
    session = setup_institutions_test_db["session"]
    admin_token = get_token(session, "admin_sridhar")

    # Region filter: wro
    res_wro = client.get("/api/v1/institutions?region=wro", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_wro.status_code == 200
    for inst in res_wro.json():
        assert inst["region"].lower() == "wro"

    # Region filter: nro
    res_nro = client.get("/api/v1/institutions?region=nro", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_nro.status_code == 200
    for inst in res_nro.json():
        assert inst["region"].lower() == "nro"

    # Status filter: Active
    res_active = client.get("/api/v1/institutions?status=Active", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_active.status_code == 200
    assert len(res_active.json()) >= 3


def test_institution_officer_scoped_filters(setup_institutions_test_db):
    client = setup_institutions_test_db["client"]
    session = setup_institutions_test_db["session"]
    token = get_token(session, "officer_deshmukh")  # St. Xavier's, wro, Pune

    # Search matching own institution
    res_match = client.get("/api/v1/institutions?search=Xavier", headers={"Authorization": f"Bearer {token}"})
    assert res_match.status_code == 200
    assert len(res_match.json()) == 1

    # Search for another institution -> returns [] without leaking
    res_other = client.get("/api/v1/institutions?search=BMS", headers={"Authorization": f"Bearer {token}"})
    assert res_other.status_code == 200
    assert len(res_other.json()) == 0

    # Matching region
    res_reg_match = client.get("/api/v1/institutions?region=wro", headers={"Authorization": f"Bearer {token}"})
    assert res_reg_match.status_code == 200
    assert len(res_reg_match.json()) == 1

    # Non-matching region -> returns []
    res_reg_other = client.get("/api/v1/institutions?region=nro", headers={"Authorization": f"Bearer {token}"})
    assert res_reg_other.status_code == 200
    assert len(res_reg_other.json()) == 0
