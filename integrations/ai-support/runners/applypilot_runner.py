"""
ApplyPilot Runner cho AI Hỗ trợ.

Wrap CLI `applypilot {init|doctor|run|apply}` thành NDJSON event stream
để UI Next.js đọc được realtime giống browser_runner.py.

Input (stdin, 1 dòng JSON):
  { "action": "doctor"|"init"|"run"|"apply",
    "workers": 1..8 (optional, cho run/apply),
    "dry_run": true|false (optional, cho apply) }

Output: NDJSON
  - {"type":"ready", "data": {...}}
  - {"type":"log",   "level":"info|warn|error", "message":"..."}
  - {"type":"done",  "result": {...}}
  - {"type":"error", "error":"..."}
  - {"type":"setup_required", "missing":[...], "instructions":"..."}

Exit codes:
  0 OK · 2 setup_required · 3 task failed · 1 unexpected
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import time
from typing import Any


def emit(event: dict[str, Any]) -> None:
    try:
        sys.stdout.write(json.dumps(event, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except Exception:
        pass


def emit_log(level: str, message: str) -> None:
    emit({"type": "log", "level": level, "message": message, "ts": time.time()})


def fail_setup() -> None:
    emit({
        "type": "setup_required",
        "missing": ["applypilot"],
        "instructions": (
            "ApplyPilot chưa có trong PATH. Cài đặt:\n"
            "  pip install applypilot\n"
            "  pip install --no-deps python-jobspy\n"
            "  pip install pydantic tls-client requests markdownify regex\n"
            "  applypilot init\n"
            "Sau đó chạy lại /apply trong AI Hỗ trợ."
        ),
    })
    sys.exit(2)


def fail_error(message: str) -> None:
    emit({"type": "error", "error": message})
    sys.exit(3)


def read_input() -> dict[str, Any]:
    raw = (sys.stdin.readline() or "").strip()
    if not raw:
        fail_error("Stdin rỗng — runner cần JSON input.")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        fail_error(f"JSON input không hợp lệ: {exc}")
        return {}
    if not isinstance(data, dict):
        fail_error("Input phải là object JSON.")
        return {}
    return data


def build_argv(payload: dict[str, Any]) -> list[str]:
    action = (payload.get("action") or "doctor").strip().lower()
    if action not in {"init", "doctor", "run", "apply"}:
        fail_error(f"Action không hợp lệ: {action}. Cho phép: init/doctor/run/apply.")
    argv = ["applypilot", action]
    workers = payload.get("workers")
    if action in {"run", "apply"} and isinstance(workers, int) and 1 <= workers <= 8:
        argv += ["-w", str(workers)]
    if action == "apply" and payload.get("dry_run"):
        argv.append("--dry-run")
    return argv


def stream_subprocess(argv: list[str]) -> int:
    emit({"type": "ready", "data": {"argv": argv}})
    emit_log("info", f"Chạy: {' '.join(argv)}")
    try:
        proc = subprocess.Popen(
            argv,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
    except FileNotFoundError:
        fail_setup()
        return 2
    except Exception as exc:
        fail_error(f"Spawn lỗi: {exc}")
        return 3

    assert proc.stdout is not None
    line_count = 0
    try:
        for line in proc.stdout:
            line = line.rstrip("\n")
            if not line:
                continue
            line_count += 1
            level = "info"
            low = line.lower()
            if any(k in low for k in ("error", "exception", "fatal", "traceback")):
                level = "error"
            elif any(k in low for k in ("warn", "deprecated")):
                level = "warn"
            emit_log(level, line[:1200])
    except Exception as exc:
        emit_log("warn", f"Đọc stdout gián đoạn: {exc}")

    code = proc.wait()
    if code == 0:
        emit({"type": "done", "result": {"lines": line_count, "argv": argv}})
    else:
        emit({"type": "error", "error": f"applypilot exit code={code}"})
    return code


def main() -> None:
    if shutil.which("applypilot") is None:
        fail_setup()
    payload = read_input()
    argv = build_argv(payload)
    code = stream_subprocess(argv)
    sys.exit(0 if code == 0 else 3)


if __name__ == "__main__":
    main()
