import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_PATH = Path(__file__).resolve().parent / ".env"

class Settings(BaseSettings):
    # LLM credentials — loaded from .env, no hardcoded defaults
    OPENROUTER_API_KEY: str
    OPENROUTER_BASE_URL: str
    DEFAULT_MODEL: str
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    DATABASE_URL: str = "sqlite:///./kb_database.db"
    CHROMA_PERSIST_DIR: str = "./chroma_data"
    UPLOAD_DIR: str = "./uploads"

    # Chunking configurations
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 150

    # Guardrails configuration (Llama Guard 4 via OpenRouter)
    LLAMA_GUARD_MODEL: str = "meta-llama/llama-guard-4-12b"
    LLAMA_GUARD_API_KEY: str = ""
    LLAMA_GUARD_BASE_URL: str = ""
    ENABLE_GUARDRAILS: bool = True

    @property
    def effective_guardrail_api_key(self) -> str:
        return self.LLAMA_GUARD_API_KEY if self.LLAMA_GUARD_API_KEY else self.OPENROUTER_API_KEY

    @property
    def effective_guardrail_base_url(self) -> str:
        return self.LLAMA_GUARD_BASE_URL if self.LLAMA_GUARD_BASE_URL else self.OPENROUTER_BASE_URL

    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure necessary directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
