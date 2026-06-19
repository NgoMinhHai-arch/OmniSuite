# OmniSuite System Contract

OmniSuite should not be a pile of unrelated launch scripts, ports, env defaults, and dashboard assumptions. The shared contract lives at:

```text
config/omnisuite.system.json
```

This file is the source of truth for the local runtime shape.

## What it connects

- Dashboard URL
- Environment defaults
- Service list
- Ports
- Health URLs
- Setup state file
- Dependency signature files
- User-facing commands

## Current services

| Service | Port | Required | Notes |
| :--- | :--- | :--- | :--- |
| Python Backend | 8081 | No | Started through `scripts/start-backend.js` |
| Image Pipeline / CLIP | 8000 | No | Managed by Python Backend |
| Python Engine | 8082 | Yes | FastAPI engine for SEO/keyword/content/job routes |
| Next.js Frontend | 3000 | Yes | Main dashboard |

## Status endpoint

Runtime status is exposed through:

```text
GET /api/system/status
```

The endpoint returns:

- configured API key flags from `.env`;
- effective API key flags when the dashboard sends local settings;
- service health from `config/omnisuite.system.json`;
- setup state from `.omnisuite/quick-start-state.json`;
- command hints such as `01_START_OMNISUITE.bat`, stop, and uninstall.

## Rule

When adding or changing a local service, update `config/omnisuite.system.json` first.

Do not hard-code a new port or startup assumption in a random file unless the contract is updated too. That is how software turns into archaeology with syntax highlighting.

## Intended flow

```text
01_START_OMNISUITE.bat
        ↓
config/omnisuite.system.json
        ↓
.env defaults + setup state + services
        ↓
/api/system/status
        ↓
Dashboard can show what is ready, degraded, or missing
```

The launcher still has legacy compatibility, but all new runtime coordination should point toward this contract.
