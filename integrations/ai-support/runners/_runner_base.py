"""
Shared NDJSON runner utilities for OmniSuite AI Support integrations.

Import from sibling runners:
  sys.path.insert(0, str(Path(__file__).resolve().parent))
  from _runner_base import emit, read_input, fail_setup, repo_root, submodule_path
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any

EXIT_OK = 0
EXIT_UNEXPECTED = 1
EXIT_SETUP_REQUIRED = 2
EXIT_TASK_FAILED = 3

_RUNNER_DIR = Path(__file__).resolve().parent
_AI_SUPPORT = _RUNNER_DIR.parent
_REPO_ROOT = _AI_SUPPORT.parent.parent
_SUBMODULES = _AI_SUPPORT / "submodules"


def repo_root() -> Path:
    return _REPO_ROOT


def ai_support_dir() -> Path:
    return _AI_SUPPORT


def submodule_path(name: str) -> Path:
    """Path to integrations/ai-support/submodules/<name>. Inserts into sys.path if present."""
    p = (_SUBMODULES / name).resolve()
    if p.exists() and str(p) not in sys.path:
        sys.path.insert(0, str(p))
    return p


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
    sys.exit(EXIT_SETUP_REQUIRED)


def fail_error(message: str) -> None:
    emit({"type": "error", "error": message})
    sys.exit(EXIT_TASK_FAILED)


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
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        fail_error(f"JSON input không hợp lệ: {exc}")
        return {}
