import re
import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy import (
    Column,
    String,
    Integer,
    Text,
    DateTime,
    create_engine,
    event,
    text
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from utilities.config import settings

# Create database engine
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)

# Enforce SQLite foreign keys
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if settings.DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class KnowledgeBaseModel(Base):
    """
    Master registry table for Knowledge Bases.
    Each Knowledge Base dynamically spawns its own independent table
    named after its `id` for storing its chunks and documents.
    """
    __tablename__ = "knowledge_bases"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    chunking_type = Column(String(50), default="sentence", nullable=True)
    chunking_strategy = Column(String(50), default="sentence", nullable=True)
    chunk_size = Column(Integer, default=800, nullable=True)
    chunk_overlap = Column(Integer, default=150, nullable=True)
    buffer_size = Column(Integer, default=1, nullable=True)
    breakpoint_percentile_threshold = Column(Integer, default=95, nullable=True)
    embedding_model = Column(String(100), default="text-embedding-3-small", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)


class AgentModel(Base):
    """
    Registry table for AI Agents built using Agno.
    Each agent stores LLM credentials (base_url, api_key, llm_name)
    and binds to specific Knowledge Bases via kb_ids.
    """
    __tablename__ = "agents"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    base_url = Column(String(500), nullable=False)
    api_key = Column(String(500), nullable=False)
    llm_name = Column(String(255), nullable=False)
    kb_ids = Column(Text, nullable=False, default="[]")  # JSON string of bound KB IDs
    guardrail_suite_id = Column(String(64), nullable=True, default="suite_standard_cx")  # Bound Guardrail Suite ID
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)


def sanitize_table_name(kb_id: str) -> str:
    """Validate and sanitize KB ID to ensure safe SQL table names."""
    sanitized = re.sub(r"[^a-zA-Z0-9_-]", "_", kb_id.strip())
    if not sanitized:
        raise ValueError("Invalid KB ID for table name.")
    return sanitized


def create_kb_table(kb_id: str, db: Session):
    """
    Dynamically create an independent table in the database whose table name is the KB ID.
    This table stores all files and chunks belonging strictly to this KB.
    """
    tbl = sanitize_table_name(kb_id)
    sql = f"""
    CREATE TABLE IF NOT EXISTS "{tbl}" (
        id VARCHAR(64) PRIMARY KEY,
        document_id VARCHAR(64) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        char_count INTEGER NOT NULL,
        node_id VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    db.execute(text(sql))
    # Create index on document_id for rapid queries and deletions
    idx_sql = f'CREATE INDEX IF NOT EXISTS "idx_{tbl}_document_id" ON "{tbl}" (document_id);'
    db.execute(text(idx_sql))
    db.commit()


def drop_kb_table(kb_id: str, db: Session):
    """Drop the independent table for a deleted KB."""
    tbl = sanitize_table_name(kb_id)
    sql = f'DROP TABLE IF EXISTS "{tbl}";'
    db.execute(text(sql))
    db.commit()


def insert_kb_chunks_batch(kb_id: str, chunks: List[Dict[str, Any]], db: Session):
    """Insert chunk records into the KB's independent table."""
    if not chunks:
        return
    tbl = sanitize_table_name(kb_id)
    sql = text(f"""
        INSERT INTO "{tbl}" (id, document_id, filename, file_path, chunk_index, chunk_text, char_count, node_id, created_at)
        VALUES (:id, :document_id, :filename, :file_path, :chunk_index, :chunk_text, :char_count, :node_id, :created_at)
    """)
    now = datetime.datetime.utcnow()
    params = [
        {
            "id": c["id"],
            "document_id": c.get("document_id") or c.get("file_id"),
            "filename": c["filename"],
            "file_path": c["file_path"],
            "chunk_index": c["chunk_index"],
            "chunk_text": c["chunk_text"],
            "char_count": c["char_count"],
            "node_id": c.get("node_id"),
            "created_at": now
        }
        for c in chunks
    ]
    db.execute(sql, params)
    db.commit()


def get_kb_documents(kb_id: str, db: Session) -> List[Dict[str, Any]]:
    """Retrieve distinct documents and their chunk counts from the KB's independent table."""
    tbl = sanitize_table_name(kb_id)
    sql = text(f"""
        SELECT document_id, filename, file_path, COUNT(id) as chunk_count, MIN(created_at) as created_at
        FROM "{tbl}"
        GROUP BY document_id, filename, file_path
        ORDER BY created_at DESC
    """)
    rows = db.execute(sql).fetchall()
    return [
        {
            "document_id": row[0],
            "file_id": row[0],  # Alias for compatibility
            "filename": row[1],
            "file_path": row[2],
            "chunk_count": row[3],
            "created_at": str(row[4])
        }
        for row in rows
    ]


def get_kb_document_chunks(kb_id: str, document_id: str, db: Session) -> List[Dict[str, Any]]:
    """Retrieve all chunks for a specific document from the KB's independent table."""
    tbl = sanitize_table_name(kb_id)
    sql = text(f"""
        SELECT id, document_id, filename, chunk_index, chunk_text, char_count, node_id, created_at
        FROM "{tbl}"
        WHERE document_id = :document_id
        ORDER BY chunk_index ASC
    """)
    rows = db.execute(sql, {"document_id": document_id}).fetchall()
    return [
        {
            "id": row[0],
            "document_id": row[1],
            "file_id": row[1],
            "filename": row[2],
            "chunk_index": row[3],
            "chunk_text": row[4],
            "char_count": row[5],
            "node_id": row[6],
            "created_at": str(row[7])
        }
        for row in rows
    ]


def delete_kb_document_chunks(kb_id: str, document_id: str, db: Session) -> int:
    """
    Delete all chunks associated with a specific document from the KB's independent table.
    Returns the number of chunks deleted.
    """
    tbl = sanitize_table_name(kb_id)
    count_sql = text(f'SELECT COUNT(id) FROM "{tbl}" WHERE document_id = :document_id')
    count = db.execute(count_sql, {"document_id": document_id}).scalar() or 0

    del_sql = text(f'DELETE FROM "{tbl}" WHERE document_id = :document_id')
    db.execute(del_sql, {"document_id": document_id})
    db.commit()
    return count


def get_kb_total_chunks(kb_id: str, db: Session) -> int:
    """Return total chunk count in this KB's independent table."""
    tbl = sanitize_table_name(kb_id)
    sql = text(f'SELECT COUNT(id) FROM "{tbl}"')
    try:
        return db.execute(sql).scalar() or 0
    except Exception:
        return 0


def init_db():
    """Create all master tables if they do not exist and ensure columns match schema."""
    Base.metadata.create_all(bind=engine)
    if settings.DATABASE_URL.startswith("sqlite"):
        try:
            with engine.connect() as conn:
                res = conn.execute(text("PRAGMA table_info(knowledge_bases)"))
                cols = [r[1] for r in res.fetchall()]
                if cols:
                    if "chunking_type" not in cols:
                        conn.execute(text("ALTER TABLE knowledge_bases ADD COLUMN chunking_type VARCHAR(50) DEFAULT 'sentence'"))
                    if "buffer_size" not in cols:
                        conn.execute(text("ALTER TABLE knowledge_bases ADD COLUMN buffer_size INTEGER DEFAULT 1"))
                    if "breakpoint_percentile_threshold" not in cols:
                        conn.execute(text("ALTER TABLE knowledge_bases ADD COLUMN breakpoint_percentile_threshold INTEGER DEFAULT 95"))
                    conn.commit()

                # Check agents table
                res_ag = conn.execute(text("PRAGMA table_info(agents)"))
                cols_ag = [r[1] for r in res_ag.fetchall()]
                if cols_ag:
                    if "guardrail_suite_id" not in cols_ag:
                        conn.execute(text("ALTER TABLE agents ADD COLUMN guardrail_suite_id VARCHAR(64) DEFAULT 'suite_standard_cx'"))
                    conn.commit()
        except Exception as e:
            print(f"Notice during schema check: {e}")


def get_db():
    """FastAPI dependency for obtaining a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
