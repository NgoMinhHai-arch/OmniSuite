from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timezone
from difflib import SequenceMatcher
from uuid import uuid4

from python_engine.schemas.content_schemas import (
    BulkContentJobRequest,
    BulkContentJobStatus,
    JobProgress,
)
from python_engine.services.content_service import GenerationRuntime, generate_bulk_item


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ContentQueueService:
    def __init__(self) -> None:
        self._jobs: dict[str, BulkContentJobStatus] = {}
        self._tasks: dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()

    async def create_job(self, req: BulkContentJobRequest) -> BulkContentJobStatus:
        job_id = str(uuid4())
        status = BulkContentJobStatus(
            id=job_id,
            status="queued",
            progress=JobProgress(completed=0, total=len(req.variants), currentKeyword=None),
            createdAt=_now(),
            updatedAt=_now(),
            results=[],
        )
        async with self._lock:
            self._jobs[job_id] = status
        task = asyncio.create_task(self._run_job(job_id, req))
        self._tasks[job_id] = task
        return status

    async def get_job(self, job_id: str) -> BulkContentJobStatus | None:
        async with self._lock:
            return self._jobs.get(job_id)

    async def cancel_job(self, job_id: str) -> BulkContentJobStatus | None:
        task = self._tasks.get(job_id)
        if task and not task.done():
            task.cancel()
        async with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.status = "cancelled"
                job.updatedAt = _now()
            return job

    async def _run_job(self, job_id: str, req: BulkContentJobRequest) -> None:
        try:
            async with self._lock:
                job = self._jobs[job_id]
                job.status = "running"
                job.updatedAt = _now()

            runtime = GenerationRuntime(
                provider=req.provider,
                model_name=req.modelName,
                api_key=req.apiKey,
                custom_base_url=req.customBaseUrl,
                tavily_api_key=req.tavilyApiKey,
            )
            dedupe_hashes: set[str] = set()

            for index, variant in enumerate(req.variants):
                normalized = f"{variant.keyword}|{variant.platformPreset}|{variant.framework}".lower()
                h = hashlib.sha1(normalized.encode("utf-8")).hexdigest()
                if h in dedupe_hashes:
                    continue
                dedupe_hashes.add(h)

                async with self._lock:
                    job = self._jobs[job_id]
                    if job.status == "cancelled":
                        return
                    job.progress.currentKeyword = variant.keyword
                    job.updatedAt = _now()

                result = await generate_bulk_item(variant, runtime)

                # OpenRouter shared/free tiers: space out variants to reduce upstream 429.
                if str(req.provider or "").strip().lower() == "openrouter":
                    await asyncio.sleep(0.85)
                elif str(req.provider or "").strip().lower() == "ollama":
                    await asyncio.sleep(0.45)

                # similarity guardrail against previous results
                too_similar = False
                for old in self._jobs[job_id].results:
                    similarity = SequenceMatcher(None, old.article[:2500], result.article[:2500]).ratio()
                    if similarity >= 0.9:
                        too_similar = True
                        break
                if too_similar:
                    continue

                async with self._lock:
                    job = self._jobs[job_id]
                    job.results.append(result)
                    job.progress.completed = min(index + 1, job.progress.total)
                    job.updatedAt = _now()

            async with self._lock:
                job = self._jobs[job_id]
                if job.status != "cancelled":
                    job.status = "completed"
                    job.progress.currentKeyword = None
                    job.updatedAt = _now()
        except asyncio.CancelledError:
            async with self._lock:
                job = self._jobs.get(job_id)
                if job:
                    job.status = "cancelled"
                    job.updatedAt = _now()
            return
        except Exception as exc:  # noqa: BLE001
            async with self._lock:
                job = self._jobs.get(job_id)
                if job:
                    job.status = "failed"
                    job.error = str(exc)
                    job.updatedAt = _now()


content_queue_service = ContentQueueService()

