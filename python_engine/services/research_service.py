from __future__ import annotations

import re
import time
from dataclasses import dataclass

import httpx

from python_engine.schemas.content_schemas import ResearchPayload, ResearchSource


@dataclass
class _CacheEntry:
    payload: ResearchPayload
    expires_at: float


class TavilyResearchService:
    def __init__(self) -> None:
        self._cache: dict[str, _CacheEntry] = {}
        self._ttl_seconds = 60 * 15

    @staticmethod
    def _normalize_query(query: str) -> str:
        return " ".join(query.strip().lower().split())

    @staticmethod
    def _clean_text(raw: str) -> str:
        return (
            raw.replace("\r", "\n")
            .replace("\t", " ")
            .replace("  ", " ")
            .strip()
        )

    @staticmethod
    def _strip_markup(raw: str) -> str:
        cleaned = raw
        cleaned = re.sub(r"!\[.*?\]\(.*?\)", "", cleaned)
        cleaned = re.sub(r"<img[^>]*>", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"<script[\s\S]*?<\/script>", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"<style[\s\S]*?<\/style>", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"<[^>]+>", "", cleaned)
        cleaned = re.sub(r"\[([^\]]*)\]\([^)]+\)", r"\1", cleaned)
        cleaned = re.sub(r"^https?:\/\/\S+$", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return TavilyResearchService._clean_text(cleaned)

    @staticmethod
    def _build_context(sources: list[ResearchSource], limit_chars: int = 7000) -> str:
        blocks = [f"[{s.title}] ({s.url})\n{s.snippet}" for s in sources]
        context = "\n\n---\n\n".join(blocks)
        if len(context) > limit_chars:
            context = f"{context[:limit_chars]}\n... [context truncated]"
        return context

    async def fetch(self, query: str, api_key: str | None) -> ResearchPayload:
        normalized = self._normalize_query(query)
        if not normalized or not api_key:
            return ResearchPayload(query=normalized or query, context="", sources=[])

        now = time.time()
        entry = self._cache.get(normalized)
        if entry and entry.expires_at > now:
            return entry.payload

        payload = {
            "api_key": api_key,
            "query": normalized,
            "search_depth": "advanced",
            "include_raw_content": True,
            "max_results": 6,
        }

        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post("https://api.tavily.com/search", json=payload)

        if response.status_code >= 400:
            return ResearchPayload(query=normalized, context="", sources=[])

        data = response.json()
        sources: list[ResearchSource] = []
        for result in data.get("results", []):
            title = self._clean_text(result.get("title", "")) or "Untitled"
            url = self._clean_text(result.get("url", ""))
            raw_content = result.get("raw_content") or result.get("content") or ""
            snippet = self._strip_markup(raw_content)
            if len(snippet) < 120 or not url:
                continue
            sources.append(ResearchSource(title=title, url=url, snippet=snippet[:1800]))

        research = ResearchPayload(
            query=normalized,
            context=self._build_context(sources),
            sources=sources,
        )
        self._cache[normalized] = _CacheEntry(payload=research, expires_at=now + self._ttl_seconds)
        return research


research_service = TavilyResearchService()

