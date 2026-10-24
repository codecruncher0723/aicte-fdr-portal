"""
Documents API Router (/api/v1/documents and /api/v1/fdrs/{fdr_id}/documents).
Implements Section 8.4 of REQUIREMENTS_UPDATED.md with private storage, SHA-256 integrity,
authenticated streaming download, and strict institution isolation.
Never exposes raw filesystem paths or storage keys.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import UserRole
from app.models.fdr import FDR
from app.models.workflow import WorkflowRequest
from app.models.document import DocumentVersion
from app.models.user import User
from app.auth import get_current_user, require_roles, enforce_institution_isolation
from app.extraction import extract_and_store, format_extraction_response
from app.storage import (
    save_document_version,
    format_document_response,
    read_file,
    authorize_document_access,
    authorize_document_upload,
    UnauthorizedDocumentAccessError,
    FileValidationError,
    FileTooLargeError,
    UnsupportedFileTypeError,
    StorageFileNotFoundError,
)

router = APIRouter(prefix="/api/v1", tags=["Documents"])


@router.get("/fdrs/{fdr_id}/documents", summary="List document versions for an FDR")
def list_fdr_documents(
    fdr_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Lists document versions associated with an FDR.
    Enforces institution isolation: Institution Officer from Inst A cannot view Inst B documents.
    Omits raw filesystem paths and storage keys.
    """
    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    enforce_institution_isolation(user=current_user, target_institution_id=fdr.institution_id)

    docs = (
        session.query(DocumentVersion)
        .filter_by(fdr_id=fdr_id)
        .order_by(DocumentVersion.version.asc())
        .all()
    )
    return [format_document_response(d) for d in docs]


@router.post("/fdrs/{fdr_id}/documents", status_code=status.HTTP_201_CREATED, summary="Upload an FDR document version")
async def upload_fdr_document(
    fdr_id: int,
    file: UploadFile = File(...),
    document_type: str = Form("FDR_RECEIPT"),
    uploaded_by_id: Optional[int] = Form(None),
    institution_id: Optional[int] = Form(None),
    current_user: User = Depends(require_roles(UserRole.INSTITUTION_OFFICER.value, UserRole.AICTE_ADMIN.value)),
    session: Session = Depends(get_db),
):
    """
    Uploads a new document version into private storage.
    Enforces:
    - 10 MB maximum file size
    - Format whitelist: PDF, JPEG, PNG, WEBP (validated by magic byte signatures)
    - Relative storage keys
    - SHA-256 calculation
    - Institution isolation
    """
    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    enforce_institution_isolation(user=current_user, target_institution_id=fdr.institution_id)

    content = await file.read()
    try:
        doc = save_document_version(
            session=session,
            document_type=document_type,
            content=content,
            original_filename=file.filename or "uploaded_document.pdf",
            uploaded_by_id=current_user.id,
            fdr_id=fdr.id,
            declared_mime=file.content_type,
        )
        extraction = extract_and_store(session, doc, content, fdr)
        session.commit()
    except FileTooLargeError as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except UnsupportedFileTypeError as e:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(e))
    except FileValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except UnauthorizedDocumentAccessError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    response = format_document_response(doc)
    response["extraction"] = format_extraction_response(extraction, doc.id)
    return response


@router.get("/documents/{document_id}", summary="View document metadata and hash")
def get_document_metadata(
    document_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns document metadata, SHA-256 hash, and version.
    Never exposes internal filesystem paths or storage keys.
    """
    doc = session.query(DocumentVersion).filter_by(id=document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document {document_id} not found.")

    try:
        authorize_document_access(user=current_user, document=doc)
    except UnauthorizedDocumentAccessError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    return format_document_response(doc)


@router.get("/documents/{document_id}/extraction", summary="Text-extraction suggestions for a document")
def get_document_extraction(
    document_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Returns extracted-vs-entered comparison. Advisory only; never changes the FDR."""
    doc = session.query(DocumentVersion).filter_by(id=document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document {document_id} not found.")

    try:
        authorize_document_access(user=current_user, document=doc)
    except UnauthorizedDocumentAccessError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    return format_extraction_response(doc.extraction, doc.id)


@router.get("/documents/{document_id}/download", summary="Authenticated secure document download")
def download_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Streams file bytes from private storage with authenticated authorization.
    Never exposes raw filesystem path or serves publicly.
    """
    doc = session.query(DocumentVersion).filter_by(id=document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document {document_id} not found.")

    try:
        authorize_document_access(user=current_user, document=doc)
    except UnauthorizedDocumentAccessError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    try:
        file_bytes = read_file(doc.storage_key)
    except StorageFileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical document file missing from storage.",
        )

    return Response(
        content=file_bytes,
        media_type=doc.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{doc.file_name}"'},
    )

@router.get("/requests/{request_id}/documents", summary="List document versions for a workflow request")
def list_request_documents(
    request_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Lists document versions associated with a workflow request.
    Enforces institution isolation.
    """
    req_obj = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not req_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow request {request_id} not found.")

    if req_obj.fdr:
        enforce_institution_isolation(user=current_user, target_institution_id=req_obj.fdr.institution_id)

    docs = (
        session.query(DocumentVersion)
        .filter_by(request_id=request_id)
        .order_by(DocumentVersion.version.asc())
        .all()
    )
    return [format_document_response(d) for d in docs]


@router.post("/requests/{request_id}/documents", status_code=status.HTTP_201_CREATED, summary="Upload a workflow request document version")
async def upload_request_document(
    request_id: int,
    file: UploadFile = File(...),
    document_type: str = Form("SUPPORTING_DOCUMENT"),
    uploaded_by_id: Optional[int] = Form(None),
    institution_id: Optional[int] = Form(None),
    current_user: User = Depends(require_roles(UserRole.INSTITUTION_OFFICER.value, UserRole.AICTE_ADMIN.value)),
    session: Session = Depends(get_db),
):
    """
    Uploads a new document version for a workflow request into private storage.
    Enforces file format, 10 MB limit, magic byte signature check, and institution isolation.
    """
    req_obj = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not req_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow request {request_id} not found.")

    if req_obj.fdr:
        enforce_institution_isolation(user=current_user, target_institution_id=req_obj.fdr.institution_id)

    content = await file.read()
    try:
        doc = save_document_version(
            session=session,
            document_type=document_type,
            content=content,
            original_filename=file.filename or "uploaded_document.pdf",
            uploaded_by_id=current_user.id,
            request_id=req_obj.id,
            fdr_id=req_obj.fdr_id,
            declared_mime=file.content_type,
        )
        session.commit()
    except FileTooLargeError as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except UnsupportedFileTypeError as e:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(e))
    except FileValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except UnauthorizedDocumentAccessError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    return format_document_response(doc)
