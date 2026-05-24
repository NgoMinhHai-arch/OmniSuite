# OmniSuite Integrations

Thư mục `integrations/` gom **git submodule**, **Python runners** và **app bên thứ ba** mà AI Hỗ trợ biết tới.

## Kiến trúc (3 lớp)

```
integrations/manifest.json     ← nguồn sự thật (SSOT)
        │
        ├─► scripts/generate-integrations-registry.js
        │         └─► src/modules/ai-support/domain/*.generated.ts
        │
        ├─► scripts/validate-integrations.js  (CI / pre-push)
        │
        └─► scripts/sync-integrations.js      (git submodule sync)
```

| Lớp | Vai trò |
|-----|---------|
| **manifest** | Mô tả id, path, runner, probe, submodule URL |
| **submodule** | Mã upstream (browser-use, OpenManus) — không sửa trực tiếp |
| **runners** | Cầu nối OmniSuite → subprocess Python (NDJSON) |
| **external-app** | Chạy độc lập; registry chỉ hướng dẫn setup |

## Lệnh thường dùng

```bash
npm run integrations:sync      # git submodule update
npm run integrations:verify    # kiểm tra submodule + manifest
npm run integrations:codegen   # tái sinh registry từ manifest
```

## Thêm integration mới

1. Sao chép `integrations/_template/`
2. Thêm block vào `integrations/manifest.json`
3. `npm run integrations:codegen`
4. `npm run integrations:validate`
5. Nếu là git submodule: cập nhật `.gitmodules` (hoặc chạy codegen — tự sinh từ manifest)

Chi tiết: `integrations/_template/README.md`

## Ranh giới

- `src/` **không** import code từ `integrations/` — chỉ spawn runner hoặc gọi HTTP app ngoài.
- Submodule upstream: patch qua fork hoặc wrapper trong `integrations/ai-support/runners/`.
