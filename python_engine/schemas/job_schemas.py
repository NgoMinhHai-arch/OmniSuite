from __future__ import annotations

from pydantic import BaseModel, Field


class JobTailorRequest(BaseModel):
    resume_text: str = Field(..., min_length=1)
    jd_text: str = Field(..., min_length=1)
    provider: str = "openai"
    model_name: str | None = None
    api_key: str | None = None
    custom_base_url: str | None = None


class JobTailorResponse(BaseModel):
    tailored_resume: str
    match_score: float = Field(..., ge=0, le=100)
    suggestions: list[str]
    diagnostics: dict[str, float | str] = {}
