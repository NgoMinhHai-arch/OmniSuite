# OmniSuite Maintenance Guide

Short guide for keeping OmniSuite architecture clean and predictable.

## Core runtime

Main execution path:

`Next.js UI -> Next API -> Python FastAPI :8082 -> UI`

Core layers:

| Layer | Path | Notes |
|---|---|---|
| Next.js UI | `src/app/dashboard/` | App Router |
| Next API | `src/app/api/` | Server bridge layer |
| Python engine | `python_engine/` | FastAPI `:8082` for SEO, keywords, content, jobs |
| SEO tools | `src/app/dashboard/seo-tools/[slug]/` | Tool pages |
| SEO Hub | `src/app/dashboard/seo-tools/page.tsx` | Generated from registry |

Rules:

- New Next API routes that call Python must use `getPythonEngineUrl()`.
- Core features should assume only the `8082` engine is required.
- JSON errors from Next API should be explicit when Python is unreachable, unauthorized, or returns invalid data.

## Optional runtime

These are optional and must not be presented as required for the core:

| Layer | Path | Notes |
|---|---|---|
| Legacy interpreter | `scripts/interpreter_service.py` | `:8081`, optional |
| CLIP / image pipeline | `services/clip_service/` | `:8000`, optional |
| Integrations | `integrations/` | OpenManus, browser-use, Crawl4AI, JobOps, etc. |

## Dev commands

| Command | Process |
|---|---|
| `npm run dev` | Core runtime: Next + Python FastAPI `8082` |
| `npm run dev:legacy` | Core runtime + optional `8081` + optional `8000` |

## Adding or modifying SEO tools

1. Edit `src/lib/seo/tool-registry.ts`.
2. Pure LLM tools: add preset to `src/lib/seo/llm-tool-presets.ts`.
3. Custom tools: create `src/app/dashboard/seo-tools/<slug>/page.tsx`.
4. Alias tools should resolve through registry, not duplicate static pages.
5. Do not manually maintain a second hardcoded SEO hub list.

## Large modules

| File | Handling strategy |
|---|---|
| `content/page.tsx` | Move model/job logic into `src/modules/content/hooks/` |
| `keywords/page.tsx` | Move model/retry logic into `src/modules/keywords/hooks/` |
| `api/scrape/route.ts` | Separate handlers by scrape mode |

## Run and test

```bash
npm run dev
npm run dev:legacy
npm run typecheck
npm run lint
npm run test
```

## Integrations

Single source of truth:

`integrations/manifest.json -> npm run integrations:codegen -> generated files in src/modules/ai-support/domain/`

Integrations are optional. Core SEO and AI Butler do not require OpenManus, browser-use, or JobOps to exist on disk.

## PR checklist

- New Python bridge code uses `getPythonEngineUrl()`
- Core runtime still works with only Next + Python `8082`
- Optional runtimes are documented as optional
- `npm run typecheck` passes
- `npm run test` passes when Python environment is ready
