import re
import time

import httpx
import numpy as np
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from python_engine.schemas.seo_schemas import (
    HeadingItem,
    ImageStat,
    KeywordDensityResult,
    SeoAnalysisResponse,
)
from sklearn.feature_extraction.text import TfidfVectorizer

# --- STOPWORDS CONFIG ---
VIETNAMESE_STOPWORDS = {
    "và",
    "của",
    "là",
    "có",
    "trong",
    "cho",
    "các",
    "người",
    "đã",
    "được",
    "với",
    "không",
    "một",
    "này",
    "thì",
    "mà",
    "đó",
    "như",
    "nó",
    "nhưng",
    "tôi",
    "ra",
    "để",
    "lên",
    "tại",
    "về",
    "vào",
    "vẫn",
    "đang",
    "cũng",
    "nhiều",
    "hơn",
    "chưa",
    "khi",
    "cần",
    "muốn",
    "biết",
    "cùng",
    "qua",
    "sau",
    "trước",
    "nay",
    "hết",
    "chỉ",
    "lại",
    "thấy",
    "làm",
    "nên",
    "theo",
    "bằng",
    "khác",
    "nếu",
    "hay",
    "ví",
    "dụ",
    "tên",
    "nghĩa",
    "mình",
    "kia",
    "đâu",
    "nào",
    "sao",
    "bao",
    "nhiêu",
    "thế",
    "nâng",
    "cao",
    "hiệu",
    "quả",
    "sự",
    "những",
    "việc",
    "chúng",
    "ta",
    "họ",
    "anh",
    "chị",
    "em",
    "ông",
    "bà",
    "đây",
    "ai",
    "gì",
    "bấy",
    "cái",
    "chiếc",
    "cuốn",
    "quyển",
    "tờ",
    "pho",
    "bức",
    "đóa",
    "ngôi",
    "vị",
    "con",
    "vừa",
    "mới",
    "xong",
    "rồi",
    "lúc",
    "ngoài",
    "trên",
    "dưới",
    "giữa",
    "phía",
    "bên",
    "đất",
    "nước",
    "nhà",
    "cửa",
}
ENGLISH_STOPWORDS = {
    "the",
    "and",
    "is",
    "of",
    "to",
    "in",
    "it",
    "that",
    "on",
    "was",
    "for",
    "as",
    "are",
    "with",
    "be",
    "this",
    "at",
    "by",
    "not",
    "from",
    "had",
    "but",
    "which",
    "if",
    "or",
    "have",
    "you",
    "they",
    "we",
    "he",
    "she",
    "his",
    "her",
    "their",
    "our",
    "its",
    "so",
    "up",
    "can",
    "about",
    "your",
    "who",
    "whom",
    "whose",
    "what",
    "where",
    "when",
    "why",
    "how",
    "all",
    "any",
    "both",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "too",
    "very",
    "will",
    "just",
    "should",
    "now",
}
COMBINED_STOPWORDS = list(VIETNAMESE_STOPWORDS.union(ENGLISH_STOPWORDS))


async def extract_keywords_jina(url: str) -> list[str]:
    """
    Extracts high-precision keywords using Jina Reader API to get clean Markdown.
    Applies weighting based on Markdown headers (#) and bold text (**).
    """
    if not url:
        return []

    try:
        # 1. Fetch from Jina Reader
        jina_url = f"https://r.jina.ai/{url}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(jina_url)
            if response.status_code != 200:
                print(f"[EXTRACT_KEYWORDS_JINA] Failed: {response.status_code}")
                return []
            markdown_content = response.text

        # 2. Markdown Weighting Logic
        lines = markdown_content.split("\n")
        weighted_blocks = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Headers (lines starting with #) - Weight 4
            if line.startswith("#"):
                clean_h = line.lstrip("#").strip()
                weighted_blocks.append((clean_h + " ") * 4)
            else:
                # Find bold text (**text**) - Weight 2
                # Use regex to find all bold matches
                bolds = re.findall(r"\*\*(.*?)\*\*", line)
                if bolds:
                    weighted_blocks.append((" ".join(bolds) + " ") * 2)

                # Normal text - Weight 1
                weighted_blocks.append(line)

        # 3. Clean up Markdown markers to get pure text
        raw_weighted_text = " ".join(weighted_blocks)

        # Remove Markdown URLs/Links: [text](url) -> text
        # Regex to remove the (url) part of links and images
        clean_doc = re.sub(r"\]\([^\)]+\)", "] ", raw_weighted_text)

        # Remove raw http/https links
        clean_doc = re.sub(r"https?://[^\s]+", "", clean_doc)

        # Remove #, *, _, [, ], <, >
        clean_doc = re.sub(r"[#\*_\[\]<>]", " ", clean_doc)

        if not clean_doc.strip():
            return []

        # 4. TF-IDF NLP Processing
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 3),  # Catch multi-word keywords
            stop_words=COMBINED_STOPWORDS,
            token_pattern=r"(?u)\b\w\w+\b",  # Skip single characters
            max_features=1000,
        )

        matrix = vectorizer.fit_transform([clean_doc])
        features = vectorizer.get_feature_names_out()
        scores = matrix.toarray()[0]

        # 5. Return Top 5 clean keywords
        top_indices = np.argsort(scores)[::-1][:5]
        return [features[i].strip() for i in top_indices if scores[i] > 0]

    except Exception as e:
        print(f"[EXTRACT_KEYWORDS_JINA] Error: {e}")
        return []


def extract_keywords_weighted(html_content: str) -> list[str]:
    """
    Fallback HTML-based keyword extraction logic.
    """
    if not html_content or len(html_content.strip()) < 50:
        return []
    try:
        soup = BeautifulSoup(html_content, "lxml")
        for noise in soup.find_all(["script", "style", "nav", "footer", "header", "iframe"]):
            noise.decompose()
        weighted_blocks = []
        title = soup.title.get_text() if soup.title else ""
        meta_desc = soup.find("meta", attrs={"name": "description"})
        desc = meta_desc.get("content", "") if meta_desc else ""
        if title or desc:
            weighted_blocks.append(f"{title} {desc} " * 5)
        h1s = " ".join([h.get_text() for h in soup.find_all("h1")])
        if h1s:
            weighted_blocks.append(f"{h1s} " * 4)
        h23s = " ".join([h.get_text() for h in soup.find_all(["h2", "h3"])])
        if h23s:
            weighted_blocks.append(f"{h23s} " * 3)
        bolds = " ".join([b.get_text() for b in soup.find_all(["b", "strong"])])
        if bolds:
            weighted_blocks.append(f"{bolds} " * 2)
        weighted_blocks.append(soup.get_text(separator=" "))
        unified_doc = " ".join(weighted_blocks)
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 3),
            stop_words=COMBINED_STOPWORDS,
            token_pattern=r"(?u)\b\w\w+\b",
            max_features=1000,
        )
        matrix = vectorizer.fit_transform([unified_doc])
        features = vectorizer.get_feature_names_out()
        scores = matrix.toarray()[0]
        top_indices = np.argsort(scores)[::-1][:5]
        return [features[i].strip() for i in top_indices if scores[i] > 0]
    except Exception:
        return []


async def analyze_url(url: str, keyword: str = None) -> SeoAnalysisResponse:
    """
    Logic cào dữ liệu Async bằng Playwright.
    Duy trì tính độc lập hoàn toàn, không phụ thuộc vào FastAPI Router.
    """
    start_time = time.time()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        try:
            page = await browser.new_page()

            # Thêm timeout và xử lý lỗi cơ bản
            try:
                response = await page.goto(str(url), wait_until="domcontentloaded", timeout=45000)
                status_code = response.status if response else 0
                content = await page.content()
            except Exception as e:
                raise ValueError(f"Không thể truy cập URL: {str(e)}") from e

            soup = BeautifulSoup(content, "html.parser")
        finally:
            await browser.close()

    # --- TRÍCH XUẤT DỮ LIỆU ---
    title = soup.title.string.strip() if soup.title else "N/A"

    desc_tag = soup.find("meta", attrs={"name": "description"})
    description = desc_tag.get("content", "").strip() if desc_tag else ""

    canonical_tag = soup.find("link", rel="canonical")
    canonical = canonical_tag.get("href", "") if canonical_tag else ""

    robots_tag = soup.find("meta", attrs={"name": "robots"})
    robots = robots_tag.get("content", "") if robots_tag else "index, follow"

    # Headings
    headings = []
    for tag in ["h1", "h2", "h3"]:
        for h in soup.find_all(tag):
            txt = h.get_text(strip=True)
            if txt:
                headings.append(HeadingItem(tag=tag, text=txt))

    h1_text = next((h.text for h in headings if h.tag == "h1"), "")

    # Content & Word Count
    text_content = soup.get_text()
    clean_text = re.sub(r"\s+", " ", text_content).strip()
    words = re.findall(r"\w+", clean_text.lower())
    word_count = len(words)

    # --- REAL KEYWORD EXTRACTION (JINA PREFERRED) ---
    extracted_kws = await extract_keywords_jina(url)

    # Fallback to HTML-based if Jina failed
    if not extracted_kws:
        extracted_kws = extract_keywords_weighted(content)

    top_keywords = []
    kw_in_title_count = 0
    kw_in_meta_count = 0

    if extracted_kws:
        full_text_lower = clean_text.lower()
        title_lower = title.lower()
        desc_lower = description.lower() if description else ""

        for kw in extracted_kws:
            kw_lower = kw.lower()
            # Count occurrences in native clean text for density
            count = len(re.findall(re.escape(kw_lower), full_text_lower))
            density = (count / word_count * 100) if word_count > 0 else 0
            top_keywords.append(
                KeywordDensityResult(word=kw, count=count, density=f"{density:.2f}%")
            )

            # Check presence in Title/Meta
            if kw_lower in title_lower:
                kw_in_title_count += 1
            if desc_lower and kw_lower in desc_lower:
                kw_in_meta_count += 1

    # Image stats
    imgs = soup.find_all("img")
    missing_alt = sum(1 for img in imgs if not img.get("alt"))
    missing_title = sum(1 for img in imgs if not img.get("title"))

    # Schema JSON-LD
    schemas = []
    schema_types = []
    schema_tags = soup.find_all("script", type="application/ld+json")
    for tag in schema_tags:
        try:
            raw_schema = tag.string.strip()
            if raw_schema:
                schemas.append(raw_schema)
                # Parse to find types
                import json

                schema_data = json.loads(raw_schema)
                if isinstance(schema_data, dict):
                    if "@type" in schema_data:
                        schema_types.append(str(schema_data["@type"]))
                elif isinstance(schema_data, list):
                    for item in schema_data:
                        if isinstance(item, dict) and "@type" in item:
                            schema_types.append(str(item["@type"]))
        except Exception:
            continue

    response_time = (time.time() - start_time) * 1000

    return SeoAnalysisResponse(
        title=title,
        title_length=len(title),
        description=description,
        description_length=len(description or ""),
        canonical=canonical,
        robots=robots,
        h1=h1_text,
        word_count=word_count,
        headings=headings,
        image_stats=ImageStat(
            total=len(imgs), missing_alt=missing_alt, missing_title=missing_title
        ),
        primary_keyword=keyword,
        keyword_density=(
            f"{(sum(k.count for k in top_keywords) / word_count * 100):.2f}%"
            if word_count > 0 and top_keywords
            else "0.00%"
        ),
        keywords_in_title=kw_in_title_count,
        keywords_in_meta=kw_in_meta_count,
        top_keywords=top_keywords,
        schemas=schemas,
        schema_types=list(set(schema_types)),
        status_code=status_code,
        response_time_ms=round(response_time, 2),
    )
