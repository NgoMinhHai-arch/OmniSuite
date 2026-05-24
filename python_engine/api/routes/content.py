from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from python_engine.schemas.content_schemas import (
    BulkContentJobRequest,
    ContentOutlineRequest,
    ContentSectionRequest,
)
from python_engine.services.content_queue import content_queue_service
from python_engine.services.content_service import generate_outline, generate_section

router = APIRouter()


@router.post("/outline")
async def create_outline(request: ContentOutlineRequest):
    try:
        result = await generate_outline(request)
        return result
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/section", response_class=PlainTextResponse)
async def create_section(request: ContentSectionRequest):
    try:
        content = await generate_section(request)
        return content
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/jobs")
async def create_job(request: BulkContentJobRequest):
    try:
        status = await content_queue_service.create_job(request)
        return status
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    status = await content_queue_service.get_job(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    return status


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    status = await content_queue_service.cancel_job(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    return status

