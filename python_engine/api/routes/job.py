from fastapi import APIRouter, HTTPException

from python_engine.schemas.job_schemas import JobTailorRequest
from python_engine.services.job_tailor_service import tailor_job_resume

router = APIRouter()


@router.post("/tailor")
async def tailor_resume(request: JobTailorRequest):
    try:
        return await tailor_job_resume(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
