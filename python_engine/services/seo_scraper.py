import re
import time
from collections import Counter

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
try:
    import yake
except Exception:
    yake = None

try:
    from underthesea import pos_tag
except Exception:
    pos_tag = None

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
COMBINED_STOPWORDS_SET = set(COMBINED_STOPWORDS)
PLAYWRIGHT_HEADLESS = True
PLAYWRIGHT_LAUNCH_ARGS = ["--no-sandbox", "--disable-dev-shm-usage"]
QUESTION_WORDS_VI = {
    "ai",
    "gì",
    "nào",
    "đâu",
    "khi",
    "bao",
    "bao_nhiêu",
    "vì_sao",
    "tại_sao",
    "thế_nào",
}


def normalize_vietnamese_text(text: str) -> str:
    if not text:
        return ""
    clean_text = re.sub(r"\s+", " ", text)
    clean_text = re.sub(r"[^\wÀ-ỹ\s\-\_]", " ", clean_text, flags=re.UNICODE)
    clean_text = re.sub(r"\s+", " ", clean_text).strip().lower()
    return clean_text


def is_meaningful_phrase(phrase: str) -> bool:
    tokens = [token for token in phrase.split() if token]
    if len(tokens) < 2:
        return False
    if all(token.isdigit() for token in tokens):
        return False
    if all(token in COMBINED_STOPWORDS_SET for token in tokens):
        return False
    if any(len(token) < 2 for token in tokens):
        return False
    return True


def pos_pattern_match(phrase: str) -> bool:
    if not phrase:
        return False
    if pos_tag is None:
        # If Underthesea is unavailable, keep phrase-level heuristics as fallback.
        return is_meaningful_phrase(phrase)

    try:
        tagged = pos_tag(phrase)
    except Exception:
        return False
    if not tagged:
        return False

    words = [word.lower() for word, _ in tagged]
    tags = [tag for _, tag in tagged]

    if any(word in QUESTION_WORDS_VI for word in words):
        return True

    if len(tags) >= 2:
        # Verb + Noun
        if any(tags[i].startswith("V") and tags[i + 1].startswith("N") for i in range(len(tags) - 1)):
            return True
        # Noun + Adjective
        if any(tags[i].startswith("N") and tags[i + 1].startswith("A") for i in range(len(tags) - 1)):
            return True

    # noun phrase presence (single or multi noun tags)
    noun_like = sum(1 for tag in tags if tag.startswith("N"))
    if noun_like >= 1 and len(tags) >= 2:
        return True
    # meaningful adverb phrase
    if any(tag.startswith("R") for tag in tags) and len(tags) >= 2:
        return True
    return False


def count_phrase_occurrence(clean_text: str, phrase: str) -> int:
    escaped = re.escape(phrase)
    pattern = re.compile(rf"(?<!\w){escaped}(?!\w)", flags=re.UNICODE)
    return len(pattern.findall(clean_text))


def tokenize_vietnamese_words(text: str) -> list[str]:
    if not text:
        return []
    tokens = re.findall(r"[A-Za-zÀ-ỹ0-9_]+", text.lower())
    return [token for token in tokens if token and not token.isdigit()]


def extract_candidate_phrases_ngram(clean_text: str, min_n: int = 2, max_n: int = 4) -> list[str]:
    tokens = tokenize_vietnamese_words(clean_text)
    candidates: list[str] = []
    if len(tokens) < min_n:
        return candidates

    for i in range(len(tokens)):
        for n in range(min_n, max_n + 1):
            if i + n > len(tokens):
                continue
            phrase_tokens = tokens[i : i + n]
            phrase = " ".join(phrase_tokens).strip()
            if not is_meaningful_phrase(phrase):
                continue
            # Avoid phrases with too many stopwords like "là của và ..."
            stop_count = sum(1 for tk in phrase_tokens if tk in COMBINED_STOPWORDS_SET)
            if stop_count > (n // 2):
                continue
            candidates.append(phrase)
    return candidates


def rank_phrase_density(
    clean_text: str,
    candidates: list[str],
    top_n: int = 10,
) -> list[KeywordDensityResult]:
    if not clean_text or not candidates:
        return []
    total_words = max(1, len(tokenize_vietnamese_words(clean_text)))
    phrase_counts = Counter()

    for phrase in candidates:
        occurrence = count_phrase_occurrence(clean_text, phrase)
        if occurrence > 0:
            phrase_counts[phrase] = occurrence

    if not phrase_counts:
        return []

    # Keep stronger/longer phrases and remove nested duplicates.
    ordered = sorted(
        phrase_counts.items(),
        key=lambda item: (-item[1], -len(item[0].split()), item[0]),
    )
    selected: list[tuple[str, int]] = []
    for phrase, count in ordered:
        if count < 2:
            continue
        overlaps = any(
            phrase in picked_phrase or picked_phrase in phrase for picked_phrase, _ in selected
        )
        if overlaps:
            continue
        selected.append((phrase, count))
        if len(selected) >= top_n:
            break

    if not selected:
        selected = ordered[:top_n]

    return [
        KeywordDensityResult(
            word=phrase,
            count=count,
            density=f"{(count / total_words * 100):.2f}%",
        )
        for phrase, count in selected
    ]


def extract_keyword_frequency(text: str, top_n: int = 10) -> list[KeywordDensityResult]:
    """Tokenize, remove stop words, and compute keyword frequency density."""
    if not text:
        return []
    tokens = re.findall(r"[A-Za-zÀ-ỹ0-9_]+", text.lower())
    filtered = [
        token
        for token in tokens
        if len(token) > 2 and token not in COMBINED_STOPWORDS_SET and not token.isdigit()
    ]
    if not filtered:
        return []

    freq: dict[str, int] = {}
    for token in filtered:
        freq[token] = freq.get(token, 0) + 1

    total = len(filtered)
    sorted_items = sorted(freq.items(), key=lambda item: item[1], reverse=True)[:top_n]
    return [
        KeywordDensityResult(word=word, count=count, density=f"{(count / total * 100):.2f}%")
        for word, count in sorted_items
    ]


def extract_phrase_keywords_yake_pos(text: str, top_n: int = 10) -> list[KeywordDensityResult]:
    """
    YAKE-based phrase extraction + POS filtering for Vietnamese.
    Fallbacks to simple frequency if libraries are unavailable.
    """
    clean_text = normalize_vietnamese_text(text)
    if not clean_text:
        return []

    if yake is None:
        ngram_candidates = extract_candidate_phrases_ngram(clean_text)
        pos_filtered = [phrase for phrase in ngram_candidates if pos_pattern_match(phrase)]
        phrase_results = rank_phrase_density(clean_text, pos_filtered, top_n=top_n)
        if phrase_results:
            return phrase_results
        return extract_keyword_frequency(clean_text, top_n=top_n)

    try:
        extractor = yake.KeywordExtractor(
            lan="vi",
            n=4,
            dedupLim=0.85,
            dedupFunc="seqm",
            windowsSize=1,
            top=120,
            features=None,
        )
        candidates = extractor.extract_keywords(clean_text)
    except Exception:
        return extract_keyword_frequency(clean_text, top_n=top_n)

    filtered_candidates: list[str] = []
    for phrase, score in candidates:
        candidate = normalize_vietnamese_text(phrase).replace("_", " ").strip()
        if not candidate:
            continue
        if score <= 0:
            continue
        if not is_meaningful_phrase(candidate):
            continue
        if not pos_pattern_match(candidate):
            continue
        filtered_candidates.append(candidate)

    if not filtered_candidates:
        ngram_candidates = extract_candidate_phrases_ngram(clean_text)
        filtered_candidates = [phrase for phrase in ngram_candidates if pos_pattern_match(phrase)]

    phrase_results = rank_phrase_density(clean_text, filtered_candidates, top_n=top_n)
    if phrase_results:
        return phrase_results
    return extract_keyword_frequency(clean_text, top_n=top_n)


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
            headless=PLAYWRIGHT_HEADLESS, args=PLAYWRIGHT_LAUNCH_ARGS
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
