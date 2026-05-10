# Job Support Foundation Selection

Selected architecture:

- **Find Jobs (VN):** `vn-job-feed` — SerpApi (`google_jobs` + `site:` truy vấn Google cho domain board VN); không cần clone Python/mr-jobs.
- **Auto Apply:** `manual-apply` — checklist link + xác nhận batch (dry-run / live); không Playwright/ATS automation.
- **Tailor CV:** `ai-resume-tailor` — integration benchmark (Node) như trước.

## Capability Mapping

### Find Jobs workspace

- Provider: `vn-job-feed`
- Core outputs:
  - `meta.jobs` (title, link, source, engine, …)
  - `stdout` JSON (count, preview jobs, queriesUsed)
  - Yêu cầu: SerpApi key (cài đặt localStorage `serpapi_key` hoặc `SERPAPI_KEY` env)

### Tailor CV workspace

- Provider: `ai-resume-tailor`
- Core outputs: tailored summary và bullets (khi nối đủ API integration)

### Auto Apply workspace

- Provider: `manual-apply`
- Core outputs: checklist JSON, `meta.applyUrls`, `meta.domainCounts`; live mode vẫn yêu cầu user mở browser thủ công

## What OmniSuite owns

- Domain contracts và response shape
- Error codes và hint tiếng Việt
- Chính sách an toàn: dry-run default cho checklist; live batch cần approval + rate limit/ngày (áp dụng khi “live” confirmed)
- Unified UI cho các workspace

## Architecture Decision (Immediate)

- **Decision:** giữ orchestration/API composition ở TypeScript layer (`src/modules/job-support`), nhưng chuyển dần heavy AI processing (CV parsing, CV↔JD scoring, rewrite/tailoring, embedding/ranking) sang Python engine (`:8082`).
- **Why:** tránh duplicate business logic ở cả TS và Python; tận dụng ecosystem ML/LLM của Python cho phần xử lý nặng.
- **Execution order:**
  1. Đã hoàn tất: Tailor CV adapter gọi contract Python thật `POST /api/job/tailor` trên `:8082` (không còn stub `console.log`).
  2. Tiếp theo: tạo endpoint Python engine cho scoring/tailoring chuẩn hóa để TS chỉ đóng vai trò orchestrator.
  3. Sau khi chạy ổn định: đo chất lượng match CV↔JD (keyword overlap, score distribution, manual acceptance rate) trước khi tối ưu tiếp.

### Current contract (Python engine)

- Endpoint: `POST /api/job/tailor`
- Input: `resume_text`, `jd_text` (kèm optional `provider`, `model_name`, `api_key`, `custom_base_url`)
- Output: `tailored_resume`, `match_score`, `suggestions`
