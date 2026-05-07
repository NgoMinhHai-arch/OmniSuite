# Job Support Regression Checklist

Use this checklist after any UI/API/bridge change in `job-support`.

## 1) UI/UX Smoke

- Open `/dashboard/job-support`, confirm no runtime errors.
- Confirm workspace links work for:
  - `Find Jobs (VN)`
  - `Tailor CV`
  - `Apply thủ công`
- **Find Jobs:** bảng tin từ `meta.jobs`; thiếu SerpApi hiển thị `PROVIDER_NOT_READY` + hint.
- **Manual apply:** không URL hợp lệ → validation / `INVALID_INPUT`.
- **Manual apply:** có URL → JSON checklist + có thể copy danh sách.

## 2) API Contract Smoke

### Providers endpoint

- `GET /api/job-support/providers` returns:
  - `ok: true`
  - `providers` gồm `vn-job-feed`, `manual-apply`, `ai-resume-tailor` (readiness theo env / folder)

### Output endpoint

- `GET /api/job-support/output` returns either:
  - `404` with `{ ok: false, error: "No output found" }`, or
  - `200` with `{ ok: true, output: JobSupportRunOutput }`

### Run endpoint

- Invalid/insufficient workspace input → `400` with:
  - `errorCode: "INVALID_INPUT"`
  - `hint` explaining minimal required fields.
- **Find Jobs** missing SerpApi (env + body) → `500`/`PROVIDER_NOT_READY` từ preflight.
- `auto-apply` with `mode=live` and no approval -> `400` with:
  - `errorCode: "MISSING_APPROVAL"`

## 3) Workspace Execution Smoke

- Run each workspace at least once:
  - `find-jobs` using `vn-job-feed` (+ SerpApi key)
  - `tailor-cv` using `ai-resume-tailor`
  - `auto-apply` using `manual-apply` in `dry-run`
- Confirm output payload includes:
  - `id`, `provider`, `workspace`, `mode`, `ok`, `exitCode`, `durationMs`
  - `stdout`, `stderr`
  - optional `meta.jobs` (find-jobs), `meta.applyUrls` (manual apply)
  - optional `errorCode`, `hint` on failure

## 4) Safety Guardrails

- Manual apply có dry-run và live checklist.
- `live` batch requires explicit `approved=true`.
- Daily cap (`MAX_APPLY_PER_DAY`) enforced for live batch confirmation.

## 5) User Guidance Quality

- Error messaging is human-readable (not raw stack only).
- Every error state on UI has next-step guidance (hint or setup direction).
