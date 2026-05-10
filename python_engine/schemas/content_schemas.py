from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


PlatformPreset = Literal[
    "googleSeoLongForm",
    "facebookEngagement",
    "socialShort",
    "adCopy",
]
JobStatus = Literal["queued", "running", "completed", "failed", "cancelled"]


class ResearchSource(BaseModel):
    title: str
    url: str
    snippet: str


class ResearchPayload(BaseModel):
    query: str
    context: str
    sources: list[ResearchSource] = []


class ContentOutlineRequest(BaseModel):
    topic: str | None = None
    keyword: str
    secondaryKeywords: str | None = None
    masterContext: str | None = None
    framework: str = "Tự do"
    provider: str = "Gemini"
    modelName: str | None = None
    apiKey: str | None = None
    customBaseUrl: str | None = None
    tavilyApiKey: str | None = None
    platformPreset: PlatformPreset = "googleSeoLongForm"


class ContentOutlineResponse(BaseModel):
    outline: str
    tavilyContext: str
    research: ResearchPayload


class ContentSectionRequest(BaseModel):
    topic: str | None = None
    keyword: str
    secondaryKeywords: str | None = None
    sectionTitle: str
    sectionIndex: int
    totalSections: int
    masterContext: str | None = None
    framework: str = "Tự do"
    provider: str = "Gemini"
    modelName: str | None = None
    apiKey: str | None = None
    customBaseUrl: str | None = None
    tavilyApiKey: str | None = None
    tavilyContext: str | None = None
    platformPreset: PlatformPreset = "googleSeoLongForm"


class QualityIssue(BaseModel):
    type: Literal["duplicate", "missing_keyword", "structure", "style"]
    message: str
    severity: Literal["high", "medium", "low"]


class QualityReport(BaseModel):
    passed: bool
    issues: list[QualityIssue] = []


class BulkContentVariantRequest(BaseModel):
    keyword: str
    topic: str | None = None
    secondaryKeywords: str | None = None
    framework: str = "Tự do"
    platformPreset: PlatformPreset = "googleSeoLongForm"
    targetLength: int = Field(default=1200, ge=300, le=5000)


class BulkContentJobRequest(BaseModel):
    mode: Literal["single", "bulk"] = "bulk"
    provider: str = "Gemini"
    modelName: str | None = None
    apiKey: str | None = None
    tavilyApiKey: str | None = None
    customBaseUrl: str | None = None
    variants: list[BulkContentVariantRequest]


class BulkContentItemResult(BaseModel):
    keyword: str
    platformPreset: PlatformPreset
    outline: str
    article: str
    research: ResearchPayload
    quality: QualityReport


class JobProgress(BaseModel):
    completed: int = 0
    total: int = 0
    currentKeyword: str | None = None


class BulkContentJobStatus(BaseModel):
    id: str
    status: JobStatus
    progress: JobProgress
    error: str | None = None
    createdAt: datetime
    updatedAt: datetime
    results: list[BulkContentItemResult] = []

