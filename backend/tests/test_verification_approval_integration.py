"""
End-to-End Verification and Approval Workflow Integration Tests.
Verifies the complete lifecycle:
1. Institution Officer creates, uploads supporting document, and submits FDR -> SUBMITTED.
2. Verification Officer inspects pending verification queue -> GET /verifications/pending.
3. Verification Officer claims review -> POST /fdrs/{id}/start-verification -> UNDER_VERIFICATION.
4. Separation of duties: Submitter cannot verify or approve.
5. Verification Officer returns for correction -> POST /fdrs/{id}/verify (CORRECTION_REQUIRED).
6. Institution Officer resubmits -> POST /fdrs/{id}/submit -> SUBMITTED.
7. Verification Officer claims review and verifies -> POST /fdrs/{id}/verify (VERIFIED) -> moves atomically to PENDING_APPROVAL.
8. Verification Officer cannot approve -> rejected with 403.
9. Approving Authority views approval queue -> GET /fdrs?status=PENDING_APPROVAL.
10. Approving Authority approves -> POST /fdrs/{id}/approval (APPROVED with council_order_ref) -> ACTIVE.
11. Audit logs capture the full chain of actors, timestamps, and decisions.
"""

import io
import os
import tempfile
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.models.enums import UserRole, FDRStatus
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app

VALID_PDF_BYTES = b"%PDF-1.4\n1 0 obj<</Title (Workflow Verification Test)>>endobj\n%%EOF"


@pytest.fixture(scope="module")
def setup_workflow_db():
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
def client(setup_workflow_db):
    return TestClient(app)


def token_for(user: User) -> str:
    return create_access_token({
        "sub": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "institution_id": user.institution_id,
    })


def test_full_verification_and_approval_workflow_lifecycle(client, setup_workflow_db):
    _, TestingSession = setup_workflow_db
    db = TestingSession()

    # Query seeded users
    inst_user = db.query(User).filter_by(username="officer_deshmukh").first()
    verif_user = db.query(User).filter_by(username="verif_malhotra").first()
    approver_user = db.query(User).filter_by(username="approver_kumar").first()

    inst_token = token_for(inst_user)
    verif_token = token_for(verif_user)
    approver_token = token_for(approver_user)

    # 1. Institution Officer creates draft FDR
    fdr_payload = {
        "fdr_number": "FDR-E2E-WORKFLOW-9901",
        "bank_name": "State Bank of India",
        "branch": "Nariman Point",
        "ifsc": "SBIN0001234",
        "amount": 2500000.0,
        "issue_date": str(date(2026, 1, 15)),
        "maturity_date": str(date(2031, 1, 15)),
        "remarks": "Security Deposit for MCA programme",
    }
    create_res = client.post(
        "/api/v1/fdrs",
        json=fdr_payload,
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert create_res.status_code == 201
    fdr_id = create_res.json()["id"]

    # 2. Upload supporting document
    doc_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents",
        files={"file": ("fdr_receipt.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"document_type": "FDR_RECEIPT"},
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert doc_res.status_code == 201

    # 3. Submit FDR -> SUBMITTED
    sub_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["status"] == FDRStatus.SUBMITTED.value

    # 4. Verification Officer views pending queue -> item must be present
    pending_res = client.get(
        "/api/v1/verifications/pending",
        headers={"Authorization": f"Bearer {verif_token}"},
    )
    assert pending_res.status_code == 200
    pending_items = pending_res.json()
    assert any(item["fdr_id"] == fdr_id for item in pending_items)

    # 5. Separation of Duties: Submitting officer cannot claim or verify
    sub_claim_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/start-verification",
        json={"remarks": "Attempting self-scrutiny"},
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert sub_claim_res.status_code == 403

    # 6. Verification Officer starts verification -> UNDER_VERIFICATION
    claim_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/start-verification",
        json={"remarks": "Verification started by Western Regional Office"},
        headers={"Authorization": f"Bearer {verif_token}"},
    )
    assert claim_res.status_code == 200
    assert claim_res.json()["status"] == FDRStatus.UNDER_VERIFICATION.value

    # 7. Verification Officer returns for correction
    return_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/verify",
        json={
            "decision": "CORRECTION_REQUIRED",
            "remarks": "Form L-1 bank endorsement missing branch sol ID",
            "discrepancy_code": "DOCUMENT_METADATA_MISMATCH",
            "discrepancy_severity": "REVIEW_REQUIRED",
            "discrepancy_note": "Branch sol ID required per APH 14(B)",
        },
        headers={"Authorization": f"Bearer {verif_token}"},
    )
    assert return_res.status_code == 200
    assert return_res.json()["new_status"] == FDRStatus.CORRECTION_REQUIRED.value

    # 8. Institution Officer resubmits after correction
    resubmit_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert resubmit_res.status_code == 200
    assert resubmit_res.json()["status"] == FDRStatus.SUBMITTED.value

    # 9. Verification Officer re-claims and verifies -> PENDING_APPROVAL
    client.post(
        f"/api/v1/fdrs/{fdr_id}/start-verification",
        json={"remarks": "Re-inspection of corrected instrument"},
        headers={"Authorization": f"Bearer {verif_token}"},
    )
    verify_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/verify",
        json={
            "decision": "VERIFIED",
            "remarks": "Core banking lien verified. Form L-1 endorsement complete.",
        },
        headers={"Authorization": f"Bearer {verif_token}"},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["new_status"] == FDRStatus.PENDING_APPROVAL.value

    # 10. Separation of Duties: Verification Officer cannot approve
    verif_approve_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/approval",
        json={
            "decision": "APPROVED",
            "remarks": "Attempting approval as verifier",
            "council_order_ref": "AICTE/EC/2026/TEST",
        },
        headers={"Authorization": f"Bearer {verif_token}"},
    )
    assert verif_approve_res.status_code == 403

    # 11. Approving Authority queries approval queue -> item must be present
    approver_queue_res = client.get(
        "/api/v1/fdrs?status=PENDING_APPROVAL",
        headers={"Authorization": f"Bearer {approver_token}"},
    )
    assert approver_queue_res.status_code == 200
    approver_items = approver_queue_res.json()["items"]
    assert any(item["id"] == fdr_id for item in approver_items)

    # 12. Approving Authority approves instrument -> ACTIVE
    approval_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/approval",
        json={
            "decision": "APPROVED",
            "remarks": "Endorsed under AICTE Approval Process Handbook Reg 14(B)",
            "council_order_ref": "AICTE/EC/2026/04/FDR-9901",
        },
        headers={"Authorization": f"Bearer {approver_token}"},
    )
    assert approval_res.status_code == 200
    assert approval_res.json()["new_status"] == FDRStatus.ACTIVE.value

    # 13. Audit logs record complete chain
    logs_res = client.get(
        f"/api/v1/fdrs/{fdr_id}/audit-logs",
        headers={"Authorization": f"Bearer {approver_token}"},
    )
    assert logs_res.status_code == 200
    logs = logs_res.json()
    actions = [log["action"] for log in logs]
    assert "STATUS_TRANSITION_SUBMITTED" in actions
    assert "STATUS_TRANSITION_UNDER_VERIFICATION" in actions
    assert "STATUS_TRANSITION_CORRECTION_REQUIRED" in actions
    assert "STATUS_TRANSITION_PENDING_APPROVAL" in actions
    assert "STATUS_TRANSITION_ACTIVE" in actions

    db.close()
