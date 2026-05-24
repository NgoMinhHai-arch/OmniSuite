"""RAM-aware dynamic concurrency for Playwright / browser-use workloads."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

try:
    import psutil
except ImportError:
    psutil = None  # type: ignore


class DynamicConcurrencyThrottle:
    """Limit parallel browser sessions based on available RAM."""

    def __init__(self) -> None:
        self._active = 0
        self._lock = asyncio.Lock()

    @staticmethod
    def max_concurrent() -> int:
        if psutil is None:
            return 1
        try:
            gb = psutil.virtual_memory().available / (1024**3)
        except Exception:
            return 1
        if gb >= 4.0:
            return 3
        if gb >= 2.0:
            return 2
        if gb >= 1.0:
            return 1
        return 1

    @asynccontextmanager
    async def browser_slot(self):
        while True:
            async with self._lock:
                cap = self.max_concurrent()
                if self._active < cap:
                    self._active += 1
                    break
            await asyncio.sleep(0.4)
        try:
            yield
        finally:
            async with self._lock:
                self._active = max(0, self._active - 1)


_throttle = DynamicConcurrencyThrottle()


def get_throttle() -> DynamicConcurrencyThrottle:
    return _throttle
