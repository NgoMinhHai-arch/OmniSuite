"""Lightweight asyncio task queue for browser-heavy jobs (no Celery/Redis)."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

from python_engine.core.concurrency_throttle import get_throttle

T = TypeVar("T")


class BrowserTaskQueue:
    def __init__(self) -> None:
        self._queue: asyncio.Queue[
            tuple[Callable[[], Awaitable[T]], asyncio.Future[T]] | None
        ] = asyncio.Queue()
        self._worker: asyncio.Task | None = None

    async def start(self) -> None:
        if self._worker and not self._worker.done():
            return
        self._worker = asyncio.create_task(self._worker_loop(), name="browser-task-queue")

    async def stop(self) -> None:
        if self._worker:
            await self._queue.put(None)
            try:
                await asyncio.wait_for(self._worker, timeout=10)
            except asyncio.TimeoutError:
                self._worker.cancel()
            self._worker = None

    async def _worker_loop(self) -> None:
        throttle = get_throttle()
        while True:
            item = await self._queue.get()
            if item is None:
                self._queue.task_done()
                break
            factory, fut = item
            try:
                async with throttle.browser_slot():
                    result = await factory()
                    if not fut.done():
                        fut.set_result(result)
            except Exception as exc:
                if not fut.done():
                    fut.set_exception(exc)
            finally:
                self._queue.task_done()

    async def submit(self, factory: Callable[[], Awaitable[T]]) -> T:
        loop = asyncio.get_running_loop()
        fut: asyncio.Future[T] = loop.create_future()
        await self._queue.put((factory, fut))
        return await fut


_queue: BrowserTaskQueue | None = None


def get_browser_queue() -> BrowserTaskQueue:
    global _queue
    if _queue is None:
        _queue = BrowserTaskQueue()
    return _queue
