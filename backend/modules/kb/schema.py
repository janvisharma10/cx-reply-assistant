from datetime import datetime
from typing import List, Optional
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict


class ChunkingType(str, Enum):
    SENTENCE = "sentence"
    TOKEN = "token"
    SEMANTIC = "semantic"


class ChunkingConfig(BaseModel):
    chunking_type: ChunkingType = Field(
        default=ChunkingType.SENTENCE,
        description="Chunking strategy: 'sentence', 'token', or 'semantic'"
    )
    # Sentence & Token chunking parameters
    chunk_size: Optional[int] = Field(
        default=800,
        ge=50,
        le=4000,
        description="Chunk size (used for 'sentence' and 'token' chunking)"
    )
    chunk_overlap: Optional[int] = Field(
        default=150,
        ge=0,
        le=1000,
        description="Chunk overlap (used for 'sentence' and 'token' chunking)"
    )
    # Semantic chunking parameters
    buffer_size: Optional[int] = Field(
        default=1,
        ge=1,
        le=10,
        description="Buffer size for sentence window (used for 'semantic' chunking)"
    )
    breakpoint_percentile_threshold: Optional[int] = Field(
        default=95,
        ge=50,
        le=100,
        description="Cosine dissimilarity percentile threshold (used for 'semantic' chunking)"
    )


class KBCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Knowledge Base name")
    description: Optional[str] = Field(default="", description="Knowledge Base description")
    chunking_config: ChunkingConfig = Field(
        default_factory=ChunkingConfig,
        description="Chunking configuration tailored to chunking type (sentence, token, or semantic)"
    )


class KBResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    chunking_config: dict  # raw dict as returned by engine (chunking_type, chunk_size, etc.)
    embedding_model: str
    document_count: int = 0
    chunk_count: int = 0
    created_at: datetime


class DocumentItem(BaseModel):
    document_id: str
    filename: str
    chunk_count: int
    created_at: str


class KBDetailResponse(KBResponse):
    documents: List[DocumentItem] = []


class ChunkResponse(BaseModel):
    id: str
    document_id: str
    filename: str
    chunk_index: int
    chunk_text: str
    char_count: int
    node_id: Optional[str] = None
    created_at: str


class DocumentDetailResponse(BaseModel):
    kb_id: str
    document_id: str
    filename: str
    total_chunks: int
    chunks: List[ChunkResponse]


class DocumentUploadResponse(BaseModel):
    message: str
    kb_id: str
    document_id: str
    filename: str
    chunking_type: str
    chunk_count: int


class DocumentDeleteResponse(BaseModel):
    message: str
    kb_id: str
    document_id: str
    deleted_chunks_count: int


class KBDeleteResponse(BaseModel):
    message: str
    kb_id: str


class KBSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Search query string")
    top_k: int = Field(default=5, ge=1, le=50, description="Number of results to retrieve")


class SearchResultItem(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    chunk_index: int
    text: str
    score: float


class KBSearchResponse(BaseModel):
    query: str
    kb_id: str
    total_results: int
    results: List[SearchResultItem]
