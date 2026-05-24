# Integration template

Copy this layout when adding a new tool to OmniSuite.

## Checklist

- [ ] Add entry in `integrations/manifest.json`
- [ ] `npm run integrations:codegen`
- [ ] `npm run integrations:validate`
- [ ] If **git submodule**: place repo under `integrations/.../submodules/<name>/`
- [ ] If **ai-support-runner**: add `integrations/ai-support/runners/<id>_runner.py` (see `runner.py.stub`)
- [ ] Update `scripts/requirements-runners.txt` if a pip package is needed
- [ ] Run `scripts/setup-runners-venv.ps1`
- [ ] Add slash command in `src/modules/ai-support/domain/slash-commands.ts` if exposed in chat

## Integration strategy

| `integrationStrategy` | When to use |
|----------------------|-------------|
| `ai-support-runner` | Spawned via `/api/ai-support/run` |
| `external-app` | Separate app (Docker / Next.js); documented in registry only |

## Runner contract (NDJSON)

- **stdin**: one JSON line
- **stdout**: one JSON event per line (`ready`, `log`, `step`, `done`, `error`, `setup_required`)
- **exit**: `0` OK · `2` setup_required · `3` task failed · `1` unexpected

Extend `integrations/ai-support/runners/_runner_base.py`.
