# Integration template

Sao chép cấu trúc này khi thêm tool mới vào OmniSuite.

## Checklist

- [ ] Thêm entry trong `integrations/manifest.json`
- [ ] `npm run integrations:codegen`
- [ ] `npm run integrations:validate`
- [ ] Nếu **git submodule**: đặt repo dưới `integrations/.../submodules/<name>/`
- [ ] Nếu **ai-support-runner**: tạo `integrations/ai-support/runners/<id>_runner.py` (xem `runner.py.stub`)
- [ ] Cập nhật `scripts/requirements-runners.txt` nếu cần pip package
- [ ] Chạy `scripts/setup-runners-venv.ps1`
- [ ] Thêm slash trong `src/modules/ai-support/domain/slash-commands.ts` nếu có lệnh chat

## Chiến lược tích hợp

| `integrationStrategy` | Khi nào dùng |
|----------------------|--------------|
| `ai-support-runner` | Spawn qua `/api/ai-support/run` |
| `external-app` | App riêng (Docker / Next.js); chỉ document trong registry |

## Runner contract (NDJSON)

- **stdin**: một dòng JSON
- **stdout**: mỗi dòng một event JSON (`ready`, `log`, `step`, `done`, `error`, `setup_required`)
- **exit**: `0` OK · `2` setup_required · `3` task failed · `1` unexpected

Kế thừa `integrations/ai-support/runners/_runner_base.py`.
