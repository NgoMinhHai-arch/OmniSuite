# OmniSuite Integrations

Thư mục `integrations/` gom **git submodule**, **Python runners** và **app bên thứ ba** mà AI Hỗ trợ biết tới.

> **Cảnh báo ZIP:** Tải repo dạng **Download ZIP** trên GitHub sẽ **không** có mã trong các thư mục con (submodule). Dùng `git clone` hoặc sau đó `npm run integrations:fetch -- <id>`. Trong Quản gia: `/tai-bang` xem trạng thái đã/chưa tải.

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

## Cách dùng (người dùng cuối)

1. `git clone https://github.com/NgoMinhHai-arch/OmniSuite.git`
2. `npm install` + chạy `01_START_OMNISUITE.bat`
3. Trong **Quản gia AI**, lần đầu gõ `/run` hoặc `/run-browser` → app **tự tải** đúng gói đó (không tải hết lúc setup).

## Lệnh tùy chọn (dev / tải tay)

```bash
npm run integrations:fetch -- open_manus    # chỉ OpenManus
npm run integrations:fetch -- browser_use     # chỉ browser-use
npm run integrations:sync:all                 # tải hết (không bắt buộc)
npm run integrations:validate
npm run integrations:codegen
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
