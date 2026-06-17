import os
import warnings
from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_INTERNAL_TOKEN = "omnisuite_secret_token_123"


class Settings(BaseSettings):
    # FastAPI Config
    APP_NAME: str = "OmniSuite Python Engine"
    DEBUG: bool = False
    PORT: int = 8082
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/omnisuite"
    INTERNAL_TOKEN: str = DEFAULT_INTERNAL_TOKEN
    OMNISUITE_STRICT_SECURITY: bool = False

    # AI Keys (Loaded from .env)
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices(
            "GEMINI_API_KEY",
            "GOOGLE_API_KEY",
            "GOOGLE_GENERATIVE_AI_API_KEY",
        ),
    )
    GROQ_API_KEY: str = ""
    CLAUDE_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("CLAUDE_API_KEY", "ANTHROPIC_API_KEY"),
    )
    DEEPSEEK_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    # Remote Ollama endpoint (e.g. Colab tunnel), origin without /v1
    OLLAMA_BASE_URL: str = ""
    OLLAMA_API_KEY: str = ""
    # Giá»›i háº¡n inference Ollama Ä‘á»“ng thá»i (máº·c Ä‘á»‹nh 1 â€” giáº£m spike VRAM/RAM khi nhiá»u tool/tab)
    OLLAMA_MAX_CONCURRENT: int = Field(default=1, ge=1, le=8)
    # Timeout HTTP tá»›i Ollama (giÃ¢y) â€” mÃ¡y yáº¿u cÃ³ thá»ƒ tÄƒng
    OLLAMA_HTTP_TIMEOUT_SEC: float = Field(default=180.0, ge=30.0, le=600.0)
    # Thá»i gian Ollama daemon giá»¯ model trong RAM/VRAM sau láº§n gá»i cuá»‘i.
    # Máº·c Ä‘á»‹nh OmniSuite = "30s" (cÃ¢n báº±ng): gá»i liÃªn tiáº¿p váº«n nhanh, idle thÃ¬ tá»± nháº£ VRAM.
    # Äáº·t "0" Ä‘á»ƒ unload ngay sau má»—i inference; "5m" Ä‘á»ƒ giá»¯ lÃ¢u hÆ¡n.
    OLLAMA_KEEP_ALIVE: str = Field(default="30s")
    # Cap context window (KV-cache) khi gá»i Ollama. Nhiá»u model khai bÃ¡o 128k máº·c Ä‘á»‹nh
    # â†’ KV-cache cÃ³ thá»ƒ Ä‘Ã²i >10 GiB cho model 3B. OmniSuite cap vá» 4096 cho phÃ©p cháº¡y
    # trÃªn mÃ¡y 8 GiB RAM. Äáº·t 0 Ä‘á»ƒ tÃ´n trá»ng giÃ¡ trá»‹ Modelfile, hoáº·c tÄƒng náº¿u cáº§n
    # prompt dÃ i (8192/16384). LÆ°u Ã½: KV-cache scale tuyáº¿n tÃ­nh vá»›i num_ctx.
    OLLAMA_NUM_CTX: int = Field(default=4096, ge=0, le=131072)
    SERPAPI_KEY: str = ""
    TAVILY_API_KEY: str = ""
    LITELLM_BASE_URL: str = ""
    # 9Router local proxy (OpenAI-compatible). Origin without /v1 â€” https://github.com/decolua/9router
    NINEROUTER_BASE_URL: str = Field(
        default="",
        validation_alias=AliasChoices("NINEROUTER_BASE_URL", "NINE_ROUTER_BASE_URL"),
    )
    NINEROUTER_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("NINEROUTER_API_KEY", "NINE_ROUTER_API_KEY"),
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


def _is_production_environment() -> bool:
    return (os.environ.get("NODE_ENV") or "").strip().lower() == "production"


def validate_internal_token_settings(settings: Settings) -> Settings:
    strict = bool(settings.OMNISUITE_STRICT_SECURITY) or _is_production_environment()
    token = (settings.INTERNAL_TOKEN or "").strip()

    if strict and (not token or token == DEFAULT_INTERNAL_TOKEN):
        raise ValueError(
            "INTERNAL_TOKEN must be set to a non-default value when NODE_ENV=production "
            "or OMNISUITE_STRICT_SECURITY=1."
        )

    if not token:
        settings.INTERNAL_TOKEN = DEFAULT_INTERNAL_TOKEN
        token = settings.INTERNAL_TOKEN

    if token == DEFAULT_INTERNAL_TOKEN:
        warnings.warn(
            "Python Engine is using the default INTERNAL_TOKEN. This is allowed only for local development. "
            "Set INTERNAL_TOKEN explicitly before enabling strict mode or production.",
            RuntimeWarning,
            stacklevel=2,
        )

    return settings


@lru_cache
def get_settings():
    return validate_internal_token_settings(Settings())
