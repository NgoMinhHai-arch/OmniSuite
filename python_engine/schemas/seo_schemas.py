from pydantic import BaseModel, ConfigDict, Field, HttpUrl

# --- SUB-COMPONENTS ---


class HeadingItem(BaseModel):
    tag: str = Field(..., json_schema_extra={"example": "h1"})
    text: str = Field(..., json_schema_extra={"example": "This is a heading"})


class ImageStat(BaseModel):
    total: int = 0
    missing_alt: int = 0
    missing_title: int = 0


class KeywordDensityResult(BaseModel):
    word: str
    count: int
    density: str


# --- INPUT SCHEMAS ---


class SeoAnalysisRequest(BaseModel):
    url: HttpUrl = Field(..., description="Target URL to analyze")
    keyword: str | None = Field(None, description="Primary keyword to audit against")


class KeywordExtractionRequest(BaseModel):
    url: str | None = None
    html: str | None = None
    title: str | None = None
    description: str | None = None


class ImproveSchemaRequest(BaseModel):
    raw_schema: str
    target_keyword: str
    target_domain: str
    validation_errors: str | None = None
    gemini_api_key: str | None = None


# --- OUTPUT SCHEMAS ---


class KeywordExtractionResponse(BaseModel):
    top_keywords: list[KeywordDensityResult]
    keywords_in_title: int
    keywords_in_meta: int


class SeoAnalysisResponse(BaseModel):
    title: str
    title_length: int
    description: str | None = None
    description_length: int = 0
    canonical: str | None = None
    robots: str | None = None
    h1: str | None = None
    word_count: int = 0
    headings: list[HeadingItem] = []
    image_stats: ImageStat = ImageStat()
    primary_keyword: str | None = None
    keyword_density: str | None = "0.00%"
    keywords_in_title: int = 0
    keywords_in_meta: int = 0
    top_keywords: list[KeywordDensityResult] = []
    schemas: list[str] = []
    schema_types: list[str] = []
    status_code: int = 200
    response_time_ms: float = 0.0

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Example Page",
                "title_length": 12,
                "word_count": 450,
                "keyword_density": "1.2%",
            }
        }
    )
