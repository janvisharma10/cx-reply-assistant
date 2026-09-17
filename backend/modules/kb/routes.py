from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from utilities.db_utilies import get_db
from modules.kb.engine import kb_engine
from modules.kb.schema import (
    KBCreateRequest,
    KBResponse,
    KBDetailResponse,
    KBDeleteResponse,
    DocumentItem,
    DocumentDetailResponse,
    DocumentUploadResponse,
    DocumentDeleteResponse,
    KBSearchRequest,
    KBSearchResponse,
)

router = APIRouter(prefix="/kb", tags=["Knowledge Base"])


# ==============================================================================
# 1. Knowledge Base Management
# ==============================================================================
@router.post(
    "",
    response_model=KBResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Knowledge Base with name, description, and chunking config"
)
def create_knowledge_base(
    request: KBCreateRequest,
    db: Session = Depends(get_db)
):
    """
    Create a new Knowledge Base:
    - Sets name and description
    - Configures chunking based on chunking type (sentence, token, or semantic)
      with parameters (chunk_size, chunk_overlap, buffer_size, breakpoint_percentile_threshold)
    - Creates an independent table inside the database named after the KB ID
    - Sets up dedicated ChromaDB vector collection
    """
    try:
        kb = kb_engine.create_kb(
            name=request.name,
            description=request.description,
            chunking_config=request.chunking_config,
            db=db
        )
        return KBResponse(
            id=kb.id,
            name=kb.name,
            description=kb.description,
            chunking_config={
                "chunking_type": kb.chunking_type,
                "chunk_size": kb.chunk_size,
                "chunk_overlap": kb.chunk_overlap,
                "buffer_size": kb.buffer_size,
                "breakpoint_percentile_threshold": kb.breakpoint_percentile_threshold
            },
            embedding_model=kb.embedding_model,
            document_count=0,
            chunk_count=0,
            created_at=kb.created_at
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Knowledge Base: {str(e)}"
        )


@router.get(
    "",
    response_model=List[KBResponse],
    summary="List all Knowledge Bases"
)
def list_knowledge_bases(db: Session = Depends(get_db)):
    """Retrieve all Knowledge Bases with their configuration, document counts, and chunk counts."""
    return kb_engine.list_kbs(db=db)


@router.get(
    "/{kb_id}",
    response_model=KBDetailResponse,
    summary="Get Knowledge Base details and document list"
)
def get_knowledge_base(kb_id: str, db: Session = Depends(get_db)):
    """Retrieve details of a single KB and its indexed documents."""
    try:
        return kb_engine.get_kb(kb_id=kb_id, db=db)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke).strip("'"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve Knowledge Base: {str(e)}"
        )


@router.delete(
    "/{kb_id}",
    response_model=KBDeleteResponse,
    summary="Delete Knowledge Base, its independent table, and vectors"
)
def delete_knowledge_base(kb_id: str, db: Session = Depends(get_db)):
    """
    Permanently delete a Knowledge Base:
    - Drops its independent database table
    - Deletes its ChromaDB vector collection
    - Cleans up associated files
    """
    try:
        kb_engine.delete_kb(kb_id=kb_id, db=db)
        return KBDeleteResponse(
            message=f"Knowledge Base '{kb_id}' and its independent table were successfully deleted.",
            kb_id=kb_id
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke).strip("'"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete Knowledge Base: {str(e)}"
        )


# ==============================================================================
# 2. Add Documents to KB
# ==============================================================================
@router.post(
    "/{kb_id}/documents",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a document to the Knowledge Base"
)
@router.post(
    "/{kb_id}/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False
)
async def add_document_to_kb(
    kb_id: str,
    file: UploadFile = File(..., description="PDF document to be chunked and indexed"),
    db: Session = Depends(get_db)
):
    """
    Add a PDF document to a specific Knowledge Base:
    - Extracts text from PDF
    - Chunks text using the KB's configured chunking strategy (sentence, token, or semantic)
    - Generates embeddings and stores in ChromaDB persistent collection
    - Inserts chunk records into the KB's independent SQLite table
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files (.pdf) are supported."
        )

    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty."
            )

        res = kb_engine.upload_document_to_kb(
            kb_id=kb_id,
            filename=file.filename,
            file_bytes=content,
            db=db
        )

        return DocumentUploadResponse(
            message="Document successfully parsed, chunked with LlamaIndex, and stored in independent table and ChromaDB.",
            kb_id=res["kb_id"],
            document_id=res["document_id"],
            filename=res["filename"],
            chunking_type=res["chunking_type"],
            chunk_count=res["chunk_count"]
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke).strip("'"))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add document: {str(e)}"
        )


# ==============================================================================
# 3. List Documents & Inspect Chunks
# ==============================================================================
@router.get(
    "/{kb_id}/documents",
    response_model=List[DocumentItem],
    summary="List all documents in a Knowledge Base"
)
@router.get(
    "/{kb_id}/files",
    response_model=List[DocumentItem],
    include_in_schema=False
)
def list_documents_in_kb(kb_id: str, db: Session = Depends(get_db)):
    """Retrieve all documents and their chunk counts from the KB's independent table."""
    try:
        kb_data = kb_engine.get_kb(kb_id=kb_id, db=db)
        return kb_data.get("documents", [])
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke).strip("'"))


@router.get(
    "/{kb_id}/documents/{document_id}",
    response_model=DocumentDetailResponse,
    summary="Get all chunks for a document from the KB's independent table"
)
@router.get(
    "/{kb_id}/files/{document_id}",
    response_model=DocumentDetailResponse,
    include_in_schema=False
)
def get_document_chunks(kb_id: str, document_id: str, db: Session = Depends(get_db)):
    """Retrieve all chunks belonging to a specific document from the KB's independent table."""
    try:
        return kb_engine.get_document_chunks(kb_id=kb_id, document_id=document_id, db=db)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke).strip("'"))


# ==============================================================================
# 4. Delete Documents from KB (Cascade)
# ==============================================================================
@router.delete(
    "/{kb_id}/documents/{document_id}",
    response_model=DocumentDeleteResponse,
    summary="Delete a specific document and cascade-delete all its chunks"
)
@router.delete(
    "/{kb_id}/files/{document_id}",
    response_model=DocumentDeleteResponse,
    include_in_schema=False
)
def delete_document_from_kb(kb_id: str, document_id: str, db: Session = Depends(get_db)):
    """
    Delete a specific document from the Knowledge Base:
    - Deletes all associated chunks from the KB's independent table in SQLite
    - Deletes all associated vectors from ChromaDB
    - Deletes the physical PDF file from disk
    """
    try:
        deleted_count = kb_engine.delete_document_from_kb(kb_id=kb_id, document_id=document_id, db=db)
        return DocumentDeleteResponse(
            message=f"Document '{document_id}' and all {deleted_count} associated chunks were deleted successfully.",
            kb_id=kb_id,
            document_id=document_id,
            deleted_chunks_count=deleted_count
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke).strip("'"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(e)}"
        )


# ==============================================================================
# 5. Semantic Search
# ==============================================================================
@router.post(
    "/{kb_id}/query",
    response_model=KBSearchResponse,
    summary="Semantic vector search in a Knowledge Base"
)
def query_kb(
    kb_id: str,
    request: KBSearchRequest,
    db: Session = Depends(get_db)
):
    """
    Perform semantic vector search using OpenRouter embeddings and ChromaDB.
    Returns ranked chunks with similarity scores.
    """
    try:
        results = kb_engine.query_kb(
            kb_id=kb_id,
            query=request.query,
            top_k=request.top_k,
            db=db
        )
        return KBSearchResponse(
            query=request.query,
            kb_id=kb_id,
            total_results=len(results),
            results=results
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke).strip("'"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search query failed: {str(e)}"
        )
