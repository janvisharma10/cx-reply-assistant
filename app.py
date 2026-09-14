from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from utilities.db_utilies import init_db
from utilities.config import settings
from modules.kb.routes import router as kb_router
from modules.agents.routes import router as agents_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    init_db()
    print("Knowledge Base & Agents Database initialized successfully.")
    yield
    # Shutdown logic if any
    print("Application shutting down.")


app = FastAPI(
    title="CX Reply Assistant - Knowledge Base & Agents API",
    description="API supporting Knowledge Base CRUD and Agno AI Agents with bound tools & reasoning.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Knowledge Base and Agents routers
app.include_router(kb_router, prefix="/api/v1")
app.include_router(agents_router, prefix="/api/v1")


@app.get("/", tags=["General"])
def root():
    return {
        "service": "CX Reply Assistant - Knowledge Base API",
        "status": "online",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "version": "1.0.0",
        "embedding_model": settings.EMBEDDING_MODEL,
        "default_llm_model": settings.DEFAULT_MODEL
    }


@app.get("/health", tags=["General"])
def health():
    return {
        "status": "healthy",
        "database": "connected",
        "embedding_model": settings.EMBEDDING_MODEL
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
