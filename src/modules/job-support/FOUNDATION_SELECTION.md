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
