import io
import os
import re
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
from pypdf import PdfReader
import chromadb
from chromadb.config import Settings as ChromaSettings
from sqlalchemy.orm import Session

# LlamaIndex Imports
from llama_index.core import Document
from llama_index.core.node_parser import (
    SentenceSplitter,
    TokenTextSplitter,
    SemanticSplitterNodeParser,
)
from llama_index.embeddings.openai import OpenAIEmbedding

from utilities.config import settings
from utilities.db_utilies import (
    KnowledgeBaseModel,
    create_kb_table,
    drop_kb_table,
    insert_kb_chunks_batch,
    get_kb_documents,
    get_kb_document_chunks,
    delete_kb_document_chunks,
    get_kb_total_chunks,
    sanitize_table_name,
)
from modules.kb.schema import ChunkingConfig, ChunkingType


class LlamaKBEngine:
    def __init__(self):
        # 1. Persistent ChromaDB Client
        persist_dir = Path(settings.CHROMA_PERSIST_DIR).resolve()
        persist_dir.mkdir(parents=True, exist_ok=True)
        self.chroma_client = chromadb.PersistentClient(
            path=str(persist_dir),
            settings=ChromaSettings(anonymized_telemetry=False)
        )

        # 2. Embedding Model — all values sourced from .env
        # Uses OPENROUTER_BASE_URL + OPENROUTER_API_KEY + EMBEDDING_MODEL
        self.embed_model = OpenAIEmbedding(
            api_base=settings.OPENROUTER_BASE_URL,
            api_key=settings.OPENROUTER_API_KEY,
            model_name=settings.EMBEDDING_MODEL,
        )

        # 3. Upload directory
        self.upload_dir = Path(settings.UPLOAD_DIR).resolve()
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def _sanitize_collection_name(self, kb_id: str) -> str:
        """Chroma requires collection names: 3-63 chars, alphanumeric, underscores or hyphens."""
        clean = re.sub(r"[^a-zA-Z0-9_-]", "_", kb_id.strip())
        col_name = f"kb_{clean}"
        if len(col_name) > 63:
            col_name = col_name[:63]
        return col_name

    def _get_or_create_collection(self, kb_id: str):
        col_name = self._sanitize_collection_name(kb_id)
        return self.chroma_client.get_or_create_collection(
            name=col_name,
            metadata={"hnsw:space": "cosine"}
        )

    def _get_node_parser(
        self,
        chunking_type: str,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        buffer_size: Optional[int] = None,
        breakpoint_percentile_threshold: Optional[int] = None
    ):
        """Instantiate appropriate LlamaIndex text splitter based on chunking configuration."""
        strat = (chunking_type or "sentence").lower()
        if strat == "token":
            return TokenTextSplitter(
                chunk_size=chunk_size or 200,
                chunk_overlap=chunk_overlap or 30
            )
        elif strat == "semantic":
            return SemanticSplitterNodeParser(
                buffer_size=buffer_size or 1,
                breakpoint_percentile_threshold=breakpoint_percentile_threshold or 95,
                embed_model=self.embed_model
            )
        else:
            # Default: sentence splitting
            return SentenceSplitter(
                chunk_size=chunk_size or 800,
                chunk_overlap=chunk_overlap or 150
            )

    # --------------------------------------------------------------------------
    # 1. Knowledge Base Management
    # --------------------------------------------------------------------------
    def create_kb(
        self,
        name: str,
        description: Optional[str],
        chunking_config: ChunkingConfig,
        db: Session,
        kb_id: Optional[str] = None
    ) -> KnowledgeBaseModel:
        """
        Create a new Knowledge Base:
        1. Automatically generates a clean, unique ID (e.g., 'kb_support_a1b2c3d4').
        2. Dynamically creates an independent table whose name is this generated ID.
        3. Initializes dedicated ChromaDB collection.
        4. Registers master record in 'knowledge_bases' table with chunking configuration.
        5. Returns the created record with the generated ID for client usage.
        """
        if not kb_id:
            # Auto-generate unique ID: clean prefix from name + 8-char random hex
            slug = re.sub(r"[^a-zA-Z0-9]+", "_", name.lower().strip()).strip("_")
            short_slug = slug[:20] if slug else "kb"
            kb_id = f"kb_{short_slug}_{uuid.uuid4().hex[:8]}"
        else:
            kb_id = sanitize_table_name(kb_id)

        existing = db.query(KnowledgeBaseModel).filter(KnowledgeBaseModel.id == kb_id).first()
        if existing:
            # Append extra salt if collision
            kb_id = f"{kb_id}_{uuid.uuid4().hex[:4]}"

        # 1. Create independent table named by ID
        create_kb_table(kb_id, db)

        # 2. Initialize Chroma vector collection
        self._get_or_create_collection(kb_id)

        # 3. Register in master table
        c_type = chunking_config.chunking_type.value if hasattr(chunking_config.chunking_type, 'value') else str(chunking_config.chunking_type)
        kb_record = KnowledgeBaseModel(
            id=kb_id,
            name=name,
            description=description or "",
            chunking_type=c_type,
            chunking_strategy=c_type,
            chunk_size=chunking_config.chunk_size,
            chunk_overlap=chunking_config.chunk_overlap,
            buffer_size=chunking_config.buffer_size,
            breakpoint_percentile_threshold=chunking_config.breakpoint_percentile_threshold,
            embedding_model=settings.EMBEDDING_MODEL
        )
        db.add(kb_record)
        db.commit()
        db.refresh(kb_record)
        return kb_record

    def list_kbs(self, db: Session) -> List[Dict[str, Any]]:
        """List all knowledge bases along with their document count and chunk count."""
        kbs = db.query(KnowledgeBaseModel).order_by(KnowledgeBaseModel.created_at.desc()).all()
        result = []
        for kb in kbs:
            docs = get_kb_documents(kb.id, db)
            chunk_count = get_kb_total_chunks(kb.id, db)
            result.append({
                "id": kb.id,
                "name": kb.name,
                "description": kb.description,
                "chunking_config": {
                    "chunking_type": kb.chunking_type,
                    "chunk_size": kb.chunk_size,
                    "chunk_overlap": kb.chunk_overlap,
                    "buffer_size": kb.buffer_size,
                    "breakpoint_percentile_threshold": kb.breakpoint_percentile_threshold
                },
                "embedding_model": kb.embedding_model,
                "document_count": len(docs),
                "chunk_count": chunk_count,
                "created_at": kb.created_at
            })
        return result

    def get_kb(self, kb_id: str, db: Session) -> Dict[str, Any]:
        """Retrieve details of a single KB with its document listings."""
        kb = db.query(KnowledgeBaseModel).filter(KnowledgeBaseModel.id == kb_id).first()
        if not kb:
            raise KeyError(f"Knowledge Base '{kb_id}' not found.")

        docs = get_kb_documents(kb_id, db)
        chunk_count = get_kb_total_chunks(kb_id, db)
        return {
            "id": kb.id,
            "name": kb.name,
            "description": kb.description,
            "chunking_config": {
                "chunking_type": kb.chunking_type,
                "chunk_size": kb.chunk_size,
                "chunk_overlap": kb.chunk_overlap,
                "buffer_size": kb.buffer_size,
                "breakpoint_percentile_threshold": kb.breakpoint_percentile_threshold
            },
            "embedding_model": kb.embedding_model,
            "document_count": len(docs),
            "chunk_count": chunk_count,
            "created_at": kb.created_at,
            "documents": docs
        }

    def delete_kb(self, kb_id: str, db: Session) -> bool:
        """
        Delete a Knowledge Base completely:
        1. Drop its independent database table.
        2. Delete its ChromaDB persistent collection.
        3. Delete any physical files stored for this KB.
        4. Remove entry from master 'knowledge_bases' table.
        """
        kb = db.query(KnowledgeBaseModel).filter(KnowledgeBaseModel.id == kb_id).first()
        if not kb:
            raise KeyError(f"Knowledge Base '{kb_id}' not found.")

        # Cleanup physical files
        docs = get_kb_documents(kb_id, db)
        for doc in docs:
            p = doc.get("file_path")
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass

        # 1. Drop independent table
        drop_kb_table(kb_id, db)

        # 2. Delete Chroma collection
        col_name = self._sanitize_collection_name(kb_id)
        try:
            self.chroma_client.delete_collection(col_name)
        except Exception as e:
            print(f"Notice: Chroma collection {col_name} delete error: {e}")

        # 3. Delete registry record
        db.delete(kb)
        db.commit()
        return True

    # --------------------------------------------------------------------------
    # 2. Document Upload & Ingestion with LlamaIndex
    # --------------------------------------------------------------------------
    def extract_text_from_pdf(self, file_bytes: bytes) -> str:
        """Extract clean text content from PDF bytes using pypdf."""
        reader = PdfReader(io.BytesIO(file_bytes))
        pages_text: List[str] = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                cleaned = re.sub(r"[ \t]+", " ", t.strip())
                if cleaned:
                    pages_text.append(cleaned)

        full_text = "\n\n".join(pages_text).strip()
        if not full_text:
            raise ValueError("The uploaded PDF does not contain extractable text.")
        return full_text

    def upload_document_to_kb(
        self,
        kb_id: str,
        filename: str,
        file_bytes: bytes,
        db: Session
    ) -> Dict[str, Any]:
        """
        Ingest a PDF document into a specific Knowledge Base:
        1. Verifies KB exists.
        2. Extracts text.
        3. Chunks using LlamaIndex node parser tailored to the KB's chunking_config.
        4. Embeds & indexes into the KB's Chroma collection.
        5. Inserts chunk records into the KB's independent SQLite table.
        """
        kb = db.query(KnowledgeBaseModel).filter(KnowledgeBaseModel.id == kb_id).first()
        if not kb:
            raise KeyError(f"Knowledge Base '{kb_id}' not found.")

        document_id = str(uuid.uuid4())
        file_path = self.upload_dir / f"{kb_id}_{document_id}_{filename}"

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        try:
            # 1. Extract text
            full_text = self.extract_text_from_pdf(file_bytes)

            # 2. LlamaIndex Document
            llama_doc = Document(
                text=full_text,
                metadata={
                    "document_id": document_id,
                    "filename": filename,
                    "kb_id": kb_id
                }
            )

            # 3. LlamaIndex text splitter configured per KB strategy
            splitter = self._get_node_parser(
                chunking_type=kb.chunking_type,
                chunk_size=kb.chunk_size,
                chunk_overlap=kb.chunk_overlap,
                buffer_size=kb.buffer_size,
                breakpoint_percentile_threshold=kb.breakpoint_percentile_threshold
            )
            nodes = splitter.get_nodes_from_documents([llama_doc])
            if not nodes:
                raise ValueError("No text chunks could be produced from this PDF.")

            # 4. Embed chunks and store in ChromaDB with full metadata
            chroma_col = self._get_or_create_collection(kb_id)

            chroma_ids: List[str] = []
            chroma_embeddings: List[List[float]] = []
            chroma_documents: List[str] = []
            chroma_metadatas: List[Dict[str, Any]] = []
            chunks_data: List[Dict[str, Any]] = []

            for i, node in enumerate(nodes):
                chunk_text = node.get_content()
                chunk_id = f"{document_id}_chunk_{i}"
                node_id = node.node_id

                # Embed each chunk individually
                embedding = self.embed_model.get_text_embedding(chunk_text)

                chroma_ids.append(node_id)
                chroma_embeddings.append(embedding)
                chroma_documents.append(chunk_text)
                # Store attribution metadata explicitly so query results are complete
                chroma_metadatas.append({
                    "document_id": document_id,
                    "filename": filename,
                    "kb_id": kb_id,
                    "chunk_index": i,
                    "chunk_id": chunk_id
                })

                chunks_data.append({
                    "id": chunk_id,
                    "document_id": document_id,
                    "filename": filename,
                    "file_path": str(file_path),
                    "chunk_index": i,
                    "chunk_text": chunk_text,
                    "char_count": len(chunk_text),
                    "node_id": node_id
                })

            # Batch upsert into Chroma
            chroma_col.upsert(
                ids=chroma_ids,
                embeddings=chroma_embeddings,
                documents=chroma_documents,
                metadatas=chroma_metadatas
            )

            # 5. Insert chunk records into the KB's independent SQLite table
            insert_kb_chunks_batch(kb_id, chunks_data, db)

            return {
                "kb_id": kb_id,
                "document_id": document_id,
                "filename": filename,
                "chunking_type": kb.chunking_type,
                "chunk_count": len(nodes)
            }

        except Exception as e:
            if file_path.exists():
                try:
                    file_path.unlink()
                except OSError:
                    pass
            raise e

    # Alias for backward compatibility
    upload_file_to_kb = upload_document_to_kb

    # --------------------------------------------------------------------------
    # 3. Document Chunks & Cascade Deletion
    # --------------------------------------------------------------------------
    def get_document_chunks(self, kb_id: str, document_id: str, db: Session) -> Dict[str, Any]:
        """Retrieve all chunks for a document from the KB's independent table."""
        kb = db.query(KnowledgeBaseModel).filter(KnowledgeBaseModel.id == kb_id).first()
        if not kb:
            raise KeyError(f"Knowledge Base '{kb_id}' not found.")

        chunks = get_kb_document_chunks(kb_id, document_id, db)
        if not chunks:
            raise KeyError(f"Document '{document_id}' not found in Knowledge Base '{kb_id}'.")

        return {
            "kb_id": kb_id,
            "document_id": document_id,
            "filename": chunks[0]["filename"],
            "total_chunks": len(chunks),
            "chunks": chunks
        }

    def delete_document_from_kb(self, kb_id: str, document_id: str, db: Session) -> int:
        """
        Delete a specific document from a Knowledge Base:
        1. Deletes all associated chunks from the KB's independent table in SQLite.
        2. Deletes all matching vectors from the KB's Chroma collection.
        3. Removes physical PDF from disk.
        Returns the number of deleted chunks.
        """
        kb = db.query(KnowledgeBaseModel).filter(KnowledgeBaseModel.id == kb_id).first()
        if not kb:
            raise KeyError(f"Knowledge Base '{kb_id}' not found.")

        chunks = get_kb_document_chunks(kb_id, document_id, db)
        if not chunks:
            raise KeyError(f"Document '{document_id}' not found in Knowledge Base '{kb_id}'.")

        # 1. Delete vectors from ChromaDB collection
        chroma_col = self._get_or_create_collection(kb_id)
        node_ids = [c["node_id"] for c in chunks if c.get("node_id")]
        try:
            if node_ids:
                chroma_col.delete(ids=node_ids)
            chroma_col.delete(where={"document_id": document_id})
        except Exception as e:
            print(f"Warning during Chroma document deletion: {e}")

        # 2. Delete physical file from disk
        docs = get_kb_documents(kb_id, db)
        for doc in docs:
            if doc["document_id"] == document_id:
                p = doc.get("file_path")
                if p and os.path.exists(p):
                    try:
                        os.remove(p)
                    except OSError:
                        pass

        # 3. Delete from KB's independent SQLite table
        deleted_count = delete_kb_document_chunks(kb_id, document_id, db)
        return deleted_count

    # Alias for backward compatibility
    delete_file_from_kb = delete_document_from_kb

    # --------------------------------------------------------------------------
    # 4. Semantic Search Query
    # --------------------------------------------------------------------------
    def query_kb(
        self,
        kb_id: str,
        query: str,
        top_k: int = 5,
        db: Optional[Session] = None
    ) -> List[Dict[str, Any]]:
        """
        Query the Knowledge Base using OpenRouter embeddings and ChromaDB vector search.
        Searches across all documents in the KB and automatically retrieves matching chunks with their document_id and filename.
        """
        chroma_col = self._get_or_create_collection(kb_id)
        if chroma_col.count() == 0:
            return []

        query_embedding = self.embed_model.get_text_embedding(query)

        query_kwargs: Dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": min(top_k, chroma_col.count()),
        }

        res = chroma_col.query(**query_kwargs)

        results: List[Dict[str, Any]] = []
        if not res or not res["ids"] or not res["ids"][0]:
            return results

        ids = res["ids"][0]
        distances = res.get("distances", [[]])[0] if res.get("distances") else []
        documents = res.get("documents", [[]])[0] if res.get("documents") else []
        metadatas = res.get("metadatas", [[]])[0] if res.get("metadatas") else []

        for i in range(len(ids)):
            dist = distances[i] if i < len(distances) else None
            score = max(0.0, min(1.0, 1.0 - dist)) if dist is not None else 1.0
            meta = metadatas[i] if i < len(metadatas) else {}
            chunk_text = documents[i] if i < len(documents) else ""

            results.append({
                "chunk_id": ids[i],
                "document_id": meta.get("document_id", ""),
                "filename": meta.get("filename", ""),
                "chunk_index": meta.get("chunk_index", 0),
                "text": chunk_text,
                "score": round(score, 4)
            })

        return results


# Global LlamaKBEngine instance
kb_engine = LlamaKBEngine()
