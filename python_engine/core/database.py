import json
import os
from pathlib import Path

import aiosqlite

# Path to the database file
DB_PATH = Path("data/seo_tools.db")


async def init_db():
    """Initializes the database and creates the necessary tables."""
    os.makedirs(DB_PATH.parent, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS seo_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE,
                title TEXT,
                description TEXT,
                h1 TEXT,
                word_count INTEGER,
                keyword_density TEXT,
                keywords_in_title INTEGER,
                keywords_in_meta INTEGER,
                top_keywords TEXT, -- JSON string
                image_stats TEXT,  -- JSON string
                status_code INTEGER,
                response_time_ms FLOAT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()


async def save_seo_result(result_dict: dict):
    """
    Saves or updates an SEO audit result.
    result_dict should follow the SeoAnalysisResponse structure.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        # Convert objects to JSON strings if they aren't already
        top_kws = result_dict.get("top_keywords", [])
        if not isinstance(top_kws, str):
            top_kws = json.dumps(top_kws, ensure_ascii=False)

        img_stats = result_dict.get("image_stats", {})
        if not isinstance(img_stats, str):
            img_stats = json.dumps(img_stats, ensure_ascii=False)

        await db.execute(
            """
            INSERT OR REPLACE INTO seo_results (
                url, title, description, h1, word_count, 
                keyword_density, keywords_in_title, keywords_in_meta,
                top_keywords, image_stats, status_code, response_time_ms,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """,
            (
                str(result_dict.get("url")),
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
            ),
        )
        await db.commit()


async def get_all_seo_results():
    """Retrieves all historical SEO results sorted by date."""
    if not DB_PATH.exists():
        return []

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM seo_results ORDER BY created_at DESC") as cursor:
            rows = await cursor.fetchall()
            results = []
            for row in rows:
                item = dict(row)
                # Deserialize JSON fields
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


async def clear_seo_history():
    """Deletes all records from the seo_results table."""
    if not DB_PATH.exists():
        return

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM seo_results")
        await db.commit()
