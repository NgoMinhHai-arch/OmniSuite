import json

import asyncpg

from python_engine.core.config import get_settings
from python_engine.core.logger import get_logger
from python_engine.core.sqlite_ledger import get_ledger, ledger_enabled

settings = get_settings()
logger = get_logger()

_pool = None


def _postgres_skipped() -> bool:
    return (get_settings().DATABASE_URL or "").strip().lower() in (
        "",
        "skip",
        "none",
        "disabled",
    )


async def get_pool():
    """Gets or creates the PostgreSQL connection pool (optional)."""
    global _pool
    if _postgres_skipped():
        return None
    if _pool is None:
        try:
            logger.info("Initializing PostgreSQL database connection pool...")
            _pool = await asyncpg.create_pool(
                settings.DATABASE_URL,
                min_size=1,
                max_size=10,
                max_queries=50000,
                max_inactive_connection_lifetime=300.0,
            )
            logger.info("PostgreSQL database connection pool initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to create PostgreSQL database connection pool: {e}")
            raise e
    return _pool


async def init_db():
    """Initialize optional PostgreSQL + SQLite Write-Ahead Ledger."""
    global _pool

    if ledger_enabled():
        await get_ledger().start()

    if _postgres_skipped():
        logger.warning("DATABASE_URL empty/skip — SEO PostgreSQL persistence disabled (SQLite ledger active).")
        return

    try:
        pool = await get_pool()
        if not pool:
            return
        async with pool.acquire() as conn:
            logger.info("Creating seo_results table if not exists...")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS seo_results (
                    id SERIAL PRIMARY KEY,
                    url TEXT UNIQUE,
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
                    response_time_ms FLOAT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.info("Database schema initialized successfully.")
    except Exception as e:
        _pool = None
        logger.warning(
            "PostgreSQL unavailable (%s). Python engine still runs; SEO history uses SQLite ledger.",
            e,
        )


async def shutdown_db():
    if ledger_enabled():
        await get_ledger().stop()
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def save_seo_result(result_dict: dict):
    """Buffered write via SQLite ledger; optional dual-write to PostgreSQL."""
    if ledger_enabled():
        await get_ledger().enqueue(result_dict)

    if _postgres_skipped():
        return

    try:
        pool = await get_pool()
        if not pool:
            return
        async with pool.acquire() as conn:
            top_kws = result_dict.get("top_keywords", [])
            if not isinstance(top_kws, str):
                top_kws = json.dumps(top_kws, ensure_ascii=False)

            img_stats = result_dict.get("image_stats", {})
            if not isinstance(img_stats, str):
                img_stats = json.dumps(img_stats, ensure_ascii=False)

            url = str(result_dict.get("url"))
            await conn.execute(
                """
                INSERT INTO seo_results (
                    url, title, description, h1, word_count,
                    keyword_density, keywords_in_title, keywords_in_meta,
                    top_keywords, image_stats, status_code, response_time_ms,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
                ON CONFLICT (url) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    h1 = EXCLUDED.h1,
                    word_count = EXCLUDED.word_count,
                    keyword_density = EXCLUDED.keyword_density,
                    keywords_in_title = EXCLUDED.keywords_in_title,
                    keywords_in_meta = EXCLUDED.keywords_in_meta,
                    top_keywords = EXCLUDED.top_keywords,
                    image_stats = EXCLUDED.image_stats,
                    status_code = EXCLUDED.status_code,
                    response_time_ms = EXCLUDED.response_time_ms,
                    created_at = CURRENT_TIMESTAMP
                """,
                url,
                result_dict.get("title"),
                result_dict.get("description"),
                result_dict.get("h1"),
                result_dict.get("word_count", 0),
                result_dict.get("keyword_density", "0.00%"),
                result_dict.get("keywords_in_title", 0),
                result_dict.get("keywords_in_meta", 0),
                top_kws,
                img_stats,
                result_dict.get("status_code", 200),
                result_dict.get("response_time_ms", 0.0),
            )
    except Exception as e:
        logger.error(f"Failed to save SEO result to PostgreSQL for {result_dict.get('url')}: {e}")


async def get_all_seo_results():
    """Read history from SQLite ledger (always) with PostgreSQL fallback when configured."""
    if ledger_enabled():
        rows = await get_ledger().fetch_all()
        if rows:
            return rows

    if _postgres_skipped():
        return []

    try:
        pool = await get_pool()
        if not pool:
            return []
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM seo_results ORDER BY created_at DESC")
            results = []
            for row in rows:
                item = dict(row)
                try:
                    item["top_keywords"] = json.loads(item["top_keywords"])
                except Exception:
                    item["top_keywords"] = []
                try:
                    item["image_stats"] = json.loads(item["image_stats"])
                except Exception:
                    item["image_stats"] = {}
                results.append(item)
            return results
    except Exception as e:
        logger.error(f"Failed to retrieve SEO results: {e}")
        return []


async def clear_seo_history():
    if ledger_enabled():
        await get_ledger().clear()
    if _postgres_skipped():
        return
    try:
        pool = await get_pool()
        if not pool:
            return
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM seo_results")
    except Exception as e:
        logger.error(f"Failed to clear SEO history: {e}")
        raise e
