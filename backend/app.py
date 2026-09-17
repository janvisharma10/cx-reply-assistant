import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx

from utilities.db_utilies import init_db
from utilities.config import settings
from modules.kb.routes import router as kb_router
from modules.agents.routes import router as agents_router

KEEP_ALIVE_URLS = [
    "https://cx-reply-assistant.onrender.com/health",
    "https://cx-reply-assistant-1.onrender.com/",
]


async def keep_alive_ping_loop():
    """Send 10 ping requests every 5 minutes to keep Render awake."""
    await asyncio.sleep(30)  # Initial 30s wait after startup
    while True:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                for req_num in range(1, 11):  # Burst of 10 requests
                    for url in KEEP_ALIVE_URLS:
                        try:
                            res = await client.get(url)
                            print(f"[Keep-Alive #{req_num}/10] Pinged {url} -> Status {res.status_code}")
                        except Exception as err:
                            print(f"[Keep-Alive #{req_num}/10] Ping failed for {url}: {err}")
                    if req_num < 10:
                        await asyncio.sleep(1)  # 1s space between requests in burst
        except Exception as e:
            print(f"[Keep-Alive] Loop error: {e}")

        # Wait 5 minutes (300 seconds) before next 10-request burst
        await asyncio.sleep(300)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    init_db()
    print("Knowledge Base & Agents Database initialized successfully.")

    # Start keep-alive ping background task
    ping_task = asyncio.create_task(keep_alive_ping_loop())

    yield

    # Shutdown logic
    ping_task.cancel()
    try:
        await ping_task
    except asyncio.CancelledError:
        pass
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
