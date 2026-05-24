# OmniSuite Maintenance Guide

A brief document to reduce maintenance costs — please read before adding features.

## Architecture Summary

| Layer | Path | Notes |
|-----|--------|---------|
| Next.js UI | `src/app/dashboard/` | App Router |
| SEO tools | `src/app/dashboard/seo-tools/[slug]/` | Metadata: `src/lib/seo/tool-registry.ts` |
| SEO Hub | `src/app/dashboard/seo-tools/page.tsx` | List generated from `hub-catalog.ts` ← registry |
| Next API | `src/app/api/` | Proxy to Python or TS logic |
| Python engine | `python_engine/` | FastAPI **:8082** — primary source for SEO/keywords/content |
| Legacy interpreter | `scripts/interpreter_service.py` | **:8081** — search keywords, task heartbeat (optional) |
| CLIP / Image | `services/clip_service/` | **:8000** — only when using image pipeline |

**Rules:** New APIs call Python via `getPythonEngineUrl()` (`PYTHON_ENGINE_URL`, port 8082). Legacy interpreter is accessed via `getInterpreterUrl()` (`INTERPRETER_URL`, port 8081). Client does not call Flask directly — use `/api/interpreter/*`.

**Dev:**

| Command | Process |
|------|---------|
| `npm run dev` | Next + python_engine (8082) |
| `npm run dev:legacy` | Plus interpreter (8081) + CLIP (8000) — needed for finding URL keywords & task heartbeat |

## Adding / Modifying SEO Tools

1. Edit **`src/lib/seo/tool-registry.ts`** (slug, title, category, `requires`, `aliasOf`).
2. Pure LLM Tools: Add preset to **`src/lib/seo/llm-tool-presets.ts`** — route `[slug]/page.tsx` renders automatically (no separate folder required).
3. Custom Tools: Create `src/app/dashboard/seo-tools/<slug>/page.tsx` — use `ToolShell`, `GscQueryShell`, or custom UI.
4. Alias: Delete static page; `findTool(slug)` + `[slug]/page.tsx` handles aliases automatically (or re-export to canonical if custom).
5. Hub updates automatically — **do not** manually edit the list on `seo-tools/page.tsx`.

## Large Modules (Avoid bloating)

| File | Handling Strategy when Editing |
|------|---------------------|
| `content/page.tsx` | Move model/job logic → `src/modules/content/hooks/` |
| `keywords/page.tsx` | Move model/retry logic → `src/modules/keywords/hooks/` |
| `api/scrape/route.ts` | Separate handlers according to scrape mode |

## Run & Test

```bash
npm run dev          # Next + python_engine (8082)
npm run dev:legacy   # + interpreter 8081 + CLIP 8000 (keywords search, heartbeat)
npm run typecheck    # TypeScript
npm run test         # pytest python_engine/tests
npm run lint
npm run integrations:verify   # Submodule integrations/
```

## Integrations

Submodules are declared in `.gitmodules`. After cloning, run:

```bash
npm run integrations:sync
scripts/setup-runners-venv.ps1   # Windows
```

## PR Checklist (Minimum)

- [ ] New SEO tool has an entry in `tool-registry.ts`
- [ ] No hardcoded hub catalog duplicates registry
- [ ] Python API uses `getPythonEngineUrl()` / `PYTHON_ENGINE_URL`
- [ ] `npm run typecheck` and `npm run test` pass
