import pytest
from httpx import ASGITransport, AsyncClient

from python_engine.main import app


@pytest.mark.asyncio
async def test_content_job_not_found():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/content/jobs/not-found")
    assert response.status_code == 404

