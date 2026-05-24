"""
Async Write-Ahead Ledger — buffered SQLite writes for high-volume SEO scraping.
Avoids "database is locked" under concurrent crawlers without requiring PostgreSQL.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any

import aiosqlite

from python_engine.core.config import get_settings
from python_engine.core.logger import get_logger

logger = get_logger()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS seo_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    title TEXT,
    description TEXT,
    h1 TEXT,
    word_count INTEGER,
    keyword_density TEXT,
    keywords_in_title INTEGER,
    keywords_in_meta INTEGER,
    top_keywords TEXT,
    image_stats TEXT,
    status_code INTEGER,
    response_time_ms REAL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_seo_results_created ON seo_results(created_at DESC);
"""

_UPSERT = """
INSERT INTO seo_results (
    url, title, description, h1, word_count,
    keyword_density, keywords_in_title, keywords_in_meta,
    top_keywords, image_stats, status_code, response_time_ms, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
ON CONFLICT(url) DO UPDATE SET
    title=excluded.title,
    description=excluded.description,
    h1=excluded.h1,
    word_count=excluded.word_count,
    keyword_density=excluded.keyword_density,
    keywords_in_title=excluded.keywords_in_title,
    keywords_in_meta=excluded.keywords_in_meta,
    top_keywords=excluded.top_keywords,
    image_stats=excluded.image_stats,
    status_code=excluded.status_code,
    response_time_ms=excluded.response_time_ms,
    created_at=datetime('now');
"""


def _default_db_path() -> Path:
    root = os.environ.get("OMNISUITE_ROOT", Path.cwd())
    return Path(root) / ".omnisuite" / "data" / "seo_ledger.db"


def _row_from_dict(result_dict: dict[str, Any]) -> tuple:
    top_kws = result_dict.get("top_keywords", [])
    if not isinstance(top_kws, str):
        top_kws = json.dumps(top_kws, ensure_ascii=False)
    img_stats = result_dict.get("image_stats", {})
    if not isinstance(img_stats, str):
        img_stats = json.dumps(img_stats, ensure_ascii=False)
    return (
        str(result_dict.get("url", "")),
        result_dict.get("title"),
        result_dict.get("description"),
        result_dict.get("h1"),
        int(result_dict.get("word_count", 0) or 0),
        result_dict.get("keyword_density", "0.00%"),
        int(result_dict.get("keywords_in_title", 0) or 0),
        int(result_dict.get("keywords_in_meta", 0) or 0),
        top_kws,
        img_stats,
        int(result_dict.get("status_code", 200) or 200),
        float(result_dict.get("response_time_ms", 0.0) or 0.0),
    )


class WriteAheadLedger:
    def __init__(self, db_path: Path, flush_interval_sec: float = 4.0) -> None:
        self._db_path = db_path
        self._flush_interval = flush_interval_sec
        self._buffer: list[tuple] = []
        self._buffer_lock = asyncio.Lock()
        self._flush_task: asyncio.Task | None = None
        self._db: aiosqlite.Connection | None = None

    async def start(self) -> None:
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db = await aiosqlite.connect(self._db_path)
        await self._db.execute("PRAGMA journal_mode=WAL;")
        await self._db.execute("PRAGMA synchronous=NORMAL;")
        await self._db.executescript(_SCHEMA)
        await self._db.commit()
        self._flush_task = asyncio.create_task(self._flush_loop(), name="sqlite-ledger-flush")
        logger.info("SQLite Write-Ahead Ledger started at %s", self._db_path)

    async def stop(self) -> None:
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
            self._flush_task = None
        await self.flush()
        if self._db:
            await self._db.close()
            self._db = None

    async def enqueue(self, result_dict: dict[str, Any]) -> None:
        row = _row_from_dict(result_dict)
        if not row[0]:
            return
        async with self._buffer_lock:
            self._buffer.append(row)

    async def _flush_loop(self) -> None:
        while True:
            await asyncio.sleep(self._flush_interval)
            await self.flush()

    async def flush(self) -> None:
        if not self._db:
            return
        async with self._buffer_lock:
            if not self._buffer:
                return
            batch = self._buffer[:]
            self._buffer.clear()
        try:
            await self._db.executemany(_UPSERT, batch)
            await self._db.commit()
            logger.debug("Ledger flushed %s SEO rows", len(batch))
        except Exception as exc:
            logger.error("Ledger bulk flush failed: %s", exc)
            async with self._buffer_lock:
                self._buffer = batch + self._buffer

    async def fetch_all(self) -> list[dict[str, Any]]:
        await self.flush()
        if not self._db:
            return []
        cursor = await self._db.execute("SELECT * FROM seo_results ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        cols = [d[0] for d in cursor.description or []]
        out: list[dict[str, Any]] = []
        for row in rows:
            item = dict(zip(cols, row))
            for key in ("top_keywords", "image_stats"):
                try:
                    item[key] = json.loads(item[key]) if item.get(key) else ([] if key == "top_keywords" else {})
                except Exception:
                    item[key] = [] if key == "top_keywords" else {}
            out.append(item)
        return out

    async def clear(self) -> None:
        async with self._buffer_lock:
            self._buffer.clear()
        if self._db:
            await self._db.execute("DELETE FROM seo_results")
            await self._db.commit()


_ledger: WriteAheadLedger | None = None


def ledger_enabled() -> bool:
    mode = (os.environ.get("OMNISUITE_SEO_STORAGE") or "sqlite").strip().lower()
    if mode in ("postgres", "postgresql", "pg"):
        return False
    return mode in ("sqlite", "ledger", "dual", "")


def get_ledger() -> WriteAheadLedger:
    global _ledger
    if _ledger is None:
        path = Path(os.environ.get("OMNISUITE_SQLITE_LEDGER_PATH", str(_default_db_path())))
        interval = float(os.environ.get("OMNISUITE_LEDGER_FLUSH_SEC", "4"))
        _ledger = WriteAheadLedger(path, flush_interval_sec=interval)
    return _ledger
