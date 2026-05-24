from __future__ import annotations

import math
import re

from python_engine.schemas.job_schemas import JobTailorRequest, JobTailorResponse
from python_engine.services.litellm_client import litellm_client


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def _tokenize(text: str) -> set[str]:
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
    tokens = [tok.strip() for tok in cleaned.split() if len(tok.strip()) >= 4]
    return set(tokens)


def _cosine_like_score(resume_text: str, jd_text: str) -> float:
    resume_tokens = _tokenize(resume_text)
    jd_tokens = _tokenize(jd_text)
    if not resume_tokens or not jd_tokens:
        return 0.0
    overlap = len(resume_tokens.intersection(jd_tokens))
    denom = math.sqrt(len(resume_tokens) * len(jd_tokens))
    if denom <= 0:
        return 0.0
    return max(0.0, min(1.0, overlap / denom))


def _extract_suggestions(tailored_resume: str, jd_text: str) -> list[str]:
    jd_tokens = _tokenize(jd_text)
    resume_tokens = _tokenize(tailored_resume)
    missing = [tok for tok in jd_tokens if tok not in resume_tokens]
    top_missing = sorted(missing, key=len, reverse=True)[:5]

    suggestions: list[str] = []
    if top_missing:
        suggestions.append(
            "Bổ sung các từ khóa JD còn thiếu: " + ", ".join(top_missing)
        )
    if len(tailored_resume.split()) < 220:
        suggestions.append(
            "Tăng độ chi tiết cho kinh nghiệm gần nhất (thêm kết quả định lượng)."
        )
    if "impact" not in tailored_resume.lower() and "result" not in tailored_resume.lower():
        suggestions.append("Thêm 1-2 bullet theo format hành động -> kết quả đo được.")
    if not suggestions:
        suggestions.append("Nội dung đã bám JD tốt; ưu tiên rà soát câu chữ theo ngôn ngữ công ty.")
    return suggestions


def _build_system_prompt() -> str:
    return (
        "You are a senior resume tailoring assistant. "
        "Rewrite the resume to match the target JD while preserving factual integrity. "
        "Do not invent experience, years, or technologies not supported by the original resume."
    )


def _build_user_prompt(req: JobTailorRequest) -> str:
    return f"""
Input Resume:
{req.resume_text}

Target Job Description:
{req.jd_text}

Task:
1) Rewrite the resume to align with the JD language and priorities.
2) Keep truthful claims only.
3) Keep concise professional tone.
4) Output plain text resume only (no markdown fences).
""".strip()


async def tailor_job_resume(req: JobTailorRequest) -> JobTailorResponse:
    generated = await litellm_client.generate(
        provider=req.provider,
        model_name=req.model_name,
        api_key=req.api_key,
        custom_base_url=req.custom_base_url,
        system_prompt=_build_system_prompt(),
        user_prompt=_build_user_prompt(req),
        temperature=0.35,
        max_tokens=2200,
    )
    tailored_resume = _normalize(generated)
    score = _cosine_like_score(tailored_resume, req.jd_text)
    match_score = round(score * 100, 2)
    suggestions = _extract_suggestions(tailored_resume, req.jd_text)
    return JobTailorResponse(
        tailored_resume=tailored_resume,
        match_score=match_score,
        suggestions=suggestions,
        diagnostics={
            "scoring_method": "token_cosine_baseline",
            "score_range": "0-100",
        },
    )
