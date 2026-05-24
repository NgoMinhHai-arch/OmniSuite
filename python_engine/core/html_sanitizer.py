"""Strip noisy HTML before sending content to LLM providers (token cost reducer)."""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

_STRIP_TAGS = ("script", "style", "svg", "noscript", "iframe", "footer", "nav", "aside")
_KEEP_STRUCTURE = ("h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "article", "section", "main")


def _looks_like_html(text: str) -> bool:
    s = text.strip()
    if len(s) < 12:
        return False
    return bool(re.search(r"<[a-zA-Z][\w:-]*", s))


def clean_html_for_llm(raw: str, *, max_chars: int = 12000) -> str:
    """
    Remove scripts/styles/SVG/footer noise; keep SEO structure + readable text.
    Returns plain text with light structure markers.
    """
    if not raw or not raw.strip():
        return ""
    if not _looks_like_html(raw):
        return raw.strip()[:max_chars]

    try:
        soup = BeautifulSoup(raw, "lxml")
    except Exception:
        soup = BeautifulSoup(raw, "html.parser")
    for tag_name in _STRIP_TAGS:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    meta_bits: list[str] = []
    title = soup.title.string.strip() if soup.title and soup.title.string else ""
    if title:
        meta_bits.append(f"title: {title}")
    desc = soup.find("meta", attrs={"name": "description"})
    if desc and desc.get("content"):
        meta_bits.append(f"meta-description: {desc['content'].strip()}")

    blocks: list[str] = []
    if meta_bits:
        blocks.append("\n".join(meta_bits))

    for tag_name in _KEEP_STRUCTURE:
        for el in soup.find_all(tag_name):
            txt = el.get_text(" ", strip=True)
            if txt and len(txt) > 2:
                blocks.append(f"[{tag_name}] {txt}")

    if not blocks:
        body = soup.body or soup
        text = body.get_text("\n", strip=True) if body else soup.get_text("\n", strip=True)
        text = re.sub(r"\n{3,}", "\n\n", text)
        out = text
    else:
        out = "\n\n".join(blocks)

    out = re.sub(r"[ \t]+", " ", out)
    out = re.sub(r"\n{3,}", "\n\n", out).strip()
    if len(out) > max_chars:
        out = f"{out[:max_chars]}\n... [truncated for token limit]"
    return out


def maybe_clean_prompt_for_llm(user_prompt: str, *, max_chars: int = 12000) -> str:
    if _looks_like_html(user_prompt):
        return clean_html_for_llm(user_prompt, max_chars=max_chars)
    return user_prompt
