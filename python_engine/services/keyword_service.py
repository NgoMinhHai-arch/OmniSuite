import asyncio
import contextlib
import json
import math
import random
import re
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from python_engine.core.config import get_settings
from python_engine.schemas.keyword_schemas import (
    BadgeInfo,
    KeywordAnalysisResult,
    KeywordDeepScanResponse,
    KeywordStats,
    RelatedData,
    Top10Item,
    TrendInfo,
)

try:
    from pytrends.request import TrendReq
except ImportError:
    TrendReq = None

settings = get_settings()
PLAYWRIGHT_HEADLESS = True

# --- ALPHABET BAITING ---
LATIN_ALPHABET = list("abcdefghijklmnopqrstuvwxyz")
VIETNAMESE_CHARS = ["ă", "â", "đ", "ê", "ô", "ơ", "ư"]
FULL_ALPHABET = LATIN_ALPHABET + VIETNAMESE_CHARS

AUTHORITY_DOMAINS = [
    "shopee.vn",
    "lazada.vn",
    "tiki.vn",
    "facebook.com",
    "youtube.com",
    "tiktok.com",
    "vnexpress.net",
    "dantri.com.vn",
    "tuoitre.vn",
    "wikipedia.org",
    "kenh14.vn",
    "zingnews.vn",
    "vietnamnet.vn",
    "thanhnien.vn",
    "baomoi.com",
    "genk.vn",
    "ictnews.vietnamnet.vn",
]


class UniversalIntentManager:
    def __init__(self):
        self.providers = {
            "google": {
                "base_url": "https://generativelanguage.googleapis.com/v1beta",
                "default": "gemini-1.5-flash",
            },
            "openai": {"base_url": "https://api.openai.com/v1", "default": "gpt-4o-mini"},
            "groq": {
                "base_url": "https://api.groq.com/openai/v1",
                "default": "llama-3.3-70b-versatile",
            },
            "claude": {
                "base_url": "https://api.anthropic.com/v1",
                "default": "claude-3-5-sonnet-latest",
            },
            "deepseek": {"base_url": "https://api.deepseek.com/v1", "default": "deepseek-chat"},
            "openrouter": {"base_url": "https://openrouter.ai/api/v1", "default": "openai/gpt-4o-mini"},
            # Ollama: OpenAI-compatible /v1; base_url chỉ là placeholder, runtime
            # sẽ chuẩn hoá theo api_keys["ollama_base_url"] hoặc settings.OLLAMA_BASE_URL.
            "ollama": {"base_url": "http://localhost:11434/v1", "default": "llama3.2"},
        }
        self.model_cache = {}

    @staticmethod
    def _resolve_ollama_v1_base(custom_base_url: str | None) -> str:
        """Chuẩn hoá origin Ollama (local hoặc tunnel) → base /v1."""
        raw = (custom_base_url or settings.OLLAMA_BASE_URL or "http://localhost:11434").strip()
        raw = raw.rstrip("/")
        if not raw:
            return "http://localhost:11434/v1"
        # Loại bỏ các đuôi user hay dán nhầm.
        for tail in ("/v1/chat/completions", "/api/tags"):
            if raw.lower().endswith(tail):
                raw = raw[: -len(tail)]
                break
        if raw.lower().endswith("/v1"):
            return raw
        return f"{raw}/v1"

    async def _auto_select_model(
        self, provider: str, api_key: str, custom_base_url: str | None = None
    ):
        """Tự động tìm model mới nhất từ API của Provider"""
        import time

        now = time.time()
        cache_key = f"{provider}|{custom_base_url or ''}" if provider == "ollama" else provider
        if cache_key in self.model_cache:
            model, expiry = self.model_cache[cache_key]
            if now < expiry:
                return model
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                if provider == "google":
                    url = f"{self.providers['google']['base_url']}/models?key={api_key}"
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        modelsData = resp.json().get("models", [])
                        flash_models = [
                            m["name"].replace("models/", "")
                            for m in modelsData
                            if "gemini" in m["name"] and "flash" in m["name"]
                        ]
                        if flash_models:
                            best = sorted(flash_models, reverse=True)[0]
                            self.model_cache[cache_key] = (best, now + 3600)
                            return best
                elif provider == "ollama":
                    # Ưu tiên /api/tags (Ollama native), fallback /v1/models cho tunnel.
                    base_v1 = self._resolve_ollama_v1_base(custom_base_url)
                    origin = base_v1[: -len("/v1")] if base_v1.endswith("/v1") else base_v1
                    headers: dict[str, str] = {}
                    if api_key and api_key != "ollama":
                        headers["Authorization"] = f"Bearer {api_key}"
                    try:
                        resp = await client.get(f"{origin}/api/tags", headers=headers)
                        if resp.status_code == 200:
                            tagged = [
                                m.get("name") or m.get("model")
                                for m in (resp.json().get("models") or [])
                            ]
                            tagged = [m for m in tagged if m]
                            if tagged:
                                best = tagged[0]
                                self.model_cache[cache_key] = (best, now + 600)
                                return best
                    except Exception:
                        pass
                    try:
                        resp = await client.get(f"{base_v1}/models", headers=headers)
                        if resp.status_code == 200:
                            ids = [
                                m.get("id") for m in (resp.json().get("data") or []) if m.get("id")
                            ]
                            if ids:
                                best = ids[0]
                                self.model_cache[cache_key] = (best, now + 600)
                                return best
                    except Exception:
                        pass
        except Exception:
            pass
        return self.providers.get(provider, {}).get("default", "gpt-4")

    async def get_intents_batch(
        self,
        keywords: list[str],
        provider: str,
        model: str | None = None,
        api_keys: dict | None = None,
    ) -> dict[str, str]:
        if provider not in self.providers:
            return {kw: "I" for kw in keywords}

        api_key = None
        custom_base_url: str | None = None
        if api_keys:
            key_map = {
                "google": "gemini",
                "openai": "openai",
                "groq": "groq",
                "claude": "claude",
                "deepseek": "deepseek",
                "openrouter": "openrouter",
                "ollama": "ollama",
            }
            api_key = api_keys.get(key_map.get(provider, ""), "")
            if provider == "ollama":
                # Frontend gửi kèm `ollama_base_url` để định tuyến local/tunnel.
                custom_base_url = api_keys.get("ollama_base_url") or None

        if not api_key:
            if provider == "google":
                api_key = settings.GEMINI_API_KEY
            elif provider == "openai":
                api_key = settings.OPENAI_API_KEY
            elif provider == "groq":
                api_key = settings.GROQ_API_KEY
            elif provider == "claude":
                api_key = settings.CLAUDE_API_KEY
            elif provider == "deepseek":
                api_key = settings.DEEPSEEK_API_KEY
            elif provider == "openrouter":
                api_key = settings.OPENROUTER_API_KEY
            elif provider == "ollama":
                api_key = settings.OLLAMA_API_KEY

        if provider == "ollama":
            # Local Ollama không cần Bearer thật; SDK chấp nhận placeholder "ollama".
            api_key = (api_key or "ollama").strip() or "ollama"
        elif not api_key:
            return {kw: "I" for kw in keywords}

        selected_model = model or await self._auto_select_model(provider, api_key, custom_base_url)

        system_prompt = (
            "Phân tích ý định tìm kiếm (Search Intent) của danh sách từ khóa. "
            "CHỈ được phép trả về DUY NHẤT 1 ký tự đại diện cho mỗi từ khóa: [I, N, C, T].\n"
            "1. I (Informational): Tìm kiến thức, hướng dẫn, mẹo.\n"
            "2. N (Navigational): Tìm thương hiệu, website hoặc trang cụ thể.\n"
            "3. C (Commercial): So sánh, Review, đang cân nhắc mua hàng.\n"
            "4. T (Transactional): Mua hàng, đã sẵn sàng chi tiền.\n"
            'Luôn trả về định dạng JSON: [{"keyword": "...", "intent": "I"}]'
        )

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                if provider == "google":
                    url = (
                        f"{self.providers['google']['base_url']}/models/{selected_model}:"
                        f"generateContent?key={api_key}"
                    )
                    payload = {
                        "contents": [
                            {
                                "parts": [
                                    {"text": (f"{system_prompt}\nKeywords: {json.dumps(keywords)}")}
                                ]
                            }
                        ]
                    }
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                        return self._parse_json_res(text)
                elif provider == "claude":
                    url = f"{self.providers['claude']['base_url']}/messages"
                    headers = {
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    }
                    payload = {
                        "model": selected_model,
                        "max_tokens": 4096,
                        "system": system_prompt,
                        "messages": [{"role": "user", "content": json.dumps(keywords)}],
                    }
                    resp = await client.post(url, headers=headers, json=payload)
                    if resp.status_code == 200:
                        text = resp.json()["content"][0]["text"]
                        return self._parse_json_res(text)
                else:  # OpenAI, Groq, DeepSeek, OpenRouter, Ollama
                    if provider == "ollama":
                        base = self._resolve_ollama_v1_base(custom_base_url)
                    else:
                        base = self.providers[provider]["base_url"]
                    url = f"{base}/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    }
                    if provider == "openrouter":
                        headers["HTTP-Referer"] = "http://localhost:3000"
                        headers["X-Title"] = "OmniSuite AI"
                    payload: dict = {
                        "model": selected_model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": json.dumps(keywords)},
                        ],
                    }
                    # Ollama bản cũ chưa hỗ trợ response_format=json_object;
                    # đa số model llama3.x vẫn trả JSON khi prompt rõ ràng.
                    if provider != "ollama":
                        payload["response_format"] = {"type": "json_object"}
                    resp = await client.post(url, headers=headers, json=payload)
                    if resp.status_code == 200:
                        text = resp.json()["choices"][0]["message"]["content"]
                        return self._parse_json_res(text)
        except Exception as e:
            print(f"AI Intent Error ({provider}): {str(e)}")

        return {kw: "I" for kw in keywords}

    def _parse_json_res(self, text: str) -> dict[str, str]:
        try:
            text = re.sub(r"```json|```", "", text).strip()
            data = json.loads(text)
            if isinstance(data, dict):
                for k in ["keywords", "results", "data"]:
                    if k in data:
                        data = data[k]
                        break
            return {item["keyword"]: item.get("intent", "I") for item in data if "keyword" in item}
        except Exception:
            return {}


def classify_intent_regex(keyword: str):
    """Xác định Intent mặc định dựa trên Regex (fallback)"""
    kw = keyword.lower()
    if any(w in kw for w in ["giá", "mua", "bán", "rẻ", "chính hãng", "shop", "order"]):
        return "T"
    if any(w in kw for w in ["review", "top", "tốt nhất", "so sánh", "đánh giá"]):
        return "C"
    if any(w in kw for w in ["official", "website", "login", "trang chủ"]):
        return "N"
    return "I"


intent_manager = UniversalIntentManager()


class TrendsService:
    def __init__(self):
        self.pytrends = None
        if TrendReq:
            with contextlib.suppress(BaseException):
                self.pytrends = TrendReq(hl="vi-VN", tz=420, timeout=(10, 25))

    async def get_trends(self, keywords: list[str]) -> dict[str, TrendInfo]:
        if not self.pytrends:
            return {}
        try:
            import time as _time

            # Google Trends limit 5 keywords
            safe_kw = keywords[:5]

            # Running in thread because pytrends is sync, with retry logic
            def fetch_with_retry():
                df = None
                for attempt in range(3):
                    try:
                        self.pytrends.build_payload(
                            kw_list=safe_kw, timeframe="today 12-m", geo="VN"
                        )
                        df = self.pytrends.interest_over_time()
                        if df is not None and not df.empty:
                            return df
                    except Exception as e:
                        print(f"Pytrends attempt {attempt + 1}/3 failed: {e}")
                        if attempt < 2:
                            _time.sleep(5)
                return df

            df = await asyncio.to_thread(fetch_with_retry)
            results = {}
            if df is not None and not df.empty:
                for kw in safe_kw:
                    if kw in df.columns:
                        series = [int(x) for x in df[kw].tolist()]
                        if len(series) >= 6:
                            # So sánh trung bình 3 tháng cuối vs 3 tháng đầu
                            recent = sum(series[-3:]) / 3
                            older = sum(series[:3]) / 3
                            growth = round(((recent - older) / (older or 1)) * 100, 1)
                        elif len(series) > 1:
                            current = series[-1]
                            prev = series[-2]
                            growth = round(((current - prev) / (prev or 1)) * 100, 1)
                        else:
                            growth = 0.0
                        current_index = series[-1] if series else 0
                        results[kw] = TrendInfo(
                            index=int(current_index), growth=growth, history=series
                        )
            return results
        except Exception as e:
            print(f"Pytrends fatal error: {e}")
            return {}

    def generate_estimated_trend(self, keyword: str, popularity: float) -> TrendInfo:
        random.seed(keyword)
        history = []
        base = max(10, min(90, popularity))
        for i in range(12):
            noise = random.randint(-15, 15)
            wave = math.sin(i * 0.5) * 10
            val = int(max(5, min(100, base + wave + noise)))
            history.append(val)
        growth = (
            round(((history[-1] - history[-2]) / (history[-2] or 1)) * 100, 1)
            if len(history) > 1
            else 0
        )
        return TrendInfo(index=history[-1], growth=growth, history=history, is_estimated=True)


trends_service = TrendsService()


async def get_autocomplete_suggestions(seed: str) -> dict[str, dict]:
    results = {seed.lower().strip(): {"rank": 0}}
    bait_queries = [seed]

    # 1. Alphabet baiting
    for char in FULL_ALPHABET:
        bait_queries.append(f"{seed} {char}")

    # 2. Prefix baiting (Smart)
    prefixes = [
        "mua",
        "giá",
        "cách",
        "review",
        "so sánh",
        "tốt nhất",
        "top",
        "nên",
        "có nên",
        "tại sao",
        "bao nhiêu",
        "ở đâu",
        "kinh nghiệm",
        "hướng dẫn",
        "đánh giá",
    ]
    for prefix in prefixes:
        bait_queries.append(f"{prefix} {seed}")

    # 3. Suffix baiting
    suffixes = [
        "giá rẻ",
        "tốt nhất",
        "ở đâu",
        "loại nào tốt",
        "bao nhiêu tiền",
        "chính hãng",
        "uy tín",
        "cho người mới",
        "2024",
        "2025",
    ]
    for suffix in suffixes:
        bait_queries.append(f"{seed} {suffix}")

    # 4. Question baiting
    questions = [f"{seed} là gì", f"{seed} như thế nào", f"làm sao {seed}", f"khi nào {seed}"]
    bait_queries.extend(questions)

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
    }
    async with httpx.AsyncClient(timeout=10, headers=headers) as client:
        # Xử lý theo batch nhỏ để tránh block (Google nhạy cảm với tần suất yêu cầu)
        batch_size = 5
        for i in range(0, len(bait_queries), batch_size):
            batch = bait_queries[i : i + batch_size]
            tasks = []
            for q in batch:
                tasks.append(
                    client.get(
                        "https://suggestqueries.google.com/complete/search",
                        params={"output": "chrome", "hl": "vi", "q": q},
                    )
                )

            responses = await asyncio.gather(*tasks, return_exceptions=True)
            for _idx, resp in enumerate(responses):
                if isinstance(resp, httpx.Response) and resp.status_code == 200:
                    try:
                        suggestions = resp.json()[1]
                        for rank, suggestion in enumerate(suggestions[:5]):
                            kw = suggestion.lower().strip()
                            if kw not in results or rank + 1 < results[kw]["rank"]:
                                results[kw] = {"rank": rank + 1}
                    except Exception:
                        continue
    return results


async def get_search_results_count(keyword: str) -> int:
    """Lấy số lượng kết quả tìm kiếm (Allintitle) để tính KD"""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
    }
    try:
        url = f"https://www.google.com/search?q={quote_plus(keyword)}&hl=vi"
        async with httpx.AsyncClient(headers=headers, timeout=15, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                result_stats = soup.find("div", {"id": "result-stats"})
                if result_stats:
                    text = result_stats.get_text()
                    numbers = re.findall(r"[\d.]+", text.replace(",", ""))
                    if numbers:
                        total_str = numbers[0].replace(".", "")
                        return int(total_str)
    except Exception:
        pass
    return random.randint(50000, 150000)  # Fallback ngẫu nhiên nếu bị chặn


def calc_pop(trend_index: float, google_results: int) -> float:
    """POP — Popularity: Pytrends chiếm 70%, số kết quả Google chiếm 30%"""
    trend_score = (trend_index / 100) * 70
    result_score = min(math.log10(max(google_results, 1)) / 10, 1) * 30
    return round(trend_score + result_score, 1)


def calc_kd(google_results: int, trend_index: float) -> float:
    """KD — Keyword Difficulty: Số kết quả chiếm 60%, Trend chiếm 40%"""
    result_score = min(math.log10(max(google_results, 1)) / 10, 1) * 60
    trend_score = (trend_index / 100) * 40
    return round(result_score + trend_score, 1)


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


def _intent_score(intent: str) -> float:
    if intent == "T":
        return 10.0
    if intent == "C":
        return 8.0
    if intent == "I":
        return 5.0
    return 5.0


def _word_score(keyword: str) -> float:
    word_count = len(keyword.split())
    if word_count <= 2:
        return 3.0
    if word_count == 3:
        return 6.0
    if 4 <= word_count <= 5:
        return 10.0
    if word_count == 6:
        return 8.0
    return 5.0


def calc_ei(
    *,
    kd: float,
    pop: float,
    trend_index: float,
    total_results: int,
    trend_growth: float,
    intent: str,
    cpc: float,
    keyword: str,
    log_min: float,
    log_max: float,
    cpc_max: float,
) -> float:
    """
    EI thang 0-10 theo công thức:
    EI = (KD_score × 0.25) + (POP_score × 0.20) + (TrendIndex_score × 0.15)
         + (Volume_score × 0.15) + (TrendGrowth_score × 0.10)
         + (Intent_score × 0.10) + (CPC_score × 0.03) + (SoTu_score × 0.02)
    """
    kd_score = _clamp((100 - kd) / 10, 0, 10)
    pop_score = _clamp(pop / 10, 0, 10)
    trend_index_score = _clamp(trend_index / 10, 0, 10)

    if log_max > log_min:
        log_value = math.log(max(total_results, 1))
        volume_score = (1 - ((log_value - log_min) / (log_max - log_min))) * 10
    else:
        volume_score = 10.0
    volume_score = _clamp(volume_score, 0, 10)

    clamped_growth = _clamp(trend_growth, -100, 150)
    trend_growth_score = ((clamped_growth + 100) / 250) * 10
    trend_growth_score = _clamp(trend_growth_score, 0, 10)

    intent_score = _intent_score(intent)

    if cpc_max > 0:
        cpc_score = (math.log(1 + max(cpc, 0)) / math.log(1 + cpc_max)) * 10
    else:
        cpc_score = 0.0
    cpc_score = _clamp(cpc_score, 0, 10)

    so_tu_score = _word_score(keyword)

    ei = (
        (kd_score * 0.25)
        + (pop_score * 0.20)
        + (trend_index_score * 0.15)
        + (volume_score * 0.15)
        + (trend_growth_score * 0.10)
        + (intent_score * 0.10)
        + (cpc_score * 0.03)
        + (so_tu_score * 0.02)
    )
    return round(_clamp(ei, 0, 10), 2)


async def get_proxy_cpc_score(keyword: str, api_key: str = None) -> float:
    """
    Tính điểm Proxy CPC từ SerpAPI dựa trên Shopping và Ads count.
    Sử dụng httpx để gọi API đồng bộ với context async của engine.
    """
    score = 0.5
    serpapi_key = api_key or settings.SERPAPI_KEY

    if not serpapi_key:
        return score

    try:
        url = "https://serpapi.com/search"
        params = {"q": keyword, "api_key": serpapi_key, "engine": "google", "gl": "vn", "hl": "vi"}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()

                # Điều kiện 1: Check Shopping
                if "shopping_results" in data or "inline_shopping" in data:
                    score += 1.5

                # Điều kiện 2: Check Text Ads
                ads = data.get("ads", [])
                if not ads:
                    # Fallback check count if array is missing but count exists
                    ads_count = data.get("search_information", {}).get("ads_count", 0)
                else:
                    ads_count = len(ads)

                score += ads_count * 0.3
    except Exception as e:
        print(f"SerpAPI Error for Proxy CPC: {e}")

    return min(score, 3.0)


def get_efficiency_badge(ei: float) -> BadgeInfo:
    if ei >= 6.5:
        return BadgeInfo(label="Nên sử dụng", color="green", bg="emerald", text="white")
    if ei >= 5.0:
        return BadgeInfo(label="Nên xem xét", color="yellow", bg="amber", text="black")
    if ei >= 3.5:
        return BadgeInfo(label="Nên tham khảo", color="orange", bg="orange", text="white")
    return BadgeInfo(label="Bỏ qua", color="red", bg="rose", text="white")


async def analyze_keywords_advanced(
    seed_keyword: str | None = None,
    mode: str = "FULL",
    keyword_list: list[str] | None = None,
    ranks: dict | None = None,
    provider: str = "google",
    model: str | None = None,
    disable_ai: bool = False,
    enable_cpc: bool = False,
    api_keys: dict | None = None,
) -> list[KeywordAnalysisResult]:

    final_keywords = []
    final_ranks = ranks or {}

    if mode == "ANALYZE" and keyword_list:
        final_keywords = keyword_list
    else:
        suggestions = await get_autocomplete_suggestions(seed_keyword or "")
        final_keywords = list(suggestions.keys())
        final_ranks = {k: v["rank"] for k, v in suggestions.items()}

    if not final_keywords:
        return []

    # 1. AI Intent
    ai_intents = {}
    if not disable_ai:
        ai_intents = await intent_manager.get_intents_batch(
            final_keywords[:50], provider, model, api_keys
        )

    # 4. Trends (fetch for all, generate estimated for the rest)
    trends = await trends_service.get_trends(final_keywords[:10])

    # 5. Search Results Count (Parallel for top keywords)
    search_counts = {}
    top_for_stats = final_keywords[:15]  # Chỉ quét top để tránh bị Google Block
    tasks = [get_search_results_count(kw) for kw in top_for_stats]
    counts_res = await asyncio.gather(*tasks)
    for i, kw in enumerate(top_for_stats):
        search_counts[kw] = counts_res[i]

    # 6. Pre-calculate base metrics for EI normalization over full dataset
    base_metrics = []
    for kw in final_keywords:
        # Get trend info (real or estimated)
        trend_info = trends.get(kw)
        if not trend_info:
            # Need a base pop estimate for generating estimated trend
            rank = final_ranks.get(kw, 10)
            base_pop = ((11 - min(rank, 10)) ** 2 / 100) * 85 + 15
            trend_info = trends_service.generate_estimated_trend(kw, base_pop)

        trend_index = trend_info.index  # 0-100 from Pytrends or estimated
        google_results = search_counts.get(kw, 0)

        # Fallback: nếu không có google_results, ước lượng từ rank
        if google_results <= 0:
            rank = final_ranks.get(kw, 10)
            wc = len(kw.split())
            # Từ khóa ngắn = nhiều kết quả hơn, rank thấp = phổ biến hơn
            google_results = int(10 ** (4 + max(0, 3 - wc) + max(0, 5 - rank) * 0.3))

        pop = calc_pop(trend_index, google_results)
        kd = calc_kd(google_results, trend_index)
        cpc_value = 0.5
        if enable_cpc:
            cpc_value = await get_proxy_cpc_score(kw, api_keys.get("serpapi") if api_keys else None)

        intent = ai_intents.get(kw) or classify_intent_regex(kw)
        base_metrics.append(
            {
                "keyword": kw,
                "trend_info": trend_info,
                "trend_index": trend_index,
                "trend_growth": trend_info.growth,
                "google_results": google_results,
                "pop": pop,
                "kd": kd,
                "cpc": cpc_value,
                "intent": intent,
            }
        )

    # Dataset-level normalization params
    total_results_values = [max(int(item["google_results"]), 1) for item in base_metrics] or [1]
    log_values = [math.log(v) for v in total_results_values]
    log_min = min(log_values)
    log_max = max(log_values)
    cpc_max = max((float(item["cpc"]) for item in base_metrics), default=0.0)

    # 7. Final EI + badge classification
    results = []
    for item in base_metrics:
        ei = calc_ei(
            kd=item["kd"],
            pop=item["pop"],
            trend_index=item["trend_index"],
            total_results=item["google_results"],
            trend_growth=item["trend_growth"],
            intent=item["intent"],
            cpc=item["cpc"],
            keyword=item["keyword"],
            log_min=log_min,
            log_max=log_max,
            cpc_max=cpc_max,
        )

        results.append(
            KeywordAnalysisResult(
                keyword=item["keyword"],
                popularity=int(item["pop"]),
                difficulty=int(item["kd"]),
                efficiency=ei,
                cpc=item["cpc"],
                intent=item["intent"],
                badge=get_efficiency_badge(ei),
                trend=item["trend_info"],
                total_results=item["google_results"],
            )
        )

    return results


# Existing Deep Scan logic remain for compatibility
async def deep_scan_keyword(keyword: str) -> KeywordDeepScanResponse:
    """Quét chuyên sâu: Top 10, PAA, và chỉ số KD thực tế"""
    print(f"🔍 Deep Scanning: {keyword}")

    async with async_playwright() as p:
        # Sử dụng trình duyệt thật để tránh block và lấy được PAA (render bằng JS)
        browser = await p.chromium.launch(headless=PLAYWRIGHT_HEADLESS)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        # 1. Lấy kết quả tìm kiếm thông thường
        search_url = f"https://www.google.com/search?q={quote_plus(keyword)}&hl=vi"
        await page.goto(search_url, wait_until="networkidle")

        content = await page.content()
        soup = BeautifulSoup(content, "html.parser")

        # 2. Phân tích Top 10
        top_10 = []
        search_results = soup.select("div.g")
        for i, res in enumerate(search_results[:10]):
            link_tag = res.select_one("a")
            if not link_tag:
                continue

            url = link_tag.get("href", "")
            domain = ""
            if url.startswith("http"):
                domain = url.split("/")[2].replace("www.", "")

            title_tag = res.select_one("h3")
            title = title_tag.get_text() if title_tag else ""

            # Kiểm tra On-page cơ bản
            on_page = keyword.lower() in title.lower()
            is_auth = any(auth in domain for auth in AUTHORITY_DOMAINS)

            top_10.append(
                Top10Item(
                    rank=i + 1, domain=domain, is_authority=is_auth, on_page_optimized=on_page
                )
            )

        # 3. Lấy People Also Ask
        paa = []
        paa_elements = soup.select("div.related-question-pair span")
        for el in paa_elements[:5]:
            q = el.get_text().strip()
            if q and q not in paa:
                paa.append(q)

        # 4. Lấy Related Keywords từ dưới trang
        related = []
        # Tùy vào giao diện Google có thể thay đổi
        related_elements = soup.select("div.BNeawe.s3v9rd.AP7Wnd")
        if not related_elements:
            # Fallback cho giao diện mới
            related_elements = soup.select("div.fP9Sbe")

        for el in related_elements[:8]:
            text = el.get_text().strip()
            if text and text.lower() != keyword.lower():
                related.append(text)

        # 5. Lấy tổng số kết quả
        total_results_str = "100.000"
        result_stats = soup.select_one("#result-stats")
        if result_stats:
            match = re.search(r"([0-9.,]+)", result_stats.text.replace("\xa0", " "))
            if match:
                total_results_str = match.group(1).replace(",", ".").strip()

        # 6. Tính toán KD Score thực tế hơn (Dựa trên Top 10)
        # KD = (Số authority trong Top 10 * 7) + (Số trang tối ưu On-page * 3)
        auth_count = sum(1 for item in top_10 if item.is_authority)
        opt_count = sum(1 for item in top_10 if item.on_page_optimized)
        kd_score = min(99, (auth_count * 7) + (opt_count * 3) + random.randint(0, 5))

        level = "Dễ"
        color = "#10b981"
        if kd_score > 70:
            level = "Rất khó"
            color = "#ef4444"
        elif kd_score > 50:
            level = "Khó"
            color = "#f59e0b"
        elif kd_score > 30:
            level = "Trung bình"
            color = "#3b82f6"

        await browser.close()

    return KeywordDeepScanResponse(
        keyword_stats=KeywordStats(
            total_results=total_results_str,
            competitor_articles=str(max(5, len(search_results))),
            saturation_rate=f"{round(opt_count / 10 * 100, 1)}%" if search_results else "0%",
            kd_score=kd_score,
            level=level,
            color=color,
        ),
        related_data=RelatedData(
            related_keywords=related[:5],
            people_also_ask=paa,
            long_tail_suggestions=[keyword + " giá rẻ", keyword + " tốt nhất"],
        ),
        top_10_analysis=top_10,
    )
