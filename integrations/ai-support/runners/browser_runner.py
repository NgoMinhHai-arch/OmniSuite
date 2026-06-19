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
import inspect
import os
import sys
import time
from pathlib import Path
from typing import Any

_THIS_DIR = Path(__file__).resolve().parent
if str(_THIS_DIR) not in sys.path:
    sys.path.insert(0, str(_THIS_DIR))

from _runner_base import (  # noqa: E402
    emit,
    emit_log,
    fail_error,
    fail_setup,
    read_input,
    submodule_path,
)

_BROWSER_USE_SUBMODULE = submodule_path("browser-use")
_CHROMIUM_EXECUTABLE_ENV_KEYS = (
    "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH",
    "CHROMIUM_EXECUTABLE_PATH",
    "CHROME_PATH",
    "OMNISUITE_CHROME_PATH",
)


def playwright_setup_instructions() -> str:
    return (
        "Browser Use hoặc Playwright Chromium chưa sẵn sàng. Mở terminal trong thư mục dự án và chạy:\n"
        "  npm run setup:repair -- --only=maps\n"
        "Nếu đang cài runner Python riêng thì chạy:\n"
        "  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-runners-venv.ps1\n"
        "Nếu mạng/proxy chặn tải Chromium, đặt PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH tới Chrome/Edge có sẵn rồi chạy lại.\n"
        "Ví dụ Windows PowerShell:\n"
        "  $env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=\"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe\""
    )


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
        fail_setup(missing=missing, instructions=playwright_setup_instructions())


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


def _existing_file(value: str | None) -> str | None:
    p = (value or "").strip().strip('"').strip("'")
    if not p:
        return None
    try:
        path = Path(p).expanduser()
        return str(path) if path.is_file() else None
    except OSError:
        return None


def _default_browser_candidates() -> list[str]:
    if sys.platform == "win32":
        roots = [
            os.environ.get("LOCALAPPDATA"),
            os.environ.get("PROGRAMFILES"),
            os.environ.get("PROGRAMFILES(X86)"),
        ]
        out: list[str] = []
        for root in [r for r in roots if r]:
            out.extend([
                str(Path(root) / "Google" / "Chrome" / "Application" / "chrome.exe"),
                str(Path(root) / "Microsoft" / "Edge" / "Application" / "msedge.exe"),
            ])
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


def find_existing_browser_executable() -> str | None:
    for key in _CHROMIUM_EXECUTABLE_ENV_KEYS:
        found = _existing_file(os.environ.get(key))
        if found:
            return found
    for candidate in _default_browser_candidates():
        found = _existing_file(candidate)
        if found:
            return found
    return None


def _supports_kw(callable_obj: Any, name: str) -> bool:
    try:
        sig = inspect.signature(callable_obj)
    except (TypeError, ValueError):
        return True
    return any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()) or name in sig.parameters


def _make_browser_profile(BrowserProfile: Any, headless: bool, executable_path: str | None):
    attempts: list[dict[str, Any]] = []
    if executable_path:
        attempts.extend([
            {"headless": headless, "executable_path": executable_path},
            {"headless": headless, "browser_binary_path": executable_path},
            {"headless": headless, "chrome_instance_path": executable_path},
        ])
    attempts.append({"headless": headless})

    last_exc: Exception | None = None
    for raw in attempts:
        kwargs = {k: v for k, v in raw.items() if _supports_kw(BrowserProfile, k)}
        try:
            return BrowserProfile(**kwargs)
        except Exception as exc:  # browser-use đổi API khá nhiều, nên thử lần lượt.
            last_exc = exc
    if last_exc:
        raise last_exc
    return BrowserProfile(headless=headless)


def _make_browser_session(BrowserSession: Any, profile: Any):
    attempts = [
        {"profile": profile},
        {"browser_profile": profile},
    ]
    last_exc: Exception | None = None
    for raw in attempts:
        kwargs = {k: v for k, v in raw.items() if _supports_kw(BrowserSession, k)}
        try:
            return BrowserSession(**kwargs)
        except Exception as exc:
            last_exc = exc
    if last_exc:
        raise last_exc
    return BrowserSession(profile=profile)


def _create_agent(Agent: Any, task: str, llm: Any, headless: bool):
    executable_path = find_existing_browser_executable()
    should_force_profile = executable_path is not None or headless is not True

    if should_force_profile:
        try:
            from browser_use import BrowserProfile, BrowserSession  # type: ignore
            profile = _make_browser_profile(BrowserProfile, headless, executable_path)
            session = _make_browser_session(BrowserSession, profile)
            if executable_path:
                emit_log("info", f"Dùng Chrome/Edge có sẵn: {executable_path}")
            return Agent(task=task, llm=llm, browser_session=session)
        except TypeError:
            # Agent/browser-use đời cũ không nhận browser_session.
            pass
        except Exception as exc:
            emit_log("warn", f"Không dùng được BrowserProfile tùy chỉnh: {exc}")

    return Agent(task=task, llm=llm)


def _is_missing_playwright_browser_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    markers = (
        "executable doesn't exist",
        "please run the following command",
        "playwright install",
        "browserType.launch",
        "chromium",
        "chrome-headless-shell",
    )
    return any(m.lower() in msg for m in markers)


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
        agent = _create_agent(Agent, task, llm, headless)
    except Exception as exc:
        fail_error(f"Không khởi tạo được Agent browser-use: {exc}")
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
        if _is_missing_playwright_browser_error(exc):
            fail_setup(missing=["playwright_chromium"], instructions=playwright_setup_instructions())
            return
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
