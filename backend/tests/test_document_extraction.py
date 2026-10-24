"""
Tests for document text-extraction suggestions (ARCH.md: suggestions never overwrite entered values).

- Parsing of FDR fields from text and MATCH / MISMATCH / NOT_FOUND comparison
- PDF text-layer extraction through the upload endpoint
- Entered FDR values are never modified by extraction
- Scanned/blank PDFs and images degrade to a status instead of failing the upload
- Extraction endpoint honours institution isolation
"""

import os
import tempfile
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import config as app_config
from app import storage as app_storage
from app.database import get_db
from app.extraction import compare_with_entered, parse_fdr_fields
from app.main import app
from app.migrations.runner import apply_migrations
from app.models.fdr import FDR
from app.models.user import User
from app.security import create_access_token
from app.seeds import seed_database

VALID_PNG = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]) + bytes(
    [0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00]
)
BLANK_PDF = b"%PDF-1.5\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n%%EOF"


def make_text_pdf(lines):
    """Builds a one-page PDF with a real text layer (no external libraries)."""
    stream = "BT /F1 12 Tf 50 750 Td 14 TL " + " ".join(
        "(" + ln.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ") Tj T*" for ln in lines
    ) + " ET"
    objs = [
        "<</Type/Catalog/Pages 2 0 R>>",
        "<</Type/Pages/Kids[3 0 R]/Count 1>>",
        "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
        f"<</Length {len(stream)}>>\nstream\n{stream}\nendstream",
        "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]
    out, offsets = b"%PDF-1.4\n", []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{body}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer<</Size {len(objs) + 1}/Root 1 0 R>>\nstartxref\n{xref}\n%%EOF\n".encode()
    return out


@pytest.fixture(scope="module")
def env():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_db:
        db_path = tmp_db.name
    storage_dir = tempfile.mkdtemp(prefix="fdr_extract_storage_")
    orig_cfg, orig_app = app_config.STORAGE_DIR, app_storage.STORAGE_DIR
    app_config.STORAGE_DIR = app_storage.STORAGE_DIR = storage_dir

    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    apply_migrations(engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    s = Session()
    seed_database(s)
    s.close()

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield Session
    app.dependency_overrides.clear()
    app_config.STORAGE_DIR, app_storage.STORAGE_DIR = orig_cfg, orig_app
    engine.dispose()
    try:
        os.remove(db_path)
    except Exception:
        pass


def headers_for(user):
    token = create_access_token(
        {"sub": user.id, "username": user.username, "email": user.email, "role": user.role, "institution_id": user.institution_id}
    )
    return {"Authorization": f"Bearer {token}"}


def officer_and_fdr(Session):
    s = Session()
    officer = s.query(User).filter_by(username="officer_deshmukh").first()
    fdr = s.query(FDR).filter_by(institution_id=officer.institution_id).first()
    snapshot = (fdr.id, fdr.fdr_number, Decimal(str(fdr.amount)), fdr.issue_date, fdr.maturity_date)
    headers = headers_for(officer)
    s.close()
    return headers, snapshot


def test_parse_fields_from_text():
    text = (
        "FIXED DEPOSIT RECEIPT\nFDR No: ABC/2026/0042\nIFSC: TEST0001234\n"
        "Amount: Rs. 5,00,000.00\nDate of Issue: 01-10-2026\nMaturity Date: 01 Oct 2031\n"
    )
    found = parse_fdr_fields(text)
    assert found == {
        "fdr_number": "ABC/2026/0042",
        "amount": "500000.00",
        "ifsc": "TEST0001234",
        "issue_date": "2026-10-01",
        "maturity_date": "2031-10-01",
    }


def test_compare_flags_match_mismatch_and_not_found():
    rows = compare_with_entered(
        {"fdr_number": "abc-0042", "amount": "500000.00", "issue_date": "2026-10-01"},
        {"fdr_number": "ABC0042", "amount": "600000.00", "issue_date": "2026-10-01", "maturity_date": "2031-10-01", "ifsc": "X"},
    )
    by_field = {r["field"]: r["result"] for r in rows}
    assert by_field == {
        "fdr_number": "MATCH",
        "amount": "MISMATCH",
        "issue_date": "MATCH",
        "maturity_date": "NOT_FOUND",
        "ifsc": "NOT_FOUND",
    }


def test_pdf_upload_returns_suggestions_and_keeps_entered_values(env):
    headers, (fdr_id, fdr_number, amount, issue, maturity) = officer_and_fdr(env)
    pdf = make_text_pdf([f"FDR No: {fdr_number}", "Amount: Rs. 1,23,456.00", f"Date of Issue: {issue.isoformat()}"])
    client = TestClient(app)
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents",
        headers=headers,
        files={"file": ("receipt.pdf", pdf, "application/pdf")},
        data={"document_type": "FDR_RECEIPT"},
    )
    assert res.status_code == 201, res.text
    ext = res.json()["extraction"]
    assert ext["status"] == "EXTRACTED" and ext["method"] == "PDF_TEXT_LAYER"
    results = {r["field"]: r for r in ext["fields"]}
    assert results["fdr_number"]["result"] == "MATCH"
    assert results["issue_date"]["result"] == "MATCH"
    assert results["amount"]["extracted"] == "123456.00"
    assert results["amount"]["result"] == ("MATCH" if amount == Decimal("123456.00") else "MISMATCH")
    assert results["maturity_date"]["result"] == "NOT_FOUND"
    assert "not proof" in ext["advisory"]

    # Entered values must be untouched
    s = env()
    fdr = s.query(FDR).filter_by(id=fdr_id).first()
    assert (fdr.fdr_number, Decimal(str(fdr.amount)), fdr.issue_date, fdr.maturity_date) == (fdr_number, amount, issue, maturity)
    s.close()

    # Same data is retrievable later
    doc_id = res.json()["document_id"]
    again = client.get(f"/api/v1/documents/{doc_id}/extraction", headers=headers)
    assert again.status_code == 200 and again.json()["fields"] == ext["fields"]


def test_blank_pdf_and_image_degrade_without_failing_upload(env):
    headers, (fdr_id, *_rest) = officer_and_fdr(env)
    client = TestClient(app)
    blank = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents", headers=headers,
        files={"file": ("scan.pdf", BLANK_PDF, "application/pdf")}, data={"document_type": "FDR_RECEIPT"},
    )
    assert blank.status_code == 201
    assert blank.json()["extraction"]["status"] in ("NO_TEXT_FOUND", "FAILED")
    assert blank.json()["extraction"]["fields"] == []

    image = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents", headers=headers,
        files={"file": ("scan.png", VALID_PNG, "image/png")}, data={"document_type": "FDR_RECEIPT"},
    )
    assert image.status_code == 201
    assert image.json()["extraction"]["status"] == "UNSUPPORTED_FORMAT"


def test_extraction_endpoint_enforces_institution_isolation(env):
    headers, (fdr_id, *_rest) = officer_and_fdr(env)
    client = TestClient(app)
    up = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents", headers=headers,
        files={"file": ("receipt.pdf", make_text_pdf(["FDR No: X-1"]), "application/pdf")}, data={"document_type": "FDR_RECEIPT"},
    )
    doc_id = up.json()["document_id"]

    s = env()
    owner = s.query(FDR).filter_by(id=fdr_id).first().institution_id
    other = s.query(User).filter(User.role == "INSTITUTION_OFFICER", User.institution_id != owner).first()
    other_headers = headers_for(other)
    s.close()

    assert client.get(f"/api/v1/documents/{doc_id}/extraction", headers=other_headers).status_code == 403
    assert client.get(f"/api/v1/documents/{doc_id}/extraction").status_code in (401, 403)
