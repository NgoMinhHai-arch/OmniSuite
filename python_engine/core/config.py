from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # FastAPI Config
    APP_NAME: str = "OmniSuite Python Engine"
    DEBUG: bool = False
    PORT: int = 8082

    # AI Keys (Loaded from .env)
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    CLAUDE_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    SERPAPI_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings():
    return Settings()
