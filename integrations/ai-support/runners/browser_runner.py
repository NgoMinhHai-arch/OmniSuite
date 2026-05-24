"""
OmniSuite — AI Hỗ trợ Browser Runner
====================================

Runner cầu nối giữa Next.js (`/api/ai-support/run`) và submodule `browser-use`.

I/O contract (đơn giản, ổn định):
  • stdin    : 1 dòng JSON { task, provider?, model?, ollama_base_url?, headless?,
                              max_steps?, openai_api_key?, gemini_api_key? }
  • stdout   : NDJSON event stream — mỗi event 1 dòng JSON:
        { "type": "ready",           "data": {...} }
        { "type": "log",   "level":"info|warn|error", "message": "..." }
        { "type": "step",  "step": N, "summary": "..." }
        { "type": "done",  "result": {...} }
        { "type": "error", "error":  "..." }
        { "type": "setup_required", "missing": ["browser_use"|"playwright"|...],
          "instructions": "..." }
  • exit     : 0 = OK, 2 = setup required, 3 = task failed, 1 = unexpected

Tính chất tự bảo vệ:
  • Không nhận tham số shell → tránh injection.
  • In NDJSON line-buffered (flush sau mỗi event) để Node stream được realtime.
  • Catch ImportError sớm → trả `setup_required` với hướng dẫn cụ thể.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

# Path tới submodule browser-use trong repo (không bắt buộc đã pip install)
_THIS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _THIS_DIR.parent.parent.parent
_BROWSER_USE_SUBMODULE = _REPO_ROOT / "integrations" / "ai-support" / "submodules" / "browser-use"
if _BROWSER_USE_SUBMODULE.exists():
    sys.path.insert(0, str(_BROWSER_USE_SUBMODULE))


def emit(event: dict[str, Any]) -> None:
    """In NDJSON line. Flush ngay để Node nhận stream realtime."""
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
    """Đọc 1 dòng JSON từ stdin. Nếu không có → fail."""
    try:
        raw = sys.stdin.readline()
    except Exception as exc:
        fail_error(f"Không đọc được stdin: {exc}")
        return {}
    raw = (raw or "").strip()
    if not raw:
        fail_error("Stdin rỗng — runner cần JSON input.")
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        fail_error(f"JSON input không hợp lệ: {exc}")
        return {}
    if not isinstance(data, dict):
        fail_error("Input phải là object JSON.")
        return {}
    task = (data.get("task") or "").strip()
    if not task:
        fail_error("Thiếu trường 'task' trong input.")
    return data


def import_browser_use():
    """Import lazy + báo lỗi rõ ràng nếu chưa pip install."""
    try:
        from browser_use import Agent  # type: ignore
        return Agent
    except ImportError as exc:
        msg = str(exc)
        missing: list[str] = []
        if "playwright" in msg.lower():
            missing.append("playwright")
        if "browser_use" in msg.lower() or not missing:
            missing.append("browser_use")
        fail_setup(
            missing=missing,
            instructions=(
                "Browser Use chưa cài đặt trên máy. Mở terminal trong thư mục dự án và chạy:\n"
                "  cd integrations/ai-support/submodules/browser-use\n"
                "  python -m venv .venv\n"
                "  .venv\\Scripts\\Activate.ps1   # Windows PowerShell\n"
                "  pip install -e .\n"
                "  python -m playwright install chromium\n"
                "Sau đó chạy lại OmniSuite. (AI Hỗ trợ → /run <task>)"
            ),
        )


def build_llm(provider: str, model: str | None, payload: dict[str, Any]):
    """Tạo client LLM cho browser-use. Hỗ trợ Ollama, OpenAI, Gemini."""
    p = (provider or "ollama").strip().lower()
    if p == "ollama":
        from browser_use import ChatOllama  # type: ignore
        host = (payload.get("ollama_base_url") or os.environ.get("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/")
        chosen = (model or "llama3.1:8b").strip()
        return ChatOllama(model=chosen, host=host)
    if p in ("openai", "gpt"):
        from browser_use import ChatOpenAI  # type: ignore
        api_key = payload.get("openai_api_key") or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            fail_error("Thiếu OPENAI_API_KEY cho provider openai.")
        chosen = (model or "gpt-4o-mini").strip()
        return ChatOpenAI(model=chosen, api_key=api_key)
    if p in ("google", "gemini"):
        from browser_use import ChatGoogle  # type: ignore
        api_key = payload.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            fail_error("Thiếu GEMINI_API_KEY cho provider google/gemini.")
        chosen = (model or "gemini-1.5-flash").strip()
        return ChatGoogle(model=chosen, api_key=api_key)
    fail_error(f"Provider '{provider}' chưa hỗ trợ trong runner. Dùng: ollama | openai | gemini.")


async def run_agent(payload: dict[str, Any]) -> None:
    Agent = import_browser_use()
    llm = build_llm(payload.get("provider", "ollama"), payload.get("model"), payload)

    headless = bool(payload.get("headless", True))
    max_steps = int(payload.get("max_steps") or 25)
    if max_steps < 1:
        max_steps = 1
    if max_steps > 100:
        max_steps = 100

    task = str(payload.get("task")).strip()
    emit({
        "type": "ready",
        "data": {
            "provider": payload.get("provider", "ollama"),
            "model": payload.get("model"),
            "headless": headless,
            "max_steps": max_steps,
        },
    })
    emit_log("info", f"Bắt đầu task: {task}")

    try:
        agent = Agent(task=task, llm=llm)
    except TypeError:
        # Một số phiên bản browser-use yêu cầu thêm tham số headless qua BrowserProfile
        try:
            from browser_use import BrowserProfile, BrowserSession  # type: ignore
            session = BrowserSession(profile=BrowserProfile(headless=headless))
            agent = Agent(task=task, llm=llm, browser_session=session)
        except Exception as exc:
            fail_error(f"Không khởi tạo được Agent browser-use: {exc}")
            return
    except Exception as exc:
        fail_error(f"Khởi tạo Agent thất bại: {exc}")
        return

    step_counter = {"n": 0}

    def on_step_end(*_args, **_kwargs) -> None:
        step_counter["n"] += 1
        emit({"type": "step", "step": step_counter["n"], "summary": f"step {step_counter['n']} hoàn tất"})

    try:
        register = getattr(agent, "register_new_step_callback", None)
        if callable(register):
            register(on_step_end)
    except Exception:
        pass

    try:
        history = await agent.run(max_steps=max_steps)
    except TypeError:
        history = await agent.run()
    except Exception as exc:
        fail_error(f"Agent chạy lỗi: {exc}")
        return

    final_text = ""
    try:
        final_text = history.final_result() if hasattr(history, "final_result") else ""
    except Exception:
        final_text = ""
    if not final_text:
        try:
            final_text = str(history)[:4000]
        except Exception:
            final_text = ""

    emit({
        "type": "done",
        "result": {
            "steps": step_counter["n"],
            "final_text": final_text,
        },
    })


def main() -> None:
    payload = read_input()
    try:
        asyncio.run(run_agent(payload))
    except KeyboardInterrupt:
        emit_log("warn", "Bị huỷ bởi người dùng.")
        sys.exit(130)
    except SystemExit:
        raise
    except Exception as exc:
        fail_error(f"Lỗi không mong muốn: {exc}")


if __name__ == "__main__":
    main()
