# Find Jobs VN E2E Baseline

Date: 2026-05-06 (baseline refresh: SerpApi `vn-job-feed`)

## Case A: Invalid input

- Request: `workspace=find-jobs` with empty `jobTitle`, `location`, and empty `companyPortals` textarea (user cleared defaults)
- Expected: `400 INVALID_INPUT`
- Note: With default textarea domains filled in UI, empty title+location may still be valid if user did not clear domains.

## Case B: Missing SerpApi

- Request: valid Find Jobs payload, no `serpapi_key` in body và không có `SERPAPI_KEY` env
- Expected: `PROVIDER_NOT_READY` với hint nhập SerpApi

## Case C: Success path

- Required:
  - SerpApi key (body từ Settings localStorage hoặc env)
  - Hợp lệ quota SerpApi
- Expected: `ok: true`, `meta.jobs` populated hoặc stderr ghi lỗi từng query nhưng response vẫn `ok` nếu không throw
