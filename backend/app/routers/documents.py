import hashlib
import mimetypes
from datetime import timedelta
from pathlib import PurePath
from urllib.parse import quote

from fastapi import APIRouter, Depends, Form, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, undefer

from ..db import get_db
from ..deps import Ctx, get_ctx
from ..models import Document, User, utcnow
from ..schemas import DocumentCategory, DocumentLinkOut, DocumentOut
from ..security import FILE_LINK_MINUTES, create_file_token, decode_file_token
from ..serializers import person
from ..services.record import log_event

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_BYTES = 5 * 1024 * 1024
ALLOWED_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
CATEGORY_LABELS = {
    "birth-certificate": "Birth certificate",
    "medical": "Medical",
    "school": "School",
    "legal": "Legal",
    "id": "ID",
    "other": "Other",
}


def document_out(d: Document, ctx: Ctx) -> DocumentOut:
    return DocumentOut(
        id=d.id,
        title=d.title,
        category=d.category,
        filename=d.filename,
        content_type=d.content_type,
        size=d.size,
        sha256=d.sha256,
        created_at=d.created_at,
        uploaded_by=person(d.uploaded_by),
        mine=d.uploaded_by_id == ctx.user.id,
    )


def readable_size(size: int) -> str:
    return f"{size / 1024 / 1024:.1f} MB" if size >= 1024 * 1024 else f"{max(round(size / 1024), 1)} KB"


def family_document(ctx: Ctx, document_id: int) -> Document:
    document = ctx.db.get(Document, document_id)
    if document is None or document.family_id != ctx.family.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found.")
    return document


@router.get("", response_model=list[DocumentOut])
def list_documents(ctx: Ctx = Depends(get_ctx)):
    rows = ctx.db.scalars(
        select(Document).where(Document.family_id == ctx.family.id).order_by(Document.created_at.desc())
    ).all()
    return [document_out(d, ctx) for d in rows]


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile,
    title: str = Form(min_length=1, max_length=120),
    category: DocumentCategory = Form(),
    ctx: Ctx = Depends(get_ctx),
):
    filename = PurePath(file.filename or "document").name[-200:] or "document"
    content_type = file.content_type if file.content_type in ALLOWED_TYPES else mimetypes.guess_type(filename)[0]
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload a PDF, a photo or a Word document.")
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Files can be up to 5 MB.")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That file is empty.")

    title = title.strip()
    sha256 = hashlib.sha256(data).hexdigest()
    document = Document(
        family_id=ctx.family.id,
        uploaded_by_id=ctx.user.id,
        title=title,
        category=category,
        filename=filename,
        content_type=content_type,
        size=len(data),
        sha256=sha256,
        data=data,
    )
    ctx.db.add(document)
    log_event(
        ctx.db,
        ctx.family.id,
        ctx.user,
        "document",
        f"Document added by {ctx.user.first_name} — {CATEGORY_LABELS[category]}: “{title}” "
        f"({filename}, {readable_size(len(data))}, SHA-256 {sha256[:16]})",
    )
    ctx.db.commit()
    return document_out(document, ctx)


@router.get("/{document_id}/link", response_model=DocumentLinkOut)
def document_link(document_id: int, ctx: Ctx = Depends(get_ctx)):
    family_document(ctx, document_id)
    token = create_file_token(ctx.user.id, document_id)
    return DocumentLinkOut(
        path=f"/documents/{document_id}/file?token={token}",
        expires_at=utcnow() + timedelta(minutes=FILE_LINK_MINUTES),
    )


@router.get("/{document_id}/file")
def document_file(document_id: int, token: str, db: Session = Depends(get_db)):
    user = db.get(User, decode_file_token(token, document_id))
    document = db.scalar(select(Document).where(Document.id == document_id).options(undefer(Document.data)))
    if user is None or document is None or user.family_id != document.family_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found.")
    fallback = document.filename.encode("ascii", "ignore").decode().replace('"', "") or "document"
    return Response(
        content=document.data,
        media_type=document.content_type,
        headers={
            "Content-Disposition": f"inline; filename=\"{fallback}\"; filename*=UTF-8''{quote(document.filename)}",
            "Cache-Control": "private, no-store",
        },
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: int, ctx: Ctx = Depends(get_ctx)):
    document = family_document(ctx, document_id)
    if document.uploaded_by_id != ctx.user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the parent who added a document can remove it.")
    log_event(
        ctx.db,
        ctx.family.id,
        ctx.user,
        "document",
        f"Document removed by {ctx.user.first_name} — “{document.title}” ({document.filename})",
    )
    ctx.db.delete(document)
    ctx.db.commit()
