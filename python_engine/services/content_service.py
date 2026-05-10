from __future__ import annotations

import re
from dataclasses import dataclass

from python_engine.schemas.content_schemas import (
    BulkContentItemResult,
    BulkContentVariantRequest,
    ContentOutlineRequest,
    ContentOutlineResponse,
    ContentSectionRequest,
    QualityIssue,
    QualityReport,
    ResearchPayload,
)
from python_engine.services.content_prompts import (
    SYSTEM_CORE,
    get_framework_prompt,
    get_platform_style_prompt,
)
from python_engine.services.litellm_client import litellm_client
from python_engine.services.research_service import research_service


@dataclass
class GenerationRuntime:
    provider: str
    model_name: str | None
    api_key: str | None
    custom_base_url: str | None
    tavily_api_key: str | None


def _parse_sections(outline_text: str) -> list[str]:
    sections: list[str] = []
    for line in outline_text.splitlines():
        match = re.match(r"^#{2,3}\s+(.+)$", line.strip())
        if match:
            title = match.group(1).strip()
            if title:
                sections.append(title)
    return sections


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _quality_check(article: str, keyword: str, sections: list[str]) -> QualityReport:
    issues: list[QualityIssue] = []
    article_normalized = _normalize_text(article)
    keyword_normalized = _normalize_text(keyword)

    if keyword_normalized and keyword_normalized not in article_normalized:
        issues.append(
            QualityIssue(
                type="missing_keyword",
                message="Từ khóa chính chưa xuất hiện rõ trong nội dung.",
                severity="high",
            )
        )

    if len(sections) < 3:
        issues.append(
            QualityIssue(
                type="structure",
                message="Outline có ít hơn 3 đề mục, chưa đủ chiều sâu.",
                severity="medium",
            )
        )

    paragraphs = [p for p in article.split("\n\n") if p.strip()]
    repeated = 0
    seen: set[str] = set()
    for p in paragraphs:
        normalized = _normalize_text(p)
        if len(normalized) < 80:
            continue
        key = normalized[:180]
        if key in seen:
            repeated += 1
        seen.add(key)
    if repeated > 0:
        issues.append(
            QualityIssue(
                type="duplicate",
                message="Nội dung có đoạn bị trùng ý, cần làm mới câu chữ.",
                severity="medium",
            )
        )

    if len(article.split()) < 500:
        issues.append(
            QualityIssue(
                type="style",
                message="Bài viết hơi ngắn cho dạng chuyên sâu, cân nhắc mở rộng ví dụ.",
                severity="low",
            )
        )
    return QualityReport(passed=len([i for i in issues if i.severity == "high"]) == 0, issues=issues)


def _build_outline_prompts(req: ContentOutlineRequest, research: ResearchPayload) -> tuple[str, str]:
    framework_hint = get_framework_prompt(req.framework)
    platform_hint = get_platform_style_prompt(req.platformPreset)
    system_prompt = (
        f"{SYSTEM_CORE}\n"
        f"Framework hint: {framework_hint}\n"
        f"Platform style: {platform_hint}\n"
        "Bắt buộc tạo outline dạng markdown với H2/H3, không viết lan man."
    )
    user_prompt = f"""
Chủ đề: {req.topic or req.keyword}
Từ khóa chính: {req.keyword}
Từ khóa phụ: {req.secondaryKeywords or "Tự đề xuất hợp lý"}
Dữ liệu nội bộ: {req.masterContext or "Không có"}

Research context:
{research.context or "Không có context ngoài"}

Yêu cầu:
- 4-8 H2
- Mỗi H2 có 2-4 H3
- Tập trung chiều sâu chuyên môn và intent tìm kiếm
- Trả về markdown, chỉ outline
"""
    return system_prompt, user_prompt


def _build_section_prompts(req: ContentSectionRequest, research_context: str) -> tuple[str, str]:
    framework_hint = get_framework_prompt(req.framework)
    platform_hint = get_platform_style_prompt(req.platformPreset)
    system_prompt = (
        f"{SYSTEM_CORE}\n"
        f"Framework hint: {framework_hint}\n"
        f"Platform style: {platform_hint}\n"
        "Viết section mạch lạc, tránh lặp ý, giữ văn phong tự nhiên."
    )
    user_prompt = f"""
Viết section cho bài:
- Chủ đề: {req.topic or req.keyword}
- Từ khóa chính: {req.keyword}
- Từ khóa phụ: {req.secondaryKeywords or "Không có"}
- Section title: {req.sectionTitle}
- Vị trí: {req.sectionIndex + 1}/{req.totalSections}
- Context nội bộ: {req.masterContext or "Không có"}

Research context:
{research_context or "Không có"}

Yêu cầu output markdown:
## {req.sectionTitle}

Viết nội dung chuyên sâu, ưu tiên dữ kiện thực tế, có thể dùng bullet nếu cần.
"""
    return system_prompt, user_prompt


async def generate_outline(req: ContentOutlineRequest) -> ContentOutlineResponse:
    research = await research_service.fetch(req.keyword, req.tavilyApiKey)
    system_prompt, user_prompt = _build_outline_prompts(req, research)
    outline = await litellm_client.generate(
        provider=req.provider,
        model_name=req.modelName,
        api_key=req.apiKey,
        custom_base_url=req.customBaseUrl,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.4,
        max_tokens=1400,
    )
    return ContentOutlineResponse(outline=outline.strip(), tavilyContext=research.context, research=research)


async def generate_section(req: ContentSectionRequest, research_context: str | None = None) -> str:
    context = research_context or req.tavilyContext or ""
    if not context and req.tavilyApiKey:
        context = (await research_service.fetch(req.keyword, req.tavilyApiKey)).context
    system_prompt, user_prompt = _build_section_prompts(req, context)
    return await litellm_client.generate(
        provider=req.provider,
        model_name=req.modelName,
        api_key=req.apiKey,
        custom_base_url=req.customBaseUrl,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.65,
        max_tokens=1800,
    )


async def generate_bulk_item(
    variant: BulkContentVariantRequest,
    runtime: GenerationRuntime,
) -> BulkContentItemResult:
    outline_req = ContentOutlineRequest(
        topic=variant.topic,
        keyword=variant.keyword,
        secondaryKeywords=variant.secondaryKeywords,
        framework=variant.framework,
        provider=runtime.provider,
        modelName=runtime.model_name,
        apiKey=runtime.api_key,
        customBaseUrl=runtime.custom_base_url,
        tavilyApiKey=runtime.tavily_api_key,
        platformPreset=variant.platformPreset,
    )
    outline_response = await generate_outline(outline_req)
    sections = _parse_sections(outline_response.outline)
    article_blocks = [f"# {variant.topic or variant.keyword}"]
    for idx, section in enumerate(sections):
        section_req = ContentSectionRequest(
            topic=variant.topic,
            keyword=variant.keyword,
            secondaryKeywords=variant.secondaryKeywords,
            sectionTitle=section,
            sectionIndex=idx,
            totalSections=len(sections),
            framework=variant.framework,
            provider=runtime.provider,
            modelName=runtime.model_name,
            apiKey=runtime.api_key,
            customBaseUrl=runtime.custom_base_url,
            tavilyApiKey=runtime.tavily_api_key,
            tavilyContext=outline_response.tavilyContext,
            platformPreset=variant.platformPreset,
        )
        article_blocks.append(await generate_section(section_req, outline_response.tavilyContext))
    article = "\n\n".join(article_blocks).strip()
    quality = _quality_check(article, variant.keyword, sections)
    return BulkContentItemResult(
        keyword=variant.keyword,
        platformPreset=variant.platformPreset,
        outline=outline_response.outline,
        article=article,
        research=outline_response.research,
        quality=quality,
    )

