from __future__ import annotations

import asyncio
import random
from collections.abc import Callable
from typing import Any

import httpx

from python_engine.core.config import get_settings

settings = get_settings()


class LiteLLMClient:
    def __init__(self) -> None:
        self._semaphore = asyncio.Semaphore(4)
        # OpenRouter free-tier / shared upstream limits: fewer overlapping calls.
        self._openrouter_semaphore = asyncio.Semaphore(2)
        oc = max(1, min(8, int(settings.OLLAMA_MAX_CONCURRENT)))
        self._ollama_semaphore = asyncio.Semaphore(oc)

    @staticmethod
    def _normalize_provider(provider: str | None) -> str:
        raw = (provider or "").strip()
        if not raw:
            raise ValueError(
                "Thiếu provider LLM (provider rỗng). Gửi provider (vd: Gemini, OpenAI, groq) cùng api_key."
            )
        normalized = raw.lower()
        if normalized == "google":
            return "gemini"
        if normalized == "anthropic":
            return "claude"
        return normalized

    @staticmethod
    def _ollama_v1_base(custom_base_url: str | None) -> str:
        raw = (custom_base_url or settings.OLLAMA_BASE_URL or "http://localhost:11434").strip().rstrip("/")
        if raw.endswith("/v1"):
            return raw
        return f"{raw}/v1"

    @staticmethod
    def _openai_compatible_v1_base(provider: str, custom_base_url: str | None) -> str:
        if provider == "ollama":
            return LiteLLMClient._ollama_v1_base(custom_base_url)
        if custom_base_url:
            u = custom_base_url.strip().rstrip("/")
            return u if u.endswith("/v1") else f"{u}/v1"
        return LiteLLMClient._provider_base_url(provider)

    @staticmethod
    def _provider_base_url(provider: str) -> str:
        mapping = {
            "openai": "https://api.openai.com/v1",
            "groq": "https://api.groq.com/openai/v1",
            "deepseek": "https://api.deepseek.com/v1",
            "openrouter": "https://openrouter.ai/api/v1",
            "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
            "google": "https://generativelanguage.googleapis.com/v1beta/openai",
        }
        if provider not in mapping:
            raise ValueError(f"Unsupported provider base URL routing: {provider}")
        return mapping[provider]

    @staticmethod
    def _resolve_api_key(provider: str, explicit_api_key: str | None) -> str:
        if explicit_api_key:
            return explicit_api_key
        mapping = {
            "openai": settings.OPENAI_API_KEY,
            "google": settings.GEMINI_API_KEY,
            "gemini": settings.GEMINI_API_KEY,
            "groq": settings.GROQ_API_KEY,
            "anthropic": settings.CLAUDE_API_KEY,
            "claude": settings.CLAUDE_API_KEY,
            "deepseek": settings.DEEPSEEK_API_KEY,
            "openrouter": settings.OPENROUTER_API_KEY,
            "ollama": settings.OLLAMA_API_KEY,
        }
        key = mapping.get(provider, "") or ""
        if not key and provider == "ollama":
            return "ollama"
        return key

    @staticmethod
    def _default_model_for_provider(provider: str) -> str:
        defaults = {
            "openai": "gpt-4o-mini",
            "groq": "llama-3.3-70b-versatile",
            "gemini": "gemini-1.5-flash",
            "google": "gemini-1.5-flash",
            "deepseek": "deepseek-chat",
            "openrouter": "openai/gpt-4o-mini",
            "claude": "claude-3-5-sonnet-latest",
            "anthropic": "claude-3-5-sonnet-latest",
            "ollama": "llama3.2",
        }
        return defaults.get(provider, "gpt-4o-mini")

    @staticmethod
    def _normalize_model_name(provider: str, model_name: str | None) -> str | None:
        model = (model_name or "").strip()
        if not model:
            return None

        def strip_prefix(value: str, prefix: str) -> str:
            return value[len(prefix) :] if value.startswith(prefix) else value

        if provider == "openrouter":
            return strip_prefix(model, "openrouter/")
        if provider == "groq":
            return strip_prefix(model, "groq/")
        if provider in {"claude", "anthropic"}:
            return strip_prefix(model, "anthropic/")
        if provider in {"gemini", "google"}:
            model = strip_prefix(model, "models/")
            model = strip_prefix(model, "google/")
            model = strip_prefix(model, "gemini/")
            return model
        if provider == "deepseek":
            return strip_prefix(model, "deepseek/")
        if provider == "openai":
            return strip_prefix(model, "openai/")
        if provider == "ollama":
            return strip_prefix(model, "ollama/")
        return model

    @staticmethod
    def _litellm_provider_name(provider: str) -> str:
        if provider == "claude":
            return "anthropic"
        if provider == "google":
            return "gemini"
        return provider

    async def generate(
        self,
        *,
        provider: str | None,
        model_name: str | None,
        api_key: str | None,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.6,
        max_tokens: int = 1400,
        custom_base_url: str | None = None,
    ) -> str:
        provider_normalized = self._normalize_provider(provider)
        normalized_model_name = self._normalize_model_name(provider_normalized, model_name)
        resolved_key = self._resolve_api_key(provider_normalized, api_key)
        if not resolved_key and provider_normalized != "ollama":
            raise ValueError(f"Missing API key for provider: {provider_normalized}")
        if provider_normalized == "ollama" and not resolved_key:
            resolved_key = "ollama"

        litellm_url = getattr(settings, "LITELLM_BASE_URL", "") or ""
        if litellm_url:
            return await self._generate_via_litellm(
                litellm_url=litellm_url,
                provider=provider_normalized,
                model_name=normalized_model_name,
                api_key=resolved_key,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
            )

        if provider_normalized in {"claude", "anthropic"}:
            return await self._generate_anthropic(
                provider=provider_normalized,
                model_name=normalized_model_name,
                api_key=resolved_key,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                custom_base_url=custom_base_url,
            )

        return await self._generate_direct(
            provider=provider_normalized,
            model_name=normalized_model_name,
            api_key=resolved_key,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            custom_base_url=custom_base_url,
        )

    async def _generate_via_litellm(
        self,
        *,
        litellm_url: str,
        provider: str,
        model_name: str | None,
        api_key: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        litellm_provider = self._litellm_provider_name(provider)
        model = model_name or self._default_model_for_provider(provider)
        if "/" not in model:
            model = f"{litellm_provider}/{model}"
        endpoint = f"{litellm_url.rstrip('/')}/v1/chat/completions"
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
        body: dict[str, Any] = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if provider == "ollama":
            body["keep_alive"] = settings.OLLAMA_KEEP_ALIVE
            num_ctx = int(settings.OLLAMA_NUM_CTX or 0)
            if num_ctx > 0:
                body["options"] = {"num_ctx": num_ctx}
                body["num_ctx"] = num_ctx
        if provider == "ollama":
            sem = self._ollama_semaphore
            http_timeout = float(settings.OLLAMA_HTTP_TIMEOUT_SEC)
        elif provider == "openrouter":
            sem = self._openrouter_semaphore
            http_timeout = 90.0
        else:
            sem = self._semaphore
            http_timeout = 90.0
        return await self._post_with_retry(
            endpoint=endpoint,
            headers=headers,
            body=body,
            semaphore=sem,
            context={"provider": provider, "model": model},
            response_parser=self._parse_openai_style_response,
            http_timeout=http_timeout,
        )

    async def _generate_direct(
        self,
        *,
        provider: str,
        model_name: str | None,
        api_key: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int,
        custom_base_url: str | None,
    ) -> str:
        model = model_name or self._default_model_for_provider(provider)
        base_url = self._openai_compatible_v1_base(provider, custom_base_url)
        endpoint = f"{base_url.rstrip('/')}/chat/completions"
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
        if provider == "openrouter":
            headers["HTTP-Referer"] = "http://localhost:3000"
            headers["X-Title"] = "OmniSuite AI"
        body: dict[str, Any] = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if provider == "ollama":
            body["keep_alive"] = settings.OLLAMA_KEEP_ALIVE
            num_ctx = int(settings.OLLAMA_NUM_CTX or 0)
            if num_ctx > 0:
                body["options"] = {"num_ctx": num_ctx}
                body["num_ctx"] = num_ctx
            sem = self._ollama_semaphore
            http_timeout = float(settings.OLLAMA_HTTP_TIMEOUT_SEC)
        elif provider == "openrouter":
            sem = self._openrouter_semaphore
            http_timeout = 90.0
        else:
            sem = self._semaphore
            http_timeout = 90.0
        return await self._post_with_retry(
            endpoint=endpoint,
            headers=headers,
            body=body,
            semaphore=sem,
            context={"provider": provider, "model": model},
            response_parser=self._parse_openai_style_response,
            http_timeout=http_timeout,
        )

    @staticmethod
    def _parse_openai_style_response(data: dict[str, Any]) -> str:
        return (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )

    @staticmethod
    def _parse_anthropic_response(data: dict[str, Any]) -> str:
        content = data.get("content", [])
        if not isinstance(content, list):
            return ""
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text = item.get("text")
                if isinstance(text, str):
                    return text.strip()
        return ""

    async def _generate_anthropic(
        self,
        *,
        provider: str,
        model_name: str | None,
        api_key: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int,
        custom_base_url: str | None,
    ) -> str:
        model = model_name or self._default_model_for_provider(provider)
        base_url = custom_base_url or "https://api.anthropic.com/v1"
        endpoint = f"{base_url.rstrip('/')}/messages"
        headers: dict[str, str] = {
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        }
        body = {
            "model": model,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        return await self._post_with_retry(
            endpoint=endpoint,
            headers=headers,
            body=body,
            semaphore=self._semaphore,
            context={"provider": "claude", "model": model},
            response_parser=self._parse_anthropic_response,
        )

    @staticmethod
    def _summarize_error_response(resp: httpx.Response) -> str:
        raw = resp.text
        try:
            data = resp.json()
            err = data.get("error")
            if isinstance(err, dict):
                msg = err.get("message") or raw
                normalized_msg = msg.lower()
                if resp.status_code == 429 and (
                    "quota exceeded" in normalized_msg
                    or "resource_exhausted" in normalized_msg
                    or "limit: 0" in normalized_msg
                ):
                    return (
                        "429 Quota exceeded on current provider/model. "
                        "Please add billing/credits or switch provider/model in Settings."
                    )
                meta = err.get("metadata") if isinstance(err.get("metadata"), dict) else {}
                raw_hint = meta.get("raw")
                if raw_hint and isinstance(raw_hint, str):
                    msg = f"{msg} ({raw_hint[:280]})"
                return f'{resp.status_code} {msg}'
            if isinstance(err, str):
                return f"{resp.status_code} {err}"
        except Exception:
            pass
        return f"{resp.status_code} {raw[:800]}"

    @staticmethod
    def _is_hard_quota_exceeded(resp: httpx.Response) -> bool:
        if resp.status_code != 429:
            return False
        body = resp.text.lower()
        return (
            "quota exceeded" in body
            or "resource_exhausted" in body
            or "limit: 0" in body
        )

    @staticmethod
    def _format_context(context: dict[str, str] | None) -> str:
        if not context:
            return ""
        provider = context.get("provider", "")
        model = context.get("model", "")
        bits: list[str] = []
        if provider:
            bits.append(f"provider/{provider}")
        if model:
            bits.append(f"model={model}")
        return " ".join(f"[{b}]" for b in bits)

    async def _sleep_backoff(
        self,
        *,
        attempt: int,
        base_delay: float,
        status_code: int,
        resp: httpx.Response | None,
    ) -> None:
        """429 gets longer waits + honors Retry-After; other retries use exponential backoff + jitter."""
        if status_code == 429 and resp is not None:
            retry_after = resp.headers.get("Retry-After")
            if retry_after:
                try:
                    wait = float(retry_after)
                    wait = max(1.0, min(wait, 90.0))
                    await asyncio.sleep(wait + random.uniform(0, 0.5))
                    return
                except ValueError:
                    pass
            wait = min(base_delay * (2**attempt), 48.0) + random.uniform(0, base_delay)
            await asyncio.sleep(wait)
            return
        wait = min(base_delay * (2**attempt), 24.0) + random.uniform(0, 1.0)
        await asyncio.sleep(wait)

    async def _post_with_retry(
        self,
        *,
        endpoint: str,
        headers: dict[str, str],
        body: dict[str, Any],
        semaphore: asyncio.Semaphore,
        context: dict[str, str] | None = None,
        response_parser: Callable[[dict[str, Any]], str] | None = None,
        http_timeout: float = 90.0,
    ) -> str:
        base_delay = 2.5
        last_error = "Unknown LiteLLM error"
        max_attempts = 7
        parser = response_parser or self._parse_openai_style_response
        ctx = self._format_context(context)
        async with semaphore:
            for attempt in range(max_attempts):
                try:
                    async with httpx.AsyncClient(timeout=http_timeout) as client:
                        resp = await client.post(endpoint, headers=headers, json=body)
                    if resp.status_code < 400:
                        data = resp.json()
                        return parser(data)
                    last_error = self._summarize_error_response(resp)
                    if resp.status_code == 429:
                        # Do not waste retries when provider reports hard quota exhausted.
                        if self._is_hard_quota_exceeded(resp):
                            break
                        if attempt < max_attempts - 1:
                            await self._sleep_backoff(
                                attempt=attempt,
                                base_delay=base_delay,
                                status_code=429,
                                resp=resp,
                            )
                            continue
                        break
                    if resp.status_code in (500, 502, 503, 504):
                        if attempt < max_attempts - 1:
                            await self._sleep_backoff(
                                attempt=attempt,
                                base_delay=base_delay,
                                status_code=resp.status_code,
                                resp=None,
                            )
                            continue
                        break
                    break
                except Exception as exc:
                    last_error = str(exc)
                    if attempt < max_attempts - 1:
                        await self._sleep_backoff(
                            attempt=attempt,
                            base_delay=base_delay,
                            status_code=0,
                            resp=None,
                        )
                        continue
                    break
            prefix = f"{ctx} " if ctx else ""
            raise RuntimeError(f"LLM generation failed: {prefix}{last_error}")


litellm_client = LiteLLMClient()

