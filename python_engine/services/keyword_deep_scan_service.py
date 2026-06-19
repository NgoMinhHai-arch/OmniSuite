import contextlib
import random
import re
from pathlib import Path
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup

try:
    from playwright.async_api import async_playwright
except ImportError:
    async_playwright = None

from python_engine.schemas.keyword_schemas import (
    KeywordDeepScanResponse,
    KeywordStats,
    RelatedData,
    Top10Item,
)

PLAYWRIGHT_HEADLESS = True

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

CHROMIUM_EXECUTABLE_ENV_KEYS = (
    "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH",
    "CHROMIUM_EXECUTABLE_PATH",
    "CHROME_PATH",
    "OMNISUITE_CHROME_PATH",
)


def _existing_file(value: str | None) -> str | None:
    raw = (value or "").strip().strip('"').strip("'")
    if not raw:
        return None
    with contextlib.suppress(OSError):
        p = Path(raw).expanduser()
        if p.is_file():
            return str(p)
    return None


def _default_browser_candidates() -> list[str]:
    import os
    import sys

    if sys.platform == "win32":
        roots = [
            os.environ.get("LOCALAPPDATA"),
            os.environ.get("PROGRAMFILES"),
            os.environ.get("PROGRAMFILES(X86)"),
        ]
        out: list[str] = []
        for root in [item for item in roots if item]:
            out.extend(
                [
                    str(Path(root) / "Google" / "Chrome" / "Application" / "chrome.exe"),
                    str(Path(root) / "Microsoft" / "Edge" / "Application" / "msedge.exe"),
                ]
            )
        return out
    if sys.platform == "darwin":
        return [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
    return [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/snap/bin/chromium",
        "/usr/bin/microsoft-edge",
    ]


def resolve_chromium_executable_path() -> str | None:
    import os

    for key in CHROMIUM_EXECUTABLE_ENV_KEYS:
        found = _existing_file(os.environ.get(key))
        if found:
            return found
    for candidate in _default_browser_candidates():
        found = _existing_file(candidate)
        if found:
            return found
    return None


def _install_hint() -> str:
    return (
        "Playwright Chromium chưa sẵn sàng. Bấm lại 01_START_OMNISUITE.bat để hệ thống tự sửa. "
        "Nếu mạng chặn tải Chromium, đặt PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH tới chrome.exe hoặc msedge.exe có sẵn."
    )


def _install_hint() -> str:
    return (
        "Playwright Chromium chua san sang. Bam lai 01_START_OMNISUITE.bat de tu cai lai. "
        "Neu mang chan tai Chromium, dat PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH toi chrome.exe hoac msedge.exe co san."
    )


def _looks_like_missing_browser_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return any(
        marker in text
        for marker in (
            "executable doesn't exist",
            "playwright install",
            "playwright chromium",
            "chrome-headless-shell",
            "browserType.launch".lower(),
            "host system is missing dependencies",
        )
    )


def _headers() -> dict[str, str]:
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    }


async def _fetch_google_html_httpx(keyword: str) -> str:
    url = f"https://www.google.com/search?q={quote_plus(keyword)}&hl=vi"
    async with httpx.AsyncClient(headers=_headers(), timeout=20, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text


async def _fetch_google_html_playwright(keyword: str) -> str:
    if async_playwright is None:
        raise RuntimeError(_install_hint())

    executable_path = resolve_chromium_executable_path()
    launch_options: dict = {"headless": PLAYWRIGHT_HEADLESS}
    if executable_path:
        launch_options["executable_path"] = executable_path

    browser = None
    context = None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(**launch_options)
            context = await browser.new_context(user_agent=_headers()["User-Agent"], locale="vi-VN")
            page = await context.new_page()
            search_url = f"https://www.google.com/search?q={quote_plus(keyword)}&hl=vi"
            await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
            with contextlib.suppress(Exception):
                await page.wait_for_load_state("networkidle", timeout=8000)
            return await page.content()
    finally:
        if context is not None:
            with contextlib.suppress(Exception):
                await context.close()
        if browser is not None:
            with contextlib.suppress(Exception):
                await browser.close()


async def _fetch_serp_html(keyword: str) -> str:
    try:
        return await _fetch_google_html_playwright(keyword)
    except Exception as exc:
        if _looks_like_missing_browser_error(exc):
            # Browser bundle missing is common on fresh Windows machines. Use HTTP fallback so the tool
            # still returns a useful estimate instead of dying like a dramatic toaster.
            with contextlib.suppress(Exception):
                return await _fetch_google_html_httpx(keyword)
            raise RuntimeError(_install_hint()) from exc
        with contextlib.suppress(Exception):
            return await _fetch_google_html_httpx(keyword)
        raise


def _parse_top_10(soup: BeautifulSoup, keyword: str) -> list[Top10Item]:
    top_10: list[Top10Item] = []
    candidates = soup.select("div.g") or soup.select("div[data-sokoban-container] div")
    seen_domains: set[str] = set()

    for res in candidates:
        if len(top_10) >= 10:
            break
        link_tag = res.select_one("a[href^='http']")
        title_tag = res.select_one("h3")
        if not link_tag or not title_tag:
            continue
        url = str(link_tag.get("href") or "")
        domain = ""
        if url.startswith("http"):
            with contextlib.suppress(Exception):
                domain = url.split("/")[2].replace("www.", "")
        if not domain or domain in seen_domains:
            continue
        seen_domains.add(domain)
        title = title_tag.get_text(" ", strip=True)
        on_page = keyword.lower() in title.lower()
        is_auth = any(auth in domain for auth in AUTHORITY_DOMAINS)
        top_10.append(
            Top10Item(
                rank=len(top_10) + 1,
                domain=domain,
                is_authority=is_auth,
                on_page_optimized=on_page,
            )
        )
    return top_10


def _parse_paa(soup: BeautifulSoup) -> list[str]:
    selectors = [
        "div.related-question-pair span",
        "div[jsname] span",
        "span.CSkcDe",
    ]
    paa: list[str] = []
    for selector in selectors:
        for el in soup.select(selector):
            text = el.get_text(" ", strip=True)
            if text.endswith("?") and text not in paa:
                paa.append(text)
            if len(paa) >= 5:
                return paa
    return paa


def _parse_related(soup: BeautifulSoup, keyword: str) -> list[str]:
    related: list[str] = []
    selectors = ["div.BNeawe.s3v9rd.AP7Wnd", "div.fP9Sbe", "a[href*='/search?q='] span"]
    for selector in selectors:
        for el in soup.select(selector):
            text = el.get_text(" ", strip=True)
            if 3 <= len(text) <= 120 and text.lower() != keyword.lower() and text not in related:
                related.append(text)
            if len(related) >= 8:
                return related
    return related


def _parse_total_results(soup: BeautifulSoup) -> str:
    result_stats = soup.select_one("#result-stats")
    if result_stats:
        match = re.search(r"([0-9.,]+)", result_stats.get_text(" ", strip=True).replace("\xa0", " "))
        if match:
            return match.group(1).replace(",", ".").strip()
    return "100.000"


def _level_for_kd(kd_score: int) -> tuple[str, str]:
    if kd_score > 70:
        return "Rất khó", "#ef4444"
    if kd_score > 50:
        return "Khó", "#f59e0b"
    if kd_score > 30:
        return "Trung bình", "#3b82f6"
    return "Dễ", "#10b981"


async def deep_scan_keyword(keyword: str) -> KeywordDeepScanResponse:
    clean_keyword = (keyword or "").strip()
    if not clean_keyword:
        raise ValueError("Keyword không được để trống")

    html = await _fetch_serp_html(clean_keyword)
    soup = BeautifulSoup(html, "html.parser")

    top_10 = _parse_top_10(soup, clean_keyword)
    paa = _parse_paa(soup)
    related = _parse_related(soup, clean_keyword)
    total_results_str = _parse_total_results(soup)

    auth_count = sum(1 for item in top_10 if item.is_authority)
    opt_count = sum(1 for item in top_10 if item.on_page_optimized)
    kd_score = min(99, (auth_count * 7) + (opt_count * 3) + random.randint(0, 5))
    level, color = _level_for_kd(kd_score)

    competitor_count = max(5, len(top_10))
    saturation = f"{round(opt_count / 10 * 100, 1)}%" if top_10 else "0%"

    return KeywordDeepScanResponse(
        keyword_stats=KeywordStats(
            total_results=total_results_str,
            competitor_articles=str(competitor_count),
            saturation_rate=saturation,
            kd_score=kd_score,
            level=level,
            color=color,
        ),
        related_data=RelatedData(
            related_keywords=related[:5],
            people_also_ask=paa,
            long_tail_suggestions=[
                f"{clean_keyword} giá rẻ",
                f"{clean_keyword} tốt nhất",
                f"kinh nghiệm {clean_keyword}",
            ],
        ),
        top_10_analysis=top_10,
    )
