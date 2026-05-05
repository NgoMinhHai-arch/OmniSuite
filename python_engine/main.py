from contextlib import asynccontextmanager

from fastapi import FastAPI

from python_engine.api.routes import keywords, seo
from python_engine.core import database
from python_engine.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB on startup
    await database.init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend Python độc lập phục vụ OmniSuite AI - Thay thế child_process",
    version="1.0.0",
    lifespan=lifespan,
)

# Đăng ký các Router
app.include_router(seo.router, prefix="/api/seo", tags=["SEO"])
app.include_router(keywords.router, prefix="/api/keywords", tags=["Keywords"])


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

    port = int(os.environ.get("PORT", settings.PORT))
    uvicorn.run("python_engine.main:app", host="0.0.0.0", port=port, reload=True)
