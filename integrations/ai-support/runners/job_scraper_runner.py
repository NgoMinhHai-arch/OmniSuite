"""
Job Scraper Runner cho AI Hỗ trợ.

Dùng `primary_client.generate_content()` từ integrations/job-scraper/llm_client.py
(litellm). Phải set biến môi trường API key *trước* khi import llm_client.

Input (stdin, 1 dòng JSON):
  { "jd": "...", "resume_text": "...",
    "provider": "google|openai|ollama|..." (optional),
    "model": "..." (optional, có thể là chuỗi litellm đầy đủ như ollama/llama3.1:8b),
    "gemini_api_key", "openai_api_key", "ollama_base_url" (optional, từ UI)
  }

Output NDJSON: ready / log / done / error / setup_required.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any

_THIS = Path(__file__).resolve().parent
_REPO_ROOT = _THIS.parent.parent.parent
_SCRAPER_DIR = _REPO_ROOT / "integrations" / "job-scraper"
if _SCRAPER_DIR.exists():
    sys.path.insert(0, str(_SCRAPER_DIR))


def emit(event: dict[str, Any]) -> None:
    try:
        sys.stdout.write(json.dumps(event, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except Exception:
        pass


def emit_log(level: str, message: str) -> None:
    emit({"type": "log", "level": level, "message": message, "ts": time.time()})


def fail_setup(missing: list[str], instructions: str) -> None:
    emit({"type": "setup_required", "missing": missing, "instructions": instructions})
    sys.exit(2)


def fail_error(message: str) -> None:
    emit({"type": "error", "error": message})
    sys.exit(3)


def read_input() -> dict[str, Any]:
    raw = (sys.stdin.readline() or "").strip()
    if not raw:
        fail_error("Stdin rỗng.")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        fail_error(f"JSON không hợp lệ: {exc}")
        return {}
    if not isinstance(data, dict):
        fail_error("Input phải là object.")
        return {}
    if not (data.get("jd") or "").strip():
        fail_error("Thiếu trường 'jd'.")
    return data


def apply_payload_env(payload: dict[str, Any]) -> None:
    """Đồng bộ key từ payload Next.js vào env trước khi import job-scraper."""
    g = (payload.get("gemini_api_key") or "").strip()
    if g:
        os.environ["GEMINI_API_KEY"] = g
        os.environ.setdefault("LLM_API_KEY", g)
    oa = (payload.get("openai_api_key") or "").strip()
    if oa:
        os.environ["OPENAI_API_KEY"] = oa
    base = (payload.get("ollama_base_url") or "").strip().rstrip("/")
    if base:
        # LiteLLM / Ollama
        os.environ["OLLAMA_API_BASE"] = base
        os.environ["OLLAMA_BASE_URL"] = base


def resolve_litellm_model(provider: str, model: str) -> str | None:
    """
    Trả về chuỗi model LiteLLM hoặc None để dùng default trong config (gemini pool).
    """
    m = model.strip()
    p = provider.strip().lower()
    if not m:
        return None
    if "/" in m:
        return m
    if p in ("ollama",):
        return f"ollama/{m}"
    if p in ("google", "gemini"):
        return f"gemini/{m}" if not m.startswith("gemini/") else m
    if p in ("openai",):
        return f"openai/{m}"
    if p in ("claude", "anthropic"):
        return f"anthropic/{m}"
    if p in ("groq",):
        return f"groq/{m}"
    if p in ("deepseek",):
        return f"deepseek/{m}"
    if p in ("openrouter",):
        return f"openrouter/{m}"
    # fallback: coi như đã là short name provider/model
    return m


def build_prompt(jd: str, resume_text: str) -> tuple[str, str]:
    system = (
        "Bạn là chuyên gia tuyển dụng. So sánh JD và resume, trả về JSON duy nhất với keys:\n"
        '{ "score": 0-100, "match_skills": [..], "missing_skills": [..],\n'
        '  "summary": "2-3 câu tiếng Việt", "ats_keywords": [..] }\n'
        "KHÔNG markdown, KHÔNG văn bản ngoài JSON."
    )
    user = (
        f"## JOB DESCRIPTION\n{jd.strip()}\n\n"
        f"## RESUME\n{(resume_text or '').strip() or '(trống — chỉ dựa trên JD để gợi ý keywords)'}\n"
    )
    return system, user


def main() -> None:
    payload = read_input()
    apply_payload_env(payload)

    jd = str(payload.get("jd") or "").strip()
    resume_text = str(payload.get("resume_text") or "").strip()
    provider = str(payload.get("provider") or os.environ.get("DEFAULT_LLM_PROVIDER") or "gemini").lower()
    model = str(payload.get("model") or "").strip()

    emit({"type": "ready", "data": {"provider": provider, "model": model or "(default config)"}})
    emit_log("info", f"Score JD ({len(jd)} chars) vs resume ({len(resume_text)} chars)...")

    try:
        from llm_client import primary_client  # type: ignore  # noqa: WPS433 (runtime import after env)
    except ImportError as exc:
        fail_setup(
            missing=["litellm", "pydantic"],
            instructions=(
                "Job Scraper deps thiếu. Cài:\n"
                "  cd integrations/job-scraper\n"
                "  pip install litellm pydantic python-dotenv\n"
                f"Chi tiết: {exc}"
            ),
        )
        return

    system, user = build_prompt(jd, resume_text)
    model_override = resolve_litellm_model(provider, model)

    try:
        resp_text = primary_client.generate_content(
            prompt=user,
            system_prompt=system,
            temperature=0.2,
            model_override=model_override,
        )
        if not isinstance(resp_text, str):
            resp_text = str(resp_text)
    except SystemExit:
        raise
    except Exception as exc:
        fail_error(f"LLM call lỗi: {exc}")
        return

    parsed: dict[str, Any] | None = None
    try:
        start = resp_text.find("{")
        end = resp_text.rfind("}")
        if start >= 0 and end > start:
            parsed = json.loads(resp_text[start : end + 1])
    except Exception:
        parsed = None

    emit({
        "type": "done",
        "result": parsed if isinstance(parsed, dict) else {"raw": resp_text[:2000]},
    })


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        fail_error(f"Lỗi không mong muốn: {exc}")
