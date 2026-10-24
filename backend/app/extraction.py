"""
Document text extraction (suggestions only).

Reads the embedded text layer of PDF uploads and proposes values for a few FDR fields.
Per ARCH.md, extracted values never overwrite what the institution entered: they are stored
beside it with a MATCH / MISMATCH / NOT_FOUND comparison for the Verification Officer.
Scanned images have no text layer; OCR is deferred, so they are reported as such.
A suggestion is not proof that an FDR is genuine.
"""

import io
import json
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.document import DocumentExtraction, DocumentVersion

try:  # optional dependency (BSD-3-Clause); extraction degrades to UNAVAILABLE without it
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    PdfReader = None

MAX_PAGES = 10
MAX_TEXT_CHARS = 200_000

ADVISORY = (
    "Suggestions read from the document's text layer. They do not replace the entered values "
    "and are not proof of authenticity; the Verification Officer decides."
)

_AMOUNT_RE = re.compile(r"(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)
_FDR_NO_RE = re.compile(
    r"(?:fdr|fd|receipt|deposit)\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9/\-]{3,39})",
    re.IGNORECASE,
)
_IFSC_RE = re.compile(r"\b([A-Z]{4}0[A-Z0-9]{6})\b")
_DATE_FORMATS = ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d.%m.%Y", "%d %b %Y", "%d %B %Y", "%d-%b-%Y")
_DATE_TOKEN = r"(\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[ -][A-Za-z]{3,9}[ -]\d{4})"
_ISSUE_RE = re.compile(
    r"(?:date\s+of\s+(?:issue|deposit)|issue\s+date|deposit\s+date|value\s+date)\s*[:\-]?\s*" + _DATE_TOKEN,
    re.IGNORECASE,
)
_MATURITY_RE = re.compile(r"(?:date\s+of\s+maturity|maturity\s+date)\s*[:\-]?\s*" + _DATE_TOKEN, re.IGNORECASE)


def _money(value: str) -> Optional[str]:
    try:
        return format(Decimal(value.replace(",", "")).quantize(Decimal("0.01")), "f")
    except (InvalidOperation, ValueError):
        return None


def _parse_date(token: str) -> Optional[date]:
    token = token.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(token, fmt).date()
        except ValueError:
            continue
    return None


def extract_pdf_text(content: bytes) -> str:
    """Returns the embedded text of the first pages of a PDF (empty string if none)."""
    reader = PdfReader(io.BytesIO(content))
    parts: List[str] = []
    for page in reader.pages[:MAX_PAGES]:
        parts.append(page.extract_text() or "")
        if sum(len(p) for p in parts) > MAX_TEXT_CHARS:
            break
    return "\n".join(parts)[:MAX_TEXT_CHARS]


def parse_fdr_fields(text: str) -> Dict[str, str]:
    """Finds candidate FDR field values in free text. Fields that are not found are omitted."""
    found: Dict[str, str] = {}
    m = _FDR_NO_RE.search(text)
    if m:
        found["fdr_number"] = m.group(1).upper()
    m = _AMOUNT_RE.search(text)
    if m and _money(m.group(1)):
        found["amount"] = _money(m.group(1))
    m = _IFSC_RE.search(text)
    if m:
        found["ifsc"] = m.group(1)
    for key, rx in (("issue_date", _ISSUE_RE), ("maturity_date", _MATURITY_RE)):
        m = rx.search(text)
        d = _parse_date(m.group(1)) if m else None
        if d:
            found[key] = d.isoformat()
    return found


def _entered_values(fdr: Any) -> Dict[str, Optional[str]]:
    amount = getattr(fdr, "amount", None)
    issue = getattr(fdr, "issue_date", None)
    maturity = getattr(fdr, "maturity_date", None)
    return {
        "fdr_number": getattr(fdr, "fdr_number", None),
        "amount": format(Decimal(str(amount)).quantize(Decimal("0.01")), "f") if amount is not None else None,
        "ifsc": getattr(fdr, "ifsc", None),
        "issue_date": issue.isoformat() if issue else None,
        "maturity_date": maturity.isoformat() if maturity else None,
    }


def _norm(field: str, value: Optional[str]) -> str:
    v = (value or "").strip().upper()
    return re.sub(r"[^A-Z0-9]", "", v) if field in ("fdr_number", "ifsc") else v


def compare_with_entered(
    extracted: Dict[str, str], entered: Dict[str, Optional[str]]
) -> List[Dict[str, Optional[str]]]:
    """One row per field: extracted value, entered value and MATCH / MISMATCH / NOT_FOUND."""
    rows: List[Dict[str, Optional[str]]] = []
    for field in ("fdr_number", "amount", "issue_date", "maturity_date", "ifsc"):
        ext, ent = extracted.get(field), entered.get(field)
        if ext is None:
            result = "NOT_FOUND"
        else:
            result = "MATCH" if _norm(field, ext) == _norm(field, ent) else "MISMATCH"
        rows.append({"field": field, "extracted": ext, "entered": ent, "result": result})
    return rows


def extract_and_store(
    session: Session, document: DocumentVersion, content: bytes, fdr: Any = None
) -> DocumentExtraction:
    """
    Runs extraction for an uploaded document and stores the outcome. Never raises and never
    modifies the FDR; a failure is recorded as a status for the reviewer to see.
    """
    status, method, fields = "UNSUPPORTED_FORMAT", "NONE", []
    if document.mime_type == "application/pdf":
        if PdfReader is None:
            status = "UNAVAILABLE"
        else:
            try:
                text = extract_pdf_text(content)
                method = "PDF_TEXT_LAYER"
                if not text.strip():
                    status = "NO_TEXT_FOUND"
                else:
                    status = "EXTRACTED"
                    fields = compare_with_entered(parse_fdr_fields(text), _entered_values(fdr))
            except Exception:
                status, method, fields = "FAILED", "NONE", []
    row = DocumentExtraction(
        document_id=document.id, status=status, method=method, fields_json=json.dumps(fields)
    )
    session.add(row)
    session.flush()
    return row


def format_extraction_response(row: Optional[DocumentExtraction], document_id: int) -> Dict[str, Any]:
    """Client-safe extraction payload. NOT_RUN covers documents uploaded before extraction existed."""
    if row is None:
        return {"document_id": document_id, "status": "NOT_RUN", "method": "NONE", "fields": [], "advisory": ADVISORY}
    return {
        "document_id": document_id,
        "status": row.status,
        "method": row.method,
        "fields": json.loads(row.fields_json or "[]"),
        "advisory": ADVISORY,
    }
