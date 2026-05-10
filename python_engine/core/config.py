from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # FastAPI Config
    APP_NAME: str = "OmniSuite Python Engine"
    DEBUG: bool = False
    PORT: int = 8082

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
    # Giới hạn inference Ollama đồng thời (mặc định 1 — giảm spike VRAM/RAM khi nhiều tool/tab)
    OLLAMA_MAX_CONCURRENT: int = Field(default=1, ge=1, le=8)
    # Timeout HTTP tới Ollama (giây) — máy yếu có thể tăng
    OLLAMA_HTTP_TIMEOUT_SEC: float = Field(default=180.0, ge=30.0, le=600.0)
    # Thời gian Ollama daemon giữ model trong RAM/VRAM sau lần gọi cuối.
    # Mặc định OmniSuite = "30s" (cân bằng): gọi liên tiếp vẫn nhanh, idle thì tự nhả VRAM.
    # Đặt "0" để unload ngay sau mỗi inference; "5m" để giữ lâu hơn.
    OLLAMA_KEEP_ALIVE: str = Field(default="30s")
    # Cap context window (KV-cache) khi gọi Ollama. Nhiều model khai báo 128k mặc định
    # → KV-cache có thể đòi >10 GiB cho model 3B. OmniSuite cap về 4096 cho phép chạy
    # trên máy 8 GiB RAM. Đặt 0 để tôn trọng giá trị Modelfile, hoặc tăng nếu cần
    # prompt dài (8192/16384). Lưu ý: KV-cache scale tuyến tính với num_ctx.
    OLLAMA_NUM_CTX: int = Field(default=4096, ge=0, le=131072)
    SERPAPI_KEY: str = ""
    TAVILY_API_KEY: str = ""
    LITELLM_BASE_URL: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings():
    return Settings()
