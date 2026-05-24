# OmniSuite Integrations

The `integrations/` folder holds **git submodules**, **Python runners**, and **third-party apps** that AI Butler knows about.

> **Downloads:** Neither **ZIP** nor **`git clone`** bundles OpenManus, JobOps, browser-use, Crawl4AI, etc. Users **fetch each package themselves** (`integrations:fetch`, first `/run`, or `git clone` into the listed `path`). ZIP leaves folders empty; clone provides helper scripts. In AI Butler: `/tai-bang`, `/tai`.

## Architecture (3 layers)

```
integrations/manifest.json     ← single source of truth (SSOT)
        │
        ├─► scripts/generate-integrations-registry.js
        │         └─► src/modules/ai-support/domain/*.generated.ts
        │
        ├─► scripts/validate-integrations.js  (CI / pre-push)
        │
        └─► scripts/sync-integrations.js      (git submodule sync)
```

| Layer | Role |
|-------|------|
| **manifest** | id, path, runner, probe, submodule URL |
| **submodule** | Upstream code (browser-use, OpenManus) — do not edit in place |
| **runners** | Bridge OmniSuite → Python subprocess (NDJSON) |
| **external-app** | Runs standalone; registry documents setup only |

## End-user workflow

1. `git clone https://github.com/NgoMinhHai-arch/OmniSuite.git` (avoid ZIP when possible)
2. `npm install` + run `01_START_OMNISUITE.bat` → **SEO + AI Butler chat** work
3. **Each integration** (OpenManus, JobOps, …): user **downloads separately** — not included after steps 1–2
4. Examples: `/run` or `npm run integrations:fetch -- open_manus` · status table: `/tai-bang` in AI Butler

## Optional commands (dev / manual fetch)

```bash
npm run integrations:fetch -- open_manus      # OpenManus only
npm run integrations:fetch -- browser_use   # browser-use only
npm run integrations:fetch -- crawl4ai      # Crawl4AI web stack
npm run integrations:fetch -- activepieces  # Activepieces
npm run integrations:fetch -- --list        # list fetchable IDs
npm run integrations:sync:all               # fetch all (dev only)
npm run integrations:validate
npm run integrations:codegen
```

## Add a new integration

1. Copy `integrations/_template/`
2. Add a block to `integrations/manifest.json`
3. `npm run integrations:codegen`
4. `npm run integrations:validate`
5. For git submodules: update `.gitmodules` (or run codegen — generated from manifest)

Details: `integrations/_template/README.md`

## Boundaries

- `src/` does **not** import code from `integrations/` — only spawns runners or calls external HTTP apps.
- Upstream submodules: patch via fork or wrappers in `integrations/ai-support/runners/`.
