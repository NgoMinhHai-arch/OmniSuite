# Bảo mật OmniSuite (đa lớp)

## Lớp 1 — Chặn lộ API key lên GitHub

- `npm run security:scan` — quét toàn bộ file đang track
- `npm run security:scan:staged` — chỉ file sắp commit
- `npm run security:install-hooks` — gắn **pre-commit** + **pre-push** (push bị chặn nếu có key)
- CI: `.github/workflows/security-scan.yml`

Phát hiện: `AIza...`, `sk-...`, `gsk_...`, `sk-or-v1-...`, key trong JSON/`apiKeys=` URL, file `.env`, `.omnisuite/`.

**Nếu đã lộ key:** revoke trên console provider → tạo key mới → chỉ lưu trong `.env` và Settings (localStorage).

## Lớp 2 — Chặn truy cập ngoài (localhost + đăng nhập)

- `OMNISUITE_LOCALHOST_ONLY=1` (mặc định): middleware từ chối IP/LAN ngoài localhost
- `/dashboard` và hầu hết `/api/*` yêu cầu session NextAuth **hoặc** `INTERNAL_TOKEN` hợp lệ
- Không còn token mặc định `omnisuite_secret_token_123` khi `OMNISUITE_STRICT_SECURITY=1`

## Lớp 3 — Install guard (clone / nhúng chồng chéo)

- File `.omnisuite/machine.lock` (gitignore) gắn máy + thư mục gốc
- `OMNISUITE_ANTI_CLONE=1`: clone từ Git remote mà chưa có lock → **không chạy**
- Nhúng OmniSuite vào monorepo khác → lỗi trừ khi `OMNISUITE_INTEGRATION_ALLOW=1`

Kích hoạt lần đầu trên máy dev có `.git`:

1. Đặt tạm `OMNISUITE_ANTI_CLONE=0` trong `.env`
2. Chạy `node launcher.js` một lần (tạo lock)
3. Đặt lại `OMNISUITE_ANTI_CLONE=1` nếu muốn khóa bản sao chép

## Lệnh nhanh

```bash
npm run setup:all          # cai Node + pip + Playwright (giong launcher)
npm run uninstall:all      # choi quet go cai dat
npm run security:install-hooks
npm run security:scan
npm run security:guard
```

Windows: `01_BAT_DAU_OMNISUITE.bat` (tu cai), `03_GO_CAI_DAT_OMNISUITE.bat` (quet sach — khong giu gi, xoa ca thu muc du an).
