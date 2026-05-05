from pydantic import BaseModel, Field


class BadgeInfo(BaseModel):
    label: str
    color: str
    bg: str
    text: str


class TrendInfo(BaseModel):
    index: int
    growth: float
    history: list[int]
    is_estimated: bool | None = False


# --- INPUT SCHEMAS ---


class KeywordDeepScanRequest(BaseModel):
    keyword: str = Field(..., description="Từ khóa cần quét sâu")


class KeywordAnalysisRequest(BaseModel):
    seed_keyword: str | None = None
    mode: str = "FULL"  # FULL, SCRAPE, ANALYZE
    keyword_list: list[str] | None = None
    ranks: dict | None = None
    provider: str = "google"
    model: str | None = None
    disable_ai: bool = False
    enable_cpc: bool = False
    api_keys: dict | None = None


# --- OUTPUT SCHEMAS ---


class KeywordAnalysisResult(BaseModel):
    keyword: str
    popularity: int
    difficulty: int
    efficiency: float
    cpc: float
    intent: str
    badge: BadgeInfo
    trend: TrendInfo | None = None
    total_results: int | None = 0


class Top10Item(BaseModel):
    rank: int
    domain: str
    is_authority: bool
    on_page_optimized: bool


class KeywordStats(BaseModel):
    total_results: str
    competitor_articles: str
    saturation_rate: str
    kd_score: int
    level: str
    color: str


class RelatedData(BaseModel):
    related_keywords: list[str]
    people_also_ask: list[str]
    long_tail_suggestions: list[str]


class KeywordDeepScanResponse(BaseModel):
    keyword_stats: KeywordStats
    related_data: RelatedData
    top_10_analysis: list[Top10Item]


class KeywordAnalysisResponse(BaseModel):
    results: list[KeywordAnalysisResult]
