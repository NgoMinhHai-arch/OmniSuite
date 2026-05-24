<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# WORKING RULES (MANDATORY)

1. **EDIT ONLY WHAT IS REQUESTED**: Absolutely do not modify any file, function, or line of code that is not directly mentioned in the requirements.
2. **DO NOT CHANGE UI/UX WITHOUT PERMISSION**: Do not change colors, fonts, layout, effects, or "upgrade" the interface unless there is a specific request to do so.
3. **DO NOT ADD UNNECESSARY FEATURES**: Value simplicity and directness. Do not over-engineer or add redundant libraries/logic "just in case".
4. **ASK BEFORE PROPOSING**: If you see something that can be optimized or made better, you MUST ask the user for permission before implementing it.
5. **PRESERVE CODE STYLE**: Strictly follow the project's existing naming conventions and code structure.

## Maintenance (read before editing)

- Architecture & checklist: **`MAINTENANCE.md`**
- SEO Tools: only edit **`src/lib/seo/tool-registry.ts`** — the hub is auto-generated from registry (`hub-catalog.ts`)
- **Integrations / git submodules:** edit **`integrations/manifest.json`** only, then `npm run integrations:codegen`. Do not hand-edit `*.generated.ts`. Runners live in `integrations/ai-support/runners/` (extend `_runner_base.py`). See **`integrations/README.md`**.
- Python API: use **`getPythonEngineUrl()`** (`PYTHON_ENGINE_URL`, port 8082) — do not add legacy ports
