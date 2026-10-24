"""
Document Storage and Security Service for AICTE FDR Portal.

Enforces:
- Private storage directory management (outside public frontend directory)
- File format validation (PDF, JPG/JPEG, PNG, WEBP)
- Binary signature (magic bytes) validation against extensions and declared MIME types
- File size enforcement (<= 10 MB, > 0 bytes)
- Safe unique relative storage key generation (sanitized, traversal-free)
- SHA-256 hash calculation and constant-time integrity verification
- DocumentVersion database persistence with immutable version tracking
- Safe API response formatting (no raw filesystem paths or internal URLs exposed)
"""

import hashlib
import hmac
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import STORAGE_DIR
from app.models.document import DocumentVersion

# Maximum allowed file size: 10 MB (as specified in REQUIREMENTS_UPDATED.md)
MAX_FILE_SIZE = 10 * 1024 * 1024

# Exact binary magic byte signatures
PDF_SIGNATURE = b"%PDF-"
JPEG_SIGNATURE = bytes([0xFF, 0xD8, 0xFF])
PNG_SIGNATURE = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
WEBP_RIFF_TAG = b"RIFF"
WEBP_TAG = b"WEBP"

# Allowed file formats and specifications
ALLOWED_FORMATS = {
    "pdf": {
        "extensions": {".pdf"},
        "mime_types": {"application/pdf"},
        "canonical_mime": "application/pdf",
        "description": "Portable Document Format",
    },
    "jpeg": {
        "extensions": {".jpg", ".jpeg"},
        "mime_types": {"image/jpeg", "image/pjpeg"},
        "canonical_mime": "image/jpeg",
        "description": "JPEG Image",
    },
    "png": {
        "extensions": {".png"},
        "mime_types": {"image/png"},
        "canonical_mime": "image/png",
        "description": "PNG Image",
    },
    "webp": {
        "extensions": {".webp"},
        "mime_types": {"image/webp"},
        "canonical_mime": "image/webp",
        "description": "WebP Image",
    },
}

ALLOWED_EXTENSIONS = {ext for fmt in ALLOWED_FORMATS.values() for ext in fmt["extensions"]}
ALLOWED_MIMES = {mime for fmt in ALLOWED_FORMATS.values() for mime in fmt["mime_types"]}


# Custom Storage & Validation Exceptions
class StorageError(Exception):
    """Base exception for all storage-related errors."""
    pass


class FileValidationError(StorageError):
    """Base exception for file validation failures."""
    pass


class FileEmptyError(FileValidationError):
    """Raised when file content is empty (0 bytes)."""
    pass


class FileTooLargeError(FileValidationError):
    """Raised when file exceeds the maximum allowed size (10 MB)."""
    pass


class UnsupportedFileTypeError(FileValidationError):
    """Raised when file extension, MIME type, or signature is not permitted."""
    pass


class FileSignatureMismatchError(FileValidationError):
    """Raised when magic bytes do not match the file extension or declared MIME type."""
    pass


class CorruptedFileError(FileValidationError):
    """Raised when file data is malformed, truncated, or incomplete."""
    pass


class PathTraversalError(StorageError):
    """Raised when an unsafe path traversal attempt is detected."""
    pass


class StorageFileNotFoundError(StorageError):
    """Raised when the requested file does not exist in storage."""
    pass


class FileIntegrityError(StorageError):
    """Raised when a file's SHA-256 hash does not match expected integrity hash."""
    pass


class UnauthorizedDocumentAccessError(StorageError):
    """Raised when a user attempts unauthorized access or upload of a document."""
    pass


def detect_file_signature(content: bytes) -> str:
    """
    Detect the canonical format from magic bytes (file signature).

    Returns:
        One of 'pdf', 'jpeg', 'png', 'webp'

    Raises:
        FileEmptyError: If content is empty
        CorruptedFileError: If file has partial signature or is truncated
        UnsupportedFileTypeError: If signature does not match any allowed format
    """
    if not content or len(content) == 0:
        raise FileEmptyError("File is empty (0 bytes).")

    # PDF: starts with %PDF- (0x25 0x50 0x44 0x46 0x2D)
    if content.startswith(PDF_SIGNATURE):
        if len(content) < 10:
            raise CorruptedFileError("Malformed or truncated PDF file.")
        return "pdf"

    # JPEG: starts with 0xFF 0xD8 0xFF
    if content.startswith(JPEG_SIGNATURE):
        if len(content) < 10:
            raise CorruptedFileError("Malformed or truncated JPEG file.")
        return "jpeg"

    # PNG: starts with 8-byte PNG header (89 50 4E 47 0D 0A 1A 0A)
    if content.startswith(PNG_SIGNATURE):
        if len(content) < 16:
            raise CorruptedFileError("Malformed or truncated PNG file.")
        return "png"

    # WebP: starts with 'RIFF' (bytes 0-3) and 'WEBP' at bytes 8-11
    if len(content) >= 12 and content[:4] == WEBP_RIFF_TAG and content[8:12] == WEBP_TAG:
        return "webp"

    if content.startswith(WEBP_RIFF_TAG):
        raise UnsupportedFileTypeError("Unsupported RIFF file format (not WebP).")

    raise UnsupportedFileTypeError(
        "Unsupported file format or invalid file signature. Allowed: PDF, JPG, PNG, WEBP."
    )


def sanitize_filename(filename: str) -> str:
    """
    Sanitize an uploaded filename for safe storage and display.
    Strips directory separators, null bytes, and non-whitelisted characters.
    """
    if not filename:
        return "document"

    # Strip any directory traversal components, null bytes
    cleaned = filename.replace("\\", "/").split("/")[-1].replace(chr(0), "")
    # Keep alphanumeric, dot, underscore, and hyphen
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", cleaned)
    # Strip leading/trailing dots or underscores
    cleaned = cleaned.strip("._")
    if not cleaned:
        cleaned = "document"
    return cleaned[:100]


def generate_storage_key(
    original_filename: str,
    category: str = "fdr",
    entity_id: Optional[int] = None,
) -> str:
    """
    Generate a safe, unique, purely relative storage key.
    
    Structure: {category}/{entity_id or 'general'}/{YYYY}/{MM}/{unique_token}_{safe_filename}
    Example: 'fdr/12/2026/10/a8b9c0d1e2f3_fdr_receipt.pdf'
    
    CRITICAL: Never includes absolute drive letters or traversal components.
    """
    now = datetime.now(timezone.utc)
    safe_name = sanitize_filename(original_filename)
    unique_token = uuid.uuid4().hex[:16]

    safe_category = re.sub(r"[^a-zA-Z0-9_-]", "", category) or "fdr"
    safe_entity = str(entity_id) if entity_id is not None and entity_id > 0 else "general"

    return f"{safe_category}/{safe_entity}/{now.year:04d}/{now.month:02d}/{unique_token}_{safe_name}"


def resolve_storage_path(storage_key: str, storage_root: Optional[str] = None) -> Path:
    """
    Safely resolves a relative storage key against STORAGE_DIR.
    Enforces strict path containment within the private storage directory.

    Raises:
        PathTraversalError: If the key is absolute, contains traversal sequences, or escapes storage root.
    """
    if not storage_key:
        raise PathTraversalError("Storage key cannot be empty.")

    if chr(0) in storage_key:
        raise PathTraversalError("Null byte detected in storage key.")

    # Storage key must be strictly relative without leading slashes or Windows drive specifiers
    if storage_key.startswith("/") or storage_key.startswith("\\") or ":" in storage_key:
        raise PathTraversalError(f"Absolute or root-relative path not allowed in storage key: {storage_key}")

    base = Path(storage_root or STORAGE_DIR).resolve()
    
    # Normalize separators
    normalized = storage_key.replace("\\", "/")
    
    # Check for direct traversal components in key
    parts = normalized.split("/")
    if any(p == ".." for p in parts):
        raise PathTraversalError(f"Directory traversal detected in storage key: {storage_key}")

    # Resolve target
    target = (base / normalized).resolve()

    try:
        if not target.is_relative_to(base):
            raise PathTraversalError(f"Path traversal detected: {storage_key}")
    except AttributeError:
        # Fallback for Python < 3.9
        if str(target) != str(base) and not str(target).startswith(str(base) + os.sep):
            raise PathTraversalError(f"Path traversal detected: {storage_key}")

    return target


def compute_sha256(content: bytes) -> str:
    """
    Compute standard SHA-256 hash in lowercase hexadecimal format (64 characters).
    """
    return hashlib.sha256(content).hexdigest().lower()


def validate_file(
    filename: str,
    content: bytes,
    declared_mime: Optional[str] = None,
) -> Tuple[str, str, int, str]:
    """
    Comprehensive file validation checking size, extension, magic bytes, and MIME match.

    Returns:
        tuple: (detected_format, canonical_mime, file_size, sha256_hash)

    Raises:
        FileEmptyError: If content is empty
        FileTooLargeError: If size > 10 MB
        UnsupportedFileTypeError: If extension or signature is not in allowed list
        FileSignatureMismatchError: If signature doesn't match extension/MIME
        CorruptedFileError: If file is malformed or truncated
    """
    # 1. Size check
    if not content or len(content) == 0:
        raise FileEmptyError("File is empty (0 bytes).")

    file_size = len(content)
    if file_size > MAX_FILE_SIZE:
        raise FileTooLargeError(
            f"File size ({file_size / (1024 * 1024):.2f} MB) exceeds maximum allowed limit of 10 MB."
        )

    # 2. Extension check
    ext = Path(filename).suffix.lower()
    if not ext or ext not in ALLOWED_EXTENSIONS:
        raise UnsupportedFileTypeError(
            f"Unsupported file extension '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # 3. Magic bytes / file signature detection
    detected_format = detect_file_signature(content)
    format_spec = ALLOWED_FORMATS[detected_format]

    # 4. Extension must match detected format
    if ext not in format_spec["extensions"]:
        raise FileSignatureMismatchError(
            f"File extension '{ext}' does not match detected format '{detected_format.upper()}'."
        )

    # 5. Declared MIME type validation if provided
    canonical_mime = format_spec["canonical_mime"]
    if declared_mime:
        clean_mime = declared_mime.strip().lower().split(";")[0]
        if clean_mime not in format_spec["mime_types"]:
            raise FileSignatureMismatchError(
                f"Declared MIME type '{declared_mime}' does not match detected format '{detected_format.upper()}'."
            )

    # 6. Compute SHA-256
    sha256_hash = compute_sha256(content)

    return detected_format, canonical_mime, file_size, sha256_hash


def save_file(
    content: bytes,
    original_filename: str,
    category: str = "fdr",
    entity_id: Optional[int] = None,
    declared_mime: Optional[str] = None,
    storage_root: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Validates file content, generates a secure relative storage key, and writes
    the file to private storage outside the public web root.

    Returns:
        dict: {
            "storage_key": relative_key,
            "file_name": safe_filename,
            "file_size": size_in_bytes,
            "mime_type": canonical_mime,
            "sha256_hash": sha256_hex,
            "detected_format": format_name,
        }
    """
    detected_format, canonical_mime, file_size, sha256_hash = validate_file(
        filename=original_filename,
        content=content,
        declared_mime=declared_mime,
    )

    storage_key = generate_storage_key(
        original_filename=original_filename,
        category=category,
        entity_id=entity_id,
    )

    target_path = resolve_storage_path(storage_key, storage_root=storage_root)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(content)

    return {
        "storage_key": storage_key,
        "file_name": sanitize_filename(original_filename),
        "file_size": file_size,
        "mime_type": canonical_mime,
        "sha256_hash": sha256_hash,
        "detected_format": detected_format,
    }


def read_file(storage_key: str, storage_root: Optional[str] = None) -> bytes:
    """
    Reads file content from private storage by relative storage_key.
    Guarantees the target path does not escape storage_root.
    """
    target_path = resolve_storage_path(storage_key, storage_root=storage_root)
    if not target_path.exists() or not target_path.is_file():
        raise StorageFileNotFoundError(f"Document file not found for key: {storage_key}")
    return target_path.read_bytes()


def delete_file(storage_key: str, storage_root: Optional[str] = None) -> bool:
    """
    Deletes a file from private storage.
    """
    try:
        target_path = resolve_storage_path(storage_key, storage_root=storage_root)
        if target_path.exists() and target_path.is_file():
            target_path.unlink()
            return True
        return False
    except Exception:
        return False


def verify_file_integrity(
    storage_key: str,
    expected_sha256: str,
    storage_root: Optional[str] = None,
) -> bool:
    """
    Verifies that the file at storage_key matches the expected SHA-256 hash.
    Uses hmac.compare_digest for constant-time comparison.
    """
    content = read_file(storage_key, storage_root=storage_root)
    actual_hash = compute_sha256(content)
    return hmac.compare_digest(actual_hash, expected_sha256.lower())


def save_document_version(
    session: Session,
    document_type: str,
    content: bytes,
    original_filename: str,
    uploaded_by_id: int,
    fdr_id: Optional[int] = None,
    request_id: Optional[int] = None,
    declared_mime: Optional[str] = None,
    storage_root: Optional[str] = None,
) -> DocumentVersion:
    """
    Saves a document file to private storage and records an immutable DocumentVersion
    in the database with automatic version incrementing.

    Preserves previous document versions whenever a corrected or renewed document is uploaded.
    Stores ONLY relative private-storage references in the database.
    """
    category = "fdr" if fdr_id else ("request" if request_id else "general")
    entity_id = fdr_id or request_id

    # 1. Save file to private storage
    meta = save_file(
        content=content,
        original_filename=original_filename,
        category=category,
        entity_id=entity_id,
        declared_mime=declared_mime,
        storage_root=storage_root,
    )

    # 2. Determine next version number for this entity and document_type
    query = session.query(func.max(DocumentVersion.version)).filter(
        DocumentVersion.document_type == document_type
    )
    if fdr_id is not None:
        query = query.filter(DocumentVersion.fdr_id == fdr_id)
    if request_id is not None:
        query = query.filter(DocumentVersion.request_id == request_id)

    max_ver = query.scalar()
    next_version = (max_ver or 0) + 1

    # 3. Create DocumentVersion record
    doc_version = DocumentVersion(
        fdr_id=fdr_id,
        request_id=request_id,
        document_type=document_type,
        version=next_version,
        storage_key=meta["storage_key"],  # Pure relative path
        file_name=meta["file_name"],      # Sanitized original display name
        file_size=meta["file_size"],
        mime_type=meta["mime_type"],
        sha256_hash=meta["sha256_hash"],
        uploaded_by_id=uploaded_by_id,
    )

    session.add(doc_version)
    session.flush()
    return doc_version


def format_document_response(doc: DocumentVersion) -> Dict[str, Any]:
    """
    Format a DocumentVersion record for safe API output.

    CRITICAL SECURITY RULE:
    Never expose raw filesystem paths, storage_key, or internal URLs.
    Only client-safe metadata is returned.
    """
    created_iso = doc.created_at.isoformat() if doc.created_at else None
    return {
        "id": doc.id,
        "document_id": doc.id,
        "fdr_id": doc.fdr_id,
        "request_id": doc.request_id,
        "document_type": doc.document_type,
        "version": doc.version,
        "file_name": doc.file_name,
        "original_filename": doc.file_name,
        "file_size": doc.file_size,
        "mime_type": doc.mime_type,
        "sha256_hash": doc.sha256_hash,
        "sha256": doc.sha256_hash,
        "uploaded_by_id": doc.uploaded_by_id,
        "created_at": created_iso,
        "uploaded_at": created_iso,
    }


def get_document_versions(
    session: Session,
    fdr_id: Optional[int] = None,
    request_id: Optional[int] = None,
    document_type: Optional[str] = None,
) -> List[DocumentVersion]:
    """
    Returns all historical versions of a document, ordered chronologically (version ascending).
    """
    query = session.query(DocumentVersion)
    if fdr_id is not None:
        query = query.filter(DocumentVersion.fdr_id == fdr_id)
    if request_id is not None:
        query = query.filter(DocumentVersion.request_id == request_id)
    if document_type is not None:
        query = query.filter(DocumentVersion.document_type == document_type)

    return query.order_by(DocumentVersion.version.asc()).all()


def get_latest_document_version(
    session: Session,
    fdr_id: Optional[int] = None,
    request_id: Optional[int] = None,
    document_type: str = "FDR_RECEIPT",
) -> Optional[DocumentVersion]:
    """
    Returns the latest (most recent) version of a document.
    """
    versions = get_document_versions(
        session=session,
        fdr_id=fdr_id,
        request_id=request_id,
        document_type=document_type,
    )
    return versions[-1] if versions else None


def authorize_document_access(user: Any, document: DocumentVersion) -> bool:
    """
    Enforces server-side RBAC and institution isolation for document access.

    Rules:
    - AICTE_ADMIN, APPROVING_AUTHORITY, VERIFICATION_OFFICER: authorized for review.
    - INSTITUTION_OFFICER: authorized ONLY if the document belongs to their institution.
    """
    role = getattr(user, "role", None)
    if role in ("AICTE_ADMIN", "APPROVING_AUTHORITY", "VERIFICATION_OFFICER"):
        return True

    if role == "INSTITUTION_OFFICER":
        user_inst_id = getattr(user, "institution_id", None)
        doc_inst_id = None
        if document.fdr and document.fdr.institution_id:
            doc_inst_id = document.fdr.institution_id
        elif document.request and document.request.fdr and document.request.fdr.institution_id:
            doc_inst_id = document.request.fdr.institution_id

        if doc_inst_id is not None and user_inst_id == doc_inst_id:
            return True

        raise UnauthorizedDocumentAccessError(
            f"Access denied: Institution Officer from institution {user_inst_id} "
            f"cannot access document from institution {doc_inst_id}."
        )

    raise UnauthorizedDocumentAccessError(f"Role '{role}' is not authorized to access documents.")


def authorize_document_upload(user: Any, fdr: Optional[Any] = None, request: Optional[Any] = None) -> bool:
    """
    Enforces authorization to upload a document to an FDR or request.
    Institution Officer can upload ONLY to their own institution's FDR.
    """
    role = getattr(user, "role", None)
    if role in ("AICTE_ADMIN",):
        return True

    target = fdr or (request.fdr if request else None)
    if not target:
        return True

    if role == "INSTITUTION_OFFICER":
        user_inst_id = getattr(user, "institution_id", None)
        target_inst_id = getattr(target, "institution_id", None)
        if user_inst_id != target_inst_id:
            raise UnauthorizedDocumentAccessError(
                f"Unauthorized upload: Institution Officer from institution {user_inst_id} "
                f"cannot upload documents to institution {target_inst_id}."
            )
        return True

    if role in ("VERIFICATION_OFFICER", "APPROVING_AUTHORITY"):
        return True

    raise UnauthorizedDocumentAccessError(f"Role '{role}' is not authorized to upload documents.")


def replace_document_version(
    session: Session,
    document_type: str,
    content: bytes,
    original_filename: str,
    uploader: Any,
    fdr_id: Optional[int] = None,
    request_id: Optional[int] = None,
    declared_mime: Optional[str] = None,
    storage_root: Optional[str] = None,
) -> Tuple[Optional[DocumentVersion], DocumentVersion]:
    """
    Replaces an existing document by creating an immutable new DocumentVersion.
    CRITICAL INVARIANT:
    Never deletes or overwrites the previous version's file or database record!

    Returns:
        tuple: (previous_document_version, new_document_version)
    """
    from app.models.fdr import FDR
    from app.models.workflow import WorkflowRequest

    fdr = session.query(FDR).filter_by(id=fdr_id).first() if fdr_id else None
    req = session.query(WorkflowRequest).filter_by(id=request_id).first() if request_id else None

    # Enforce upload authorization
    authorize_document_upload(user=uploader, fdr=fdr, request=req)

    # Find prior latest version
    prior_version = get_latest_document_version(
        session=session,
        fdr_id=fdr_id,
        request_id=request_id,
        document_type=document_type,
    )

    # Create immutable new version
    new_version = save_document_version(
        session=session,
        document_type=document_type,
        content=content,
        original_filename=original_filename,
        uploaded_by_id=uploader.id,
        fdr_id=fdr_id,
        request_id=request_id,
        declared_mime=declared_mime,
        storage_root=storage_root,
    )

    return prior_version, new_version
