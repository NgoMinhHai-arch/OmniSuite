<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 📜 QUY TẮC DỰ ÁN & MÔ TẢ CHỨC NĂNG (DÀNH CHO ANTIGRAVITY)

> **Lưu ý:** Đây là file quy tắc để Antigravity (AI) đọc mỗi khi bắt đầu làm việc. Những quy định tại đây là ưu tiên cao nhất, giúp tôi hiểu đúng phong cách của bạn và tránh các lỗi không đáng có.

## 0. Tổng quan & Cấu trúc Mô-đun (Modular Architecture)
Dự án tuân thủ kiến trúc **Feature-Sliced Design (FSD)** để đảm bảo tính mở rộng và dễ bảo trì:
- **`src/modules/`**: Chứa các tính năng tự quản (Self-contained). Mỗi module (SEO, Maps, Images, Affiliate) có đầy đủ `components` và `services` riêng.
- **`src/shared/`**: Chứa các thành phần dùng chung (`ui`, `lib`, `types`, `utils`) trên toàn dự án.
- **`python-engine/`**: Hệ thống Backend Python độc lập (FastAPI). Đây là "Bộ não" xử lý mọi logic nặng (Scraping, AI, Data processing).
- **`src/app/api/`**: Tầng giao tiếp Next.js (BFF). Chỉ đóng vai trò Proxy/Wrapper gọi sang Python Engine, không chứa logic script thủ công.

## 1. Phong cách lập trình (Coding Style)
- Tối ưu hóa code dựa trên kiến trúc Modular hiện có. 
- **Quy tắc Import**: Luôn ưu tiên dùng Alias `@/` (ví dụ: `@/shared/ui/Button`, `@/modules/seo/services/seo_service`). Tuyệt đối tránh relative imports sâu (`../../../../`).
- **Tiết kiệm API**: Luôn tối ưu số lượng token và số lần gọi API AI.

## 2. Quy tắc Thiết kế & UI (Design Rules)
- Sử dụng Design System trong `src/shared/ui/`. Không tạo component UI riêng lẻ nếu đã có bản dùng chung.
- Đảm bảo tính đồng nhất về màu sắc, phanh chữ và hiệu ứng tương tác trên toàn bộ Dashboard.

## 3. Quy tắc vận hành Python Engine (FastAPI)
- **Port**: Cố định cổng **8000**.
- **Async First**: Bắt buộc dùng `playwright.async_api` và `async/await` cho mọi router để tránh block Event Loop.
- **Mô hình Bảo mật**: Chỉ Server-to-Server. Next.js gọi Python thông qua mạng nội bộ. Không mở CORS cho trình duyệt.
- **Quản lý Key**: Toàn bộ API Keys (OpenAI, Gemini...) phải nằm trong `python-engine/.env`. Frontend không được phép giữ Key.

## 4. Các yêu cầu về Schema & Logic
- **Schema Driven**: Mọi Router Python phải có `response_model` (Pydantic). Không trả về dữ liệu dict vô danh.
- **Dumb Routers**: Router trong Python chỉ nhận Request và gọi Service. Logic thực tế phải nằm trong `services/`.
- **Pure Functions**: Các hàm trong `services/` không được import thư viện FastAPI (như Request, HTTPException).

## 6. Kiểm soát chất lượng & Tự động hóa AI (BẮT BUỘC)
Để đảm bảo "AI tự làm, AI tự sửa" và giữ dự án luôn sạch, Antigravity phải tuân thủ:
- **Nguyên tắc "Đỏ thì sửa, Xanh mới nộp"**: Mọi thay đổi logic Python phải được kiểm tra bằng **Pytest**. Báo cáo kết quả "Passed" trước khi hoàn thành task.
- **Tiêu chuẩn Code 2026**: Sử dụng **Ruff** để check linting và format code. Không để lại các lỗi "Multiple statements on one line" hoặc "unused imports", giữ hệ thống nhất quán, những thứ mà người dùng phải nhập như API, vâng vâng thì phải luôn luôn hiển thị ở cấu hình hệ thống
- **Dọn rác Context**: Thường xuyên chạy **Vulture** để phát hiện và xóa bỏ code/file thừa, tránh làm nhiễu Context đọc mã nguồn của AI.
- **Bảo vệ cấu trúc**: Sử dụng **Dependency Cruiser** để kiểm tra sơ đồ phụ thuộc, đảm bảo không vi phạm cấu trúc Modular (ví dụ: Module A không được gọi chéo sang Module B mà không qua Shared layer).

## 7. Quy định chung 
1. Không được bịa yêu cầu. Làm đúng những gì được giao.
2. Cái gì không rõ phải hỏi lại ngay lập tức.
3. Sử dụng hỗ trợ từ AI bên ngoài (Claude/GPT) để giải quyết vấn đề khó nhưng phải tối ưu lại theo phong cách dự án.
4. Luôn kiểm tra lại code bằng `npm run build` sau khi sửa để đảm bảo không có lỗi import.
5. Trước khi nộp bài, phải chạy bộ công cụ kiểm thử: `pytest`, `ruff`, `vulture`.
6. Trước khi thay đổi lớn về cấu trúc, phải tóm tắt kế hoạch và chờ phê duyệt.
7. Luôn có file demo để test trước khi áp dụng vào project chính. Đảm bảo "Không bao giờ hỏng".
