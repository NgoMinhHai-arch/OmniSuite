"""
OmniSuite — OpenManus runner (/run)
===================================

Cầu nối Next.js `/api/ai-support/run` (runner=open_manus) và submodule OpenManus.

Contract (giống browser_runner / runner cũ):
  • stdin    : 1 dòng JSON { task, provider?, model?, ollama_base_url?,
                              openai_api_key?, gemini_api_key?, headless? }
  • stdout   : NDJSON stream (ready | log | step | done | error | setup_required)
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

MAX_TASK_LEN = 4000

_RUNNER_DIR = Path(__file__).resolve().parent
_AI_SUPPORT = _RUNNER_DIR.parent
_OPEN_MANUS = (_AI_SUPPORT / "submodules" / "open-manus").resolve()
_CONFIG_DIR = _OPEN_MANUS / "config"
_LOCK_DIR = _CONFIG_DIR / ".omnisuite_runner_lock"
# OpenManus yeu cau browser-use 0.1.x (BrowserConfig); /run-browser dung submodule 0.12+ — tach bang pip --target.
_LEGACY_BROWSER_USE_DEPS = (_RUNNER_DIR / ".legacy-browser-use-deps").resolve()


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
        return {}
    if len(task) > MAX_TASK_LEN:
        fail_error(f"task vượt quá {MAX_TASK_LEN} ký tự.")
        return {}
    return data


def _normalize_ollama_host(url: str) -> str:
    h = (url or "").strip().rstrip("/")
    if not h:
        return "http://localhost:11434"
    if h.endswith("/v1/chat/completions"):
        h = h[: -len("/chat/completions")].rstrip("/")
    elif h.endswith("/v1"):
        h = h[: -len("/v1")].rstrip("/")
    return h or "http://localhost:11434"


def _dq(s: str) -> str:
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"') + '"'


def write_openmanus_config(payload: dict[str, Any]) -> None:
    """Ghi config/config.toml trong submodule (giữ layout OpenManus)."""
    p = (payload.get("provider") or "ollama").strip().lower()
    model = (payload.get("model") or "").strip()
    headless = bool(payload.get("headless"))

    if p == "ollama":
        raw = (
            payload.get("ollama_base_url")
            or os.environ.get("OLLAMA_BASE_URL")
            or os.environ.get("OLLAMA_API_BASE")
            or "http://localhost:11434"
        )
        host = _normalize_ollama_host(str(raw))
        raw_m = model.replace("ollama/", "") if model else "llama3.2"
        m = raw_m.split("/")[-1]
        base_url = f"{host}/v1"
        api_key = (payload.get("ollama_api_key") or os.environ.get("OLLAMA_API_KEY") or "ollama").strip()
        api_type = "ollama"
    elif p in ("openai", "gpt"):
        api_key = (payload.get("openai_api_key") or os.environ.get("OPENAI_API_KEY") or "").strip()
        if not api_key:
            fail_error("Thiếu OPENAI_API_KEY cho provider openai.")
        base = (os.environ.get("OPENAI_API_BASE") or "https://api.openai.com/v1").strip().rstrip("/")
        if not base.endswith("/v1"):
            base = base + "/v1" if "/v1" not in base else base
        base_url = base if base.startswith("http") else "https://api.openai.com/v1"
        m = model or "gpt-4o-mini"
        api_type = ""
    elif p in ("google", "gemini"):
        api_key = (payload.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY") or "").strip()
        if not api_key:
            fail_error("Thiếu GEMINI_API_KEY cho provider google/gemini.")
        base_url = (
            os.environ.get("GEMINI_OPENAI_BASE_URL") or "https://generativelanguage.googleapis.com/v1beta/openai/"
        ).strip()
        if not base_url.endswith("/"):
            base_url += "/"
        raw_m = model or "gemini-2.0-flash"
        if "/" in raw_m:
            raw_m = raw_m.split("/")[-1]
        m = raw_m
        api_type = ""
    else:
        fail_error(
            f"Provider '{p}' runner OpenManus chưa hỗ trợ trong OmniSuite. "
            "Chọn ollama | google | openai trên Quản gia."
        )
        return

    max_tokens = 4096
    temperature = 0.0
    api_version = ""

    browser_lines = ""
    if headless:
        browser_lines = "\n[browser]\nheadless = true\n"

    body = f"""# OmniSuite — generated for /run (do not edit by hand; overwritten per run)
[llm]
model = {_dq(m)}
base_url = {_dq(base_url)}
api_key = {_dq(api_key)}
max_tokens = {max_tokens}
temperature = {temperature}
api_type = {_dq(api_type)}
api_version = {_dq(api_version)}

[llm.vision]
model = {_dq(m)}
base_url = {_dq(base_url)}
api_key = {_dq(api_key)}
max_tokens = {max_tokens}
temperature = {temperature}
api_type = {_dq(api_type)}
api_version = {_dq(api_version)}

[mcp]
server_reference = "app.mcp.server"

[runflow]
use_data_analysis_agent = false

[daytona]
daytona_api_key = {_dq("omnisuite-unused")}
{browser_lines}
"""
    _CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    workspace = _OPEN_MANUS / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    (_OPEN_MANUS / "config" / "config.toml").write_text(body, encoding="utf-8")


def acquire_config_lock(timeout_sec: float = 120.0) -> None:
    deadline = time.monotonic() + timeout_sec
    while time.monotonic() < deadline:
        try:
            _LOCK_DIR.mkdir(parents=False)
            return
        except FileExistsError:
            time.sleep(0.08)
    fail_error("Không lấy được khóa ghi config OpenManus (runner khác đang chạy?). Thử lại sau.")


def release_config_lock() -> None:
    try:
        _LOCK_DIR.rmdir()
    except OSError:
        pass


def ensure_openmanus_on_path() -> None:
    root_s = str(_OPEN_MANUS)
    if not (_OPEN_MANUS / "app").is_dir():
        fail_setup(
            missing=["open_manus"],
            instructions=(
                "Thiếu submodule OpenManus.\n"
                "  npm run integrations:sync\n"
                "hoặc: git submodule update --init integrations/ai-support/submodules/open-manus\n"
                "Sau đó chạy scripts/setup-runners-venv.ps1 (hoặc .sh)."
            ),
        )
    if root_s not in sys.path:
        sys.path.insert(0, root_s)


def ensure_legacy_browser_use_on_path() -> None:
    leg = _LEGACY_BROWSER_USE_DEPS
    if not (leg / "browser_use").is_dir():
        fail_setup(
            missing=["browser_use_legacy"],
            instructions=(
                "Thieu browser-use 0.1.x trong integrations/ai-support/runners/.legacy-browser-use-deps.\n"
                "Chay lai scripts/setup-runners-venv.ps1 hoac .sh (pip install browser-use==0.1.40 --target ...)."
            ),
        )
    sys.path.insert(0, str(leg))


def _build_omni_manus_class():  # noqa: ANN201
    from pydantic import Field

    from app.agent.manus import Manus
    from app.tool import Terminate, ToolCollection
    from app.tool.python_execute import PythonExecute

    class _OmniManus(Manus):
        """Manus không có AskHuman — tránh treo khi không có TTY.

        • Không StrReplaceEditor — trên Windows + đường dẫn Unicode hay lỗi CMD `FIND`, agent lặp vô hạn.
        • Không BrowserUseTool — tác vụ chữ đơn giản không nên mở Chromium; dùng `/run-browser` cho automation.
        """

        available_tools: ToolCollection = Field(
            default_factory=lambda: ToolCollection(
                PythonExecute(),
                Terminate(),
            )
        )

    return _OmniManus


async def run_manus(task: str, OmniCls: type) -> tuple[str, int]:
    agent = await OmniCls.create()
    try:
        emit_log("info", "OpenManus đang chạy…")
        result = await agent.run(task)
        steps_seen = len(agent.memory.messages)
        return (result or "").strip(), steps_seen
    finally:
        await agent.cleanup()


def main() -> None:
    payload = read_input()
    task = str(payload.get("task", "")).strip()

    acquire_config_lock()
    try:
        write_openmanus_config(payload)
    finally:
        release_config_lock()

    ensure_openmanus_on_path()
    ensure_legacy_browser_use_on_path()

    try:
        OmniCls = _build_omni_manus_class()
    except ImportError as exc:
        fail_setup(
            missing=["open_manus_deps"],
            instructions=(
                "Không import được OpenManus (thiếu dependency).\n"
                "  Chạy scripts/setup-runners-venv.ps1 hoặc .sh\n"
                f"Chi tiết: {exc}"
            ),
        )

    emit(
        {
            "type": "ready",
            "data": {
                "provider": payload.get("provider", "ollama"),
                "model": (payload.get("model") or "").strip(),
                "runner": "open_manus",
            },
        }
    )
    emit_log("info", f"Bắt đầu OpenManus: {task[:300]}...")

    try:
        final_text, steps = asyncio.run(run_manus(task, OmniCls))
    except KeyboardInterrupt:
        emit_log("warn", "Bị huỷ.")
        sys.exit(130)
    except Exception as exc:
        fail_error(f"OpenManus lỗi: {exc}")

    emit(
        {
            "type": "done",
            "result": {
                "steps": steps,
                "final_text": final_text or "(không có nội dung text — xem log)",
            },
        }
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        emit_log("warn", "Bị huỷ.")
        sys.exit(130)
    except SystemExit:
        raise
    except Exception as exc:
        fail_error(f"Lỗi không mong đợi: {exc}")
