"""
Integration Tests for FDR Renewal Requests and Workflow Operations.
Covers:
1. POST /api/v1/fdrs/{fdr_id}/renewals:
   - Creation by authorized Institution Officer.
   - Discrepancy detection: RENEWAL_DETAILS_DIFFER_FROM_CURRENT_RECORD flag.
   - Date validation: Proposed maturity must be valid and exceed current maturity.
   - Role boundaries: Verifiers/Approvers rejected (403).
   - Institution isolation: Cross-institution renewal creation rejected (403).
2. GET /api/v1/requests:
   - Institution scoping: Institution officers see only their own institution's requests.
   - Cross-institution query rejected (403).
   - Admin oversight.
3. Full Renewal Status Lifecycle:
   - REQUESTED -> start-verification -> UNDER_VERIFICATION
   - UNDER_VERIFICATION -> verify -> PENDING_APPROVAL
   - PENDING_APPROVAL -> approve -> APPROVED
   - Invariant check: Underlying FDR remains un-modified while APPROVED.
   - APPROVED -> complete -> COMPLETED
   - Underlying FDR updated transactionally to ACTIVE with new maturity date.
   - Historical snapshot preserved in FDRRenewalHistory.
   - Separation of duties enforced throughout.
"""

import os
import tempfile
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.models.enums import UserRole, FDRStatus, RenewalStatus, DiscrepancyCode
from app.models.user import User
from app.models.fdr import FDR, FDRRenewalHistory
from app.models.workflow import WorkflowRequest
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app


@pytest.fixture(scope="module")
def setup_renewals_test_db():
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
def client(setup_renewals_test_db):
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
# 1. Renewal Request Creation & Validation
# -------------------------------------------------------------

def test_create_renewal_request_success(client, setup_renewals_test_db):
    _, TestingSession = setup_renewals_test_db
    db = TestingSession()
    inst_user = db.query(User).filter_by(username="officer_deshmukh").first()
    fdr = db.query(FDR).filter_by(institution_id=inst_user.institution_id).first()
    token = token_for(inst_user)

    future_maturity = fdr.maturity_date + timedelta(days=365 * 3)
    payload = {
        "reason": "Approaching maturity horizon; requesting 3-year term rollover.",
        "proposed_maturity_date": str(future_maturity),
        "proposed_fdr_number": f"{fdr.fdr_number}-RNW",
        "proposed_interest_rate": "7.50%",
        "applicant_notes": "Mandate Form L-1 renewed by governing body.",
    }

    res = client.post(
        f"/api/v1/fdrs/{fdr.id}/renewals",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "REQUESTED"
    assert data["request_type"] == "RENEWAL"
    assert data["fdr_id"] == fdr.id
    assert DiscrepancyCode.RENEWAL_DETAILS_DIFFER_FROM_CURRENT_RECORD.value in data["discrepancy_flags"]


def test_renewal_creation_authorization_and_isolation(client, setup_renewals_test_db):
    _, TestingSession = setup_renewals_test_db
    db = TestingSession()
    inst_user = db.query(User).filter_by(username="officer_deshmukh").first()
    other_user = db.query(User).filter_by(username="officer_venkatesh").first()
    verif_user = db.query(User).filter_by(username="verif_malhotra").first()

    fdr = db.query(FDR).filter_by(institution_id=inst_user.institution_id).first()
    other_token = token_for(other_user)
    verif_token = token_for(verif_user)

    payload = {
        "reason": "Test renewal",
        "proposed_maturity_date": "2032-01-01",
    }

    # 1. Verification officer cannot create renewals (403)
    res_verif = client.post(
        f"/api/v1/fdrs/{fdr.id}/renewals",
        json=payload,
        headers={"Authorization": f"Bearer {verif_token}"},
    )
    assert res_verif.status_code == 403

    # 2. Officer from another institution cannot create renewal for this FDR (403)
    res_cross = client.post(
        f"/api/v1/fdrs/{fdr.id}/renewals",
        json=payload,
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_cross.status_code == 403


def test_renewal_creation_date_validation(client, setup_renewals_test_db):
    _, TestingSession = setup_renewals_test_db
    db = TestingSession()
    inst_user = db.query(User).filter_by(username="officer_deshmukh").first()
    fdr = db.query(FDR).filter_by(institution_id=inst_user.institution_id).first()
    token = token_for(inst_user)

    # 1. Proposed maturity before or equal to current maturity date -> 400 Bad Request
    past_payload = {
        "reason": "Invalid early maturity",
        "proposed_maturity_date": str(fdr.maturity_date),
    }
    res_past = client.post(
        f"/api/v1/fdrs/{fdr.id}/renewals",
        json=past_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_past.status_code == 400
    assert "must extend beyond the current maturity date" in res_past.json()["detail"]


# -------------------------------------------------------------
# 2. Workflow Requests Listing & Scoping
# -------------------------------------------------------------

def test_list_workflow_requests_scoping(client, setup_renewals_test_db):
    _, TestingSession = setup_renewals_test_db
    db = TestingSession()
    inst_user = db.query(User).filter_by(username="officer_deshmukh").first()
    other_user = db.query(User).filter_by(username="officer_venkatesh").first()
    admin_user = db.query(User).filter_by(username="admin_sridhar").first()

    inst_token = token_for(inst_user)
    other_token = token_for(other_user)
    admin_token = token_for(admin_user)

    # 1. Institution officer only sees own institution's requests
    res_inst = client.get("/api/v1/requests", headers={"Authorization": f"Bearer {inst_token}"})
    assert res_inst.status_code == 200
    for r in res_inst.json():
        assert r["institution_id"] == inst_user.institution_id

    # 2. Institution officer trying to filter by other institution -> 403 Forbidden
    res_cross = client.get(
        f"/api/v1/requests?institution_id={other_user.institution_id}",
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert res_cross.status_code == 403

    # 3. Admin can list across institutions
    res_admin = client.get("/api/v1/requests", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200


# -------------------------------------------------------------
# 3. Full End-to-End Renewal Lifecycle & Completion
# -------------------------------------------------------------

def test_renewal_full_lifecycle_and_completion(client, setup_renewals_test_db):
    _, TestingSession = setup_renewals_test_db
    db = TestingSession()

    inst_user = db.query(User).filter_by(username="officer_deshmukh").first()
    verif_user = db.query(User).filter_by(username="verif_malhotra").first()
    approver_user = db.query(User).filter_by(username="approver_kumar").first()

    inst_token = token_for(inst_user)
    verif_token = token_for(verif_user)
    approver_token = token_for(approver_user)

    # Target FDR
    fdr = db.query(FDR).filter_by(institution_id=inst_user.institution_id).first()
    initial_fdr_number = fdr.fdr_number
    initial_maturity_date = fdr.maturity_date
    new_fdr_number = f"FDR-RNW-{fdr.id}-2029"
    new_maturity_date = date(2029, 6, 30)

    # 1. Institution Officer initiates renewal -> REQUESTED
    init_res = client.post(
        f"/api/v1/fdrs/{fdr.id}/renewals",
        json={
            "reason": "Scheduled 3-year term rollover",
            "proposed_maturity_date": str(new_maturity_date),
            "proposed_fdr_number": new_fdr_number,
            "proposed_interest_rate": "7.35%",
        },
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert init_res.status_code == 201
    req_id = init_res.json()["request_id"]
    assert init_res.json()["status"] == RenewalStatus.REQUESTED.value

    # 2. Separation of duties check: Submitter cannot claim or verify
    sub_verify = client.post(
        f"/api/v1/requests/{req_id}/verify",
        json={"decision": "VERIFIED"},
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert sub_verify.status_code == 403

    # 3. Verification Officer claims review -> UNDER_VERIFICATION
    claim_res = client.post(
        f"/api/v1/requests/{req_id}/start-verification",
        headers={"Authorization": f"Bearer {verif_token}"},
    )
    assert claim_res.status_code == 200
    assert claim_res.json()["status"] == RenewalStatus.UNDER_VERIFICATION.value

    # 4. Verification Officer verifies -> moves to PENDING_APPROVAL
    verify_res = client.post(
        f"/api/v1/requests/{req_id}/verify",
        json={
            "decision": "VERIFIED",
            "remarks": "Bank confirmation advice and tripartite addendum checked.",
        },
        headers={"Authorization": f"Bearer {verif_token}"},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["new_status"] == RenewalStatus.PENDING_APPROVAL.value

    # 5. Verification Officer cannot approve (403)
    verif_appr = client.post(
        f"/api/v1/requests/{req_id}/approval",
        json={"decision": "APPROVED", "remarks": "Unauthorized approval attempt"},
        headers={"Authorization": f"Bearer {verif_token}"},
    )
    assert verif_appr.status_code == 403

    # 6. Approving Authority approves -> moves to APPROVED
    appr_res = client.post(
        f"/api/v1/requests/{req_id}/approval",
        json={
            "decision": "APPROVED",
            "council_order_ref": "AICTE/WRO/RNW/2026/089",
            "remarks": "Renewal approved per Council executive sanction.",
        },
        headers={"Authorization": f"Bearer {approver_token}"},
    )
    assert appr_res.status_code == 200
    assert appr_res.json()["new_status"] == RenewalStatus.APPROVED.value

    # INVARIANT CHECK: Underlying FDR remains UNCHANGED while request is APPROVED
    db.expire_all()
    fdr_check = db.query(FDR).filter_by(id=fdr.id).first()
    assert fdr_check.fdr_number == initial_fdr_number
    assert fdr_check.maturity_date == initial_maturity_date

    # 7. Approver or Verifier cannot complete renewal (403)
    appr_comp = client.post(
        f"/api/v1/requests/{req_id}/complete",
        json={
            "renewed_fdr_number": new_fdr_number,
            "renewed_maturity_date": str(new_maturity_date),
        },
        headers={"Authorization": f"Bearer {approver_token}"},
    )
    assert appr_comp.status_code == 403

    # 8. Institution Officer completes renewal -> COMPLETED
    complete_res = client.post(
        f"/api/v1/requests/{req_id}/complete",
        json={
            "renewed_fdr_number": new_fdr_number,
            "renewed_maturity_date": str(new_maturity_date),
            "renewed_interest_rate": "7.35%",
            "remarks": "Renewal formalized with State Bank of India.",
        },
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["request_status"] == RenewalStatus.COMPLETED.value
    assert complete_res.json()["fdr_status"] == FDRStatus.ACTIVE.value
    assert complete_res.json()["renewed_fdr_number"] == new_fdr_number
    assert complete_res.json()["renewed_maturity_date"] == str(new_maturity_date)

    # 9. Verify underlying FDR updated transactionally in DB
    db.expire_all()
    updated_fdr = db.query(FDR).filter_by(id=fdr.id).first()
    assert updated_fdr.fdr_number == new_fdr_number
    assert updated_fdr.maturity_date == new_maturity_date
    assert updated_fdr.status == FDRStatus.ACTIVE.value

    # 10. Verify prior values retained in FDRRenewalHistory
    history = db.query(FDRRenewalHistory).filter_by(request_id=req_id).first()
    assert history is not None
    assert history.previous_fdr_number == initial_fdr_number
    assert history.previous_maturity_date == initial_maturity_date
    assert history.renewed_fdr_number == new_fdr_number
    assert history.renewed_maturity_date == new_maturity_date
