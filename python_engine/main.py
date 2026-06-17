from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends

from python_engine.api.routes import content, job, keywords, seo
from python_engine.core import database
from python_engine.core.config import DEFAULT_INTERNAL_TOKEN, get_settings
from python_engine.core.logger import get_logger
from python_engine.core.auth import verify_token

settings = get_settings()
logger = get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Python Engine application...")
    from python_engine.core.browser_task_queue import get_browser_queue

    if (settings.INTERNAL_TOKEN or "").strip() == DEFAULT_INTERNAL_TOKEN:
        logger.warning(
            "Python Engine is using the default INTERNAL_TOKEN. This is intended only for local development."
        )

    await database.init_db()
    await get_browser_queue().start()
    yield
    logger.info("Shutting down Python Engine application...")
    await get_browser_queue().stop()
    await database.shutdown_db()


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend Python Ä‘á»™c láº­p phá»¥c vá»¥ OmniSuite AI - Thay tháº¿ child_process",
    version="1.0.0",
    lifespan=lifespan,
)

# ÄÄƒng kÃ½ cÃ¡c Router vá»›i cÆ¡ cháº¿ xÃ¡c thá»±c token ná»™i bá»™
app.include_router(seo.router, prefix="/api/seo", tags=["SEO"], dependencies=[Depends(verify_token)])
app.include_router(keywords.router, prefix="/api/keywords", tags=["Keywords"], dependencies=[Depends(verify_token)])
app.include_router(content.router, prefix="/api/content", tags=["Content"], dependencies=[Depends(verify_token)])
app.include_router(job.router, prefix="/api/job", tags=["Job"], dependencies=[Depends(verify_token)])


@app.get("/")
async def root():
    return {
        "status": "online",
        "engine": settings.APP_NAME,
        "message": "Server-to-Server Only. No CORS allowed.",
    }


if __name__ == "__main__":
    import os

    import uvicorn

    def _bind_host() -> str:
        v = (os.environ.get("OMNISUITE_LOCALHOST_ONLY") or "1").strip().lower()
        if v in ("0", "false", "no"):
            return "0.0.0.0"
        return "127.0.0.1"

    port = int(os.environ.get("PORT", settings.PORT))
    host = _bind_host()
    uvicorn.run("python_engine.main:app", host=host, port=port, reload=True)
