# Find Jobs VN (SerpApi)

`Find Jobs` gom tin qua **SerpApi** — không cần Python hay thư mục `mr-jobs`.

## Yêu cầu

1. **SerpApi key** trong:
   - OmniSuite **Cài đặt** (được lưu `localStorage` `omnisuite_settings.serpapi_key` — client gửi kèm POST), **hoặc**
   - Biến môi trường `SERPAPI_KEY` trên máy chạy Next.js.

2. **Chi phí query:** mỗi lần chạy tối đa **8** request SerpApi (1× `google_jobs` + tối đa 7× `google` với `site:` theo domain trong form).

## Kiểm tra nhanh

- Mở `/dashboard/job-support/find-jobs`
- Nhập từ khóa (vd: `Marketing`) hoặc địa điểm; giữ textarea domain mặc định hoặc chỉnh theo ý
- Bấm **Chạy gom tin VN**
- Nếu `PROVIDER_NOT_READY`: nhập SerpApi key trong Settings hoặc cấu hình `SERPAPI_KEY` trên server và build/restart

## Lưu ý

- Kết quả là **link/thông tin từ chỉ mục tìm kiếm**, không phải API chính thức của VietnamWorks/TopCV/ITviec v.v.
- Một số dòng có thể là trang danh mục / trung gian thay vì tin đơn lẻ — cần lọc tay.
