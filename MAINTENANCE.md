# Hướng dẫn bảo trì OmniSuite

Tài liệu ngắn để giảm chi phí bảo trì — đọc trước khi thêm tính năng.

## Kiến trúc tóm tắt

| Lớp | Vị trí | Ghi chú |
|-----|--------|---------|
| UI Next.js | `src/app/dashboard/` | App Router |
| SEO tools | `src/app/dashboard/seo-tools/[slug]/` | Metadata: `src/lib/seo/tool-registry.ts` |
| Hub SEO | `src/app/dashboard/seo-tools/page.tsx` | Danh sách sinh từ `hub-catalog.ts` ← registry |
| API Next | `src/app/api/` | Proxy sang Python hoặc logic TS |
| Python engine | `python_engine/` | FastAPI **:8082** — nguồn chính cho SEO/keywords/content |
| Legacy interpreter | `scripts/interpreter_service.py` | **:8081** — search keywords, task heartbeat (tùy chọn) |
| CLIP / ảnh | `services/clip_service/` | **:8000** — chỉ khi dùng pipeline ảnh |

**Quy tắc:** API mới gọi Python qua `getPythonEngineUrl()` (`PYTHON_ENGINE_URL`, cổng 8082). Interpreter legacy qua `getInterpreterUrl()` (`INTERPRETER_URL`, cổng 8081). Client không gọi thẳng Flask — dùng `/api/interpreter/*`.

**Dev:**

| Lệnh | Process |
|------|---------|
| `npm run dev` | Next + python_engine (8082) |
| `npm run dev:legacy` | Thêm interpreter (8081) + CLIP (8000) — cần cho tìm URL keyword & task heartbeat |

## Thêm / sửa công cụ SEO

1. Chỉnh **`src/lib/seo/tool-registry.ts`** (slug, title, category, `requires`, `aliasOf`).
2. Tool LLM thuần: thêm preset vào **`src/lib/seo/llm-tool-presets.ts`** — route `[slug]/page.tsx` tự render (không tạo folder riêng).
3. Tool custom: tạo `src/app/dashboard/seo-tools/<slug>/page.tsx` — `ToolShell`, `GscQueryShell`, hoặc UI riêng.
4. Alias: xóa page tĩnh; `findTool(slug)` + `[slug]/page.tsx` xử lý alias tự động (hoặc re-export tới canonical nếu custom).
5. Hub tự cập nhật — **không** sửa danh sách thủ công trên `seo-tools/page.tsx`.

## Module lớn (tránh phình thêm)

| File | Hướng xử lý khi sửa |
|------|---------------------|
| `content/page.tsx` | Logic model/job → `src/modules/content/hooks/` |
| `keywords/page.tsx` | Logic model/retry → `src/modules/keywords/hooks/` |
| `api/scrape/route.ts` | Tách handler theo chế độ scrape |

## Chạy & kiểm tra

```bash
npm run dev          # Next + python_engine (8082)
npm run dev:legacy   # + interpreter 8081 + CLIP 8000 (keywords search, heartbeat)
npm run typecheck    # TypeScript
npm run test         # pytest python_engine/tests
npm run lint
npm run integrations:verify   # Submodule integrations/
```

## Integrations (Quản gia)

Submodules khai báo trong `.gitmodules`. Sau clone:

```bash
npm run integrations:sync
scripts/setup-runners-venv.ps1   # Windows
```

## Checklist PR (tối thiểu)

- [ ] Tool SEO mới có entry trong `tool-registry.ts`
- [ ] Không hardcode catalog hub trùng registry
- [ ] API Python dùng `getPythonEngineUrl()` / `PYTHON_ENGINE_URL`
- [ ] `npm run typecheck` và `npm run test` pass
