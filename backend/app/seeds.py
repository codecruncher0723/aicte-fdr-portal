"""
Deterministic and Idempotent Seed Data for AICTE FDR Portal.

Creates synthetic demo records for:
- All 4 roles: AICTE_ADMIN, INSTITUTION_OFFICER, VERIFICATION_OFFICER, APPROVING_AUTHORITY
- Multiple isolated institutions: St. Xavier's Engineering College (WRO), BMS College of Architecture (SWRO), Delhi Technical Campus (NRO)
- Realistic FDR records across statuses, banks, and tenures
- Initial document versions, workflow requests, audit logs, and notifications

Safe to run repeatedly: queries by natural keys and never duplicates records.
Uses synthetic credentials and salted PBKDF2 password hashes (no plaintext passwords).
"""

from datetime import date, datetime, timezone
import hashlib
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.enums import (
    UserRole,
    FDRStatus,
    RequestType,
    RenewalStatus,
    ReleaseStatus,
    ProvenanceSource,
)
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR, FieldProvenance
from app.models.document import DocumentVersion
from app.models.workflow import WorkflowRequest, VerificationRecord
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.security import hash_password

# Deterministic synthetic PDF bytes for demo documents
SAMPLE_PDF_HEADER = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<</Title (Deterministic Demo Document)>>endobj\n%%EOF"


def seed_database(session: Session, storage_root: Optional[str] = None) -> Dict[str, int]:
    """
    Populates database with deterministic demo data.
    Idempotent: running multiple times preserves existing records without duplicates.
    """
    counts = {
        "institutions": 0,
        "users": 0,
        "fdrs": 0,
        "documents": 0,
        "requests": 0,
        "notifications": 0,
        "audit_logs": 0,
        "provenance": 0,
    }

    # -------------------------------------------------------------------------
    # 1. Institutions
    # -------------------------------------------------------------------------
    institutions_data = [
        {
            "aicte_pid": "1-10928374",
            "name": "St. Xavier's Engineering College",
            "region": "wro",
            "state": "Maharashtra",
            "city": "Pune",
            "sponsoring_trust": "St. Xavier's Technical Education Society",
            "status": "Active",
        },
        {
            "aicte_pid": "1-88492011",
            "name": "BMS College of Architecture",
            "region": "swro",
            "state": "Karnataka",
            "city": "Bengaluru",
            "sponsoring_trust": "BMS Educational Trust",
            "status": "Active",
        },
        {
            "aicte_pid": "1-44556677",
            "name": "Delhi Technical Campus",
            "region": "nro",
            "state": "Uttar Pradesh",
            "city": "Greater Noida",
            "sponsoring_trust": "Delhi Educational Foundation",
            "status": "Active",
        },
    ]

    inst_map: Dict[str, Institution] = {}
    for item in institutions_data:
        inst = session.query(Institution).filter_by(aicte_pid=item["aicte_pid"]).first()
        if not inst:
            inst = Institution(**item)
            session.add(inst)
            session.flush()
        else:
            for k, v in item.items():
                setattr(inst, k, v)
        inst_map[item["aicte_pid"]] = inst
    counts["institutions"] = session.query(Institution).count()

    # -------------------------------------------------------------------------
    # 2. Users (All 4 Canonical Roles)
    # -------------------------------------------------------------------------
    users_data = [
        # AICTE Admin (Central Regulatory Custody, HQ New Delhi)
        {
            "username": "admin_sridhar",
            "email": "rk.sridhar@aicte.gov.in",
            "full_name": "Dr. R. K. Sridhar",
            "role": UserRole.AICTE_ADMIN.value,
            "institution_id": None,
            "raw_password": "AdminDemo@2026",
        },
        # Institution Officer 1 (St. Xavier's Engineering College, Pune)
        {
            "username": "officer_deshmukh",
            "email": "anand.deshmukh@stxaviers.edu.in",
            "full_name": "Dr. Anand Deshmukh",
            "role": UserRole.INSTITUTION_OFFICER.value,
            "institution_id": inst_map["1-10928374"].id,
            "raw_password": "OfficerDemo@2026",
        },
        # Institution Officer 2 (BMS College of Architecture, Bengaluru)
        {
            "username": "officer_venkatesh",
            "email": "ks.venkatesh@bmsca.edu.in",
            "full_name": "Dr. K. S. Venkatesh",
            "role": UserRole.INSTITUTION_OFFICER.value,
            "institution_id": inst_map["1-88492011"].id,
            "raw_password": "OfficerDemo@2026",
        },
        # Verification Officer (AICTE Western Regional Office, Pune/Mumbai)
        {
            "username": "verif_malhotra",
            "email": "vk.malhotra@aicte.gov.in",
            "full_name": "Shri V. K. Malhotra",
            "role": UserRole.VERIFICATION_OFFICER.value,
            "institution_id": None,
            "raw_password": "VerifDemo@2026",
        },
        # Approving Authority (AICTE Statutory Executive Council, HQ New Delhi)
        {
            "username": "approver_kumar",
            "email": "rajive.kumar@aicte.gov.in",
            "full_name": "Prof. Rajive Kumar",
            "role": UserRole.APPROVING_AUTHORITY.value,
            "institution_id": None,
            "raw_password": "ApproverDemo@2026",
        },
    ]

    user_map: Dict[str, User] = {}
    for u_item in users_data:
        raw_pw = u_item.pop("raw_password")
        user = session.query(User).filter_by(username=u_item["username"]).first()
        if not user:
            user = User(
                hashed_password=hash_password(raw_pw),
                **u_item,
            )
            session.add(user)
            session.flush()
        else:
            for k, v in u_item.items():
                setattr(user, k, v)
        user_map[user.username] = user
    counts["users"] = session.query(User).count()

    # -------------------------------------------------------------------------
    # 3. FDRs (Across Institutions, Banks, Tenures, and Statuses)
    # -------------------------------------------------------------------------
    fdrs_data = [
        # Inst 1, FDR 1 (Correction Required - Mandate issue)
        {
            "institution_id": inst_map["1-10928374"].id,
            "fdr_number": "FDR-PNB-883921",
            "cert_number": "PNB-TR-2021/883",
            "tripartite_ref": "TPR-2021-098 / AICTE-WRO-1092",
            "bank_name": "Punjab National Bank",
            "branch": "FC Road Branch, Pune",
            "ifsc": "PUNB0012900",
            "amount": 10000000.00,
            "interest_rate": "7.40% p.a. Cum.",
            "issue_date": date(2021, 11, 18),
            "maturity_date": date(2026, 11, 18),
            "tenure_years": 5,
            "auto_rollover": True,
            "status": FDRStatus.CORRECTION_REQUIRED.value,
            "lien_status": "Statutory Lien Registered",
            "mandate_clause": "Exclusive Statutory Lien under Reg 14(B)",
            "notes": "Verified against PNB Finacle registry. Awaiting amended Form L-1 with explicit WRO descriptor.",
            "created_by_id": user_map["officer_deshmukh"].id,
        },
        # Inst 1, FDR 2 (Active, 50 Lakhs)
        {
            "institution_id": inst_map["1-10928374"].id,
            "fdr_number": "FDR-HDFC-109283",
            "cert_number": "HDFC-TD-2022/109",
            "tripartite_ref": "TPR-2022-045 / AICTE-WRO-0412",
            "bank_name": "HDFC Bank",
            "branch": "Shivajinagar, Pune",
            "ifsc": "HDFC0000109",
            "amount": 5000000.00,
            "interest_rate": "7.10% p.a.",
            "issue_date": date(2022, 5, 10),
            "maturity_date": date(2027, 5, 10),
            "tenure_years": 5,
            "auto_rollover": True,
            "status": FDRStatus.ACTIVE.value,
            "lien_status": "Statutory Lien Registered",
            "mandate_clause": "Standard Joint Mandate AICTE/St Xavier",
            "notes": "Endorsed by Council Executive Authority.",
            "created_by_id": user_map["officer_deshmukh"].id,
        },
        # Inst 1, FDR 3 (Maturing Soon, 25 Lakhs)
        {
            "institution_id": inst_map["1-10928374"].id,
            "fdr_number": "FDR-SBI-554433",
            "cert_number": "SBI-FD-2021/554",
            "tripartite_ref": "TPR-2021-310 / AICTE-WRO-2201",
            "bank_name": "State Bank of India",
            "branch": "Camp Branch, Pune",
            "ifsc": "SBIN0000455",
            "amount": 2500000.00,
            "interest_rate": "7.00% p.a.",
            "issue_date": date(2021, 8, 1),
            "maturity_date": date(2026, 8, 1),
            "tenure_years": 5,
            "auto_rollover": False,
            "status": FDRStatus.MATURING_SOON.value,
            "lien_status": "Statutory Lien Registered",
            "mandate_clause": "Standard Joint Mandate",
            "notes": "Reminder issued to institution for renewal.",
            "created_by_id": user_map["officer_deshmukh"].id,
        },
        # Inst 2, FDR 4 (Active, 75 Lakhs)
        {
            "institution_id": inst_map["1-88492011"].id,
            "fdr_number": "FDR-SBI-772910",
            "cert_number": "SBI-FD-2020/772",
            "tripartite_ref": "TPR-2020-112 / AICTE-SWRO-302",
            "bank_name": "State Bank of India",
            "branch": "Bull Temple Road, Bengaluru",
            "ifsc": "SBIN0040182",
            "amount": 7500000.00,
            "interest_rate": "6.90% p.a.",
            "issue_date": date(2020, 8, 15),
            "maturity_date": date(2025, 8, 15),
            "tenure_years": 5,
            "auto_rollover": False,
            "status": FDRStatus.ACTIVE.value,
            "lien_status": "Statutory Lien Registered",
            "mandate_clause": "AICTE-BMS Joint Custody Statutory Deposit",
            "notes": "Active statutory endowment deposit.",
            "created_by_id": user_map["officer_venkatesh"].id,
        },
        # Inst 2, FDR 5 (Pending Approval, 35 Lakhs)
        {
            "institution_id": inst_map["1-88492011"].id,
            "fdr_number": "FDR-CAN-449120",
            "cert_number": "CAN-FD-2024/449",
            "tripartite_ref": "TPR-2024-009 / AICTE-SWRO-110",
            "bank_name": "Canara Bank",
            "branch": "Basavanagudi, Bengaluru",
            "ifsc": "CNRB0000449",
            "amount": 3500000.00,
            "interest_rate": "7.25% p.a.",
            "issue_date": date(2024, 1, 10),
            "maturity_date": date(2029, 1, 10),
            "tenure_years": 5,
            "auto_rollover": True,
            "status": FDRStatus.PENDING_APPROVAL.value,
            "lien_status": "Statutory Lien Registered",
            "mandate_clause": "Tripartite Security Mandate",
            "notes": "Scrutinized and verified by regional verification officer. Awaiting member secretary approval.",
            "created_by_id": user_map["officer_venkatesh"].id,
        },
    ]

    fdr_map: Dict[str, FDR] = {}
    for f_item in fdrs_data:
        fdr = (
            session.query(FDR)
            .filter_by(
                institution_id=f_item["institution_id"],
                fdr_number=f_item["fdr_number"],
            )
            .first()
        )
        if not fdr:
            fdr = FDR(**f_item)
            session.add(fdr)
            session.flush()

            # Record initial field provenance for audit trail
            prov = FieldProvenance(
                fdr_id=fdr.id,
                field_name="fdr_number",
                old_value=None,
                new_value=fdr.fdr_number,
                source_category=ProvenanceSource.INSTITUTION_ENTERED.value,
                actor_id=f_item["created_by_id"],
                reason="Initial deposit registration submission",
            )
            session.add(prov)
        else:
            for k, v in f_item.items():
                setattr(fdr, k, v)
        fdr_map[f_item["fdr_number"]] = fdr

    session.flush()
    counts["fdrs"] = session.query(FDR).count()
    counts["provenance"] = session.query(FieldProvenance).count()

    # -------------------------------------------------------------------------
    # 4. Immutable Document Versions
    # -------------------------------------------------------------------------
    doc_hash = hashlib.sha256(SAMPLE_PDF_HEADER).hexdigest()
    docs_data = [
        {
            "fdr_id": fdr_map["FDR-PNB-883921"].id,
            "document_type": "FDR_RECEIPT",
            "version": 1,
            "storage_key": f"fdr/{fdr_map['FDR-PNB-883921'].id}/2021/11/demo_pnb_receipt_v1.pdf",
            "file_name": "pnb_fixed_deposit_receipt.pdf",
            "file_size": len(SAMPLE_PDF_HEADER),
            "mime_type": "application/pdf",
            "sha256_hash": doc_hash,
            "uploaded_by_id": user_map["officer_deshmukh"].id,
        },
        {
            "fdr_id": fdr_map["FDR-PNB-883921"].id,
            "document_type": "JOINT_MANDATE",
            "version": 1,
            "storage_key": f"fdr/{fdr_map['FDR-PNB-883921'].id}/2021/11/demo_pnb_mandate_v1.pdf",
            "file_name": "pnb_joint_mandate_form_l1.pdf",
            "file_size": len(SAMPLE_PDF_HEADER),
            "mime_type": "application/pdf",
            "sha256_hash": doc_hash,
            "uploaded_by_id": user_map["officer_deshmukh"].id,
        },
        {
            "fdr_id": fdr_map["FDR-SBI-772910"].id,
            "document_type": "FDR_RECEIPT",
            "version": 1,
            "storage_key": f"fdr/{fdr_map['FDR-SBI-772910'].id}/2020/08/demo_sbi_receipt_v1.pdf",
            "file_name": "sbi_fixed_deposit_receipt.pdf",
            "file_size": len(SAMPLE_PDF_HEADER),
            "mime_type": "application/pdf",
            "sha256_hash": doc_hash,
            "uploaded_by_id": user_map["officer_venkatesh"].id,
        },
    ]

    for d_item in docs_data:
        doc = (
            session.query(DocumentVersion)
            .filter_by(
                fdr_id=d_item["fdr_id"],
                document_type=d_item["document_type"],
                version=d_item["version"],
            )
            .first()
        )
        if not doc:
            doc = DocumentVersion(**d_item)
            session.add(doc)
    session.flush()
    counts["documents"] = session.query(DocumentVersion).count()

    # -------------------------------------------------------------------------
    # 5. Workflow Requests
    # -------------------------------------------------------------------------
    requests_data = [
        # Renewal request for FDR 1
        {
            "fdr_id": fdr_map["FDR-PNB-883921"].id,
            "request_type": RequestType.RENEWAL.value,
            "status": RenewalStatus.REQUESTED.value,
            "reason": "Regulatory term rollover with amended mandate clause",
            "applicant_notes": "Submitted with amended Form L-1 addressing WRO descriptor discrepancy.",
            "created_by_id": user_map["officer_deshmukh"].id,
        },
        # Release request for FDR 4
        {
            "fdr_id": fdr_map["FDR-SBI-772910"].id,
            "request_type": RequestType.RELEASE_REFUND.value,
            "status": ReleaseStatus.REQUESTED.value,
            "reason": "Statutory tenure completion & course restructuring",
            "applicant_notes": "All compliance NOCs obtained from State DTE and AICTE regional office.",
            "created_by_id": user_map["officer_venkatesh"].id,
        },
    ]

    for r_item in requests_data:
        req = (
            session.query(WorkflowRequest)
            .filter_by(
                fdr_id=r_item["fdr_id"],
                request_type=r_item["request_type"],
            )
            .first()
        )
        if not req:
            req = WorkflowRequest(**r_item)
            session.add(req)
    session.flush()
    counts["requests"] = session.query(WorkflowRequest).count()

    # -------------------------------------------------------------------------
    # 6. Notifications
    # -------------------------------------------------------------------------
    notifications_data = [
        {
            "recipient_user_id": user_map["officer_deshmukh"].id,
            "institution_id": inst_map["1-10928374"].id,
            "title": "Correction Required: FDR-PNB-883921",
            "message": "Joint Account Mandate text omits regional office descriptor. Please upload amended Form L-1.",
            "notification_type": "ACTION_REQUIRED",
            "is_read": False,
        },
        {
            "recipient_user_id": user_map["officer_venkatesh"].id,
            "institution_id": inst_map["1-88492011"].id,
            "title": "FDR Submission Received: FDR-CAN-449120",
            "message": "FDR-CAN-449120 has been verified by the Regional Office and submitted for Council approval.",
            "notification_type": "INFO",
            "is_read": False,
        },
        {
            "recipient_user_id": user_map["admin_sridhar"].id,
            "recipient_role": UserRole.AICTE_ADMIN.value,
            "institution_id": None,
            "title": "Maturity Review: 1 Instrument in 90-Day Window",
            "message": "FDR-SBI-554433 (St. Xavier's) is approaching maturity on 2026-08-01.",
            "notification_type": "WARNING",
            "is_read": False,
        },
    ]

    for n_item in notifications_data:
        notif = (
            session.query(Notification)
            .filter_by(
                recipient_user_id=n_item["recipient_user_id"],
                title=n_item["title"],
            )
            .first()
        )
        if not notif:
            notif = Notification(**n_item)
            session.add(notif)
    session.flush()
    counts["notifications"] = session.query(Notification).count()

    # -------------------------------------------------------------------------
    # 7. Initial Audit Logs
    # -------------------------------------------------------------------------
    audit_data = [
        {
            "actor_id": user_map["admin_sridhar"].id,
            "actor_name": user_map["admin_sridhar"].full_name,
            "actor_role": user_map["admin_sridhar"].role,
            "action": "SYSTEM_DATABASE_INITIALIZED",
            "target_type": "SYSTEM",
            "target_id": "AICTE-PORTAL",
            "details": "Deterministic seed dataset successfully populated across institutions and roles.",
            "ip_address": "127.0.0.1",
        },
    ]

    for a_item in audit_data:
        existing_log = (
            session.query(AuditLog)
            .filter_by(action=a_item["action"], target_id=a_item["target_id"])
            .first()
        )
        if not existing_log:
            log_entry = AuditLog(**a_item)
            session.add(log_entry)
    session.flush()
    counts["audit_logs"] = session.query(AuditLog).count()

    session.commit()
    return counts
