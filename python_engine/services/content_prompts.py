from __future__ import annotations

from python_engine.schemas.content_schemas import PlatformPreset


FRAMEWORK_PROMPTS: dict[str, str] = {
    "Tự do": "Không ràng buộc cứng, nhưng vẫn cần rõ ràng và tránh lặp ý.",
    "AIDA": "Triển khai theo Chú ý -> Thích thú -> Mong muốn -> Hành động.",
    "PAS": "Triển khai theo Vấn đề -> Khuếch đại -> Giải pháp.",
    "Blog Post": "Bố cục mở-thân-kết rõ ràng với các H2/H3 logic.",
    "Kim tự tháp ngược": "Thông tin quan trọng nhất đặt ở phần đầu.",
    "Pillar Post": "Bao phủ chủ đề chuyên sâu, có cụm nội dung liên quan.",
    "How-to (Từng bước)": "Trình bày theo từng bước thực thi, có checklist hành động.",
    "Listicle (Top N)": "Trình bày theo danh sách có thứ tự và tiêu chí rõ.",
    "Review sản phẩm": "Nêu ưu/nhược, tình huống dùng thực tế, kết luận minh bạch.",
    "So sánh (X vs Y)": "So sánh theo tiêu chí cụ thể và gợi ý chọn theo nhu cầu.",
    "FAQ": "Đặt câu hỏi thực tế và trả lời ngắn, đi thẳng trọng tâm.",
    "Skyscraper": "Nội dung đầy đủ, cập nhật hơn và hữu ích hơn nội dung top hiện có.",
    "Storytelling": "Mở bài bằng ngữ cảnh thực tế, dẫn dắt tự nhiên tới giải pháp.",
}

PLATFORM_STYLE_PROMPTS: dict[PlatformPreset, str] = {
    "googleSeoLongForm": (
        "Tối ưu cho Google SEO: độ sâu cao, heading rõ, semantic coverage tốt, "
        "đưa ví dụ thực tế và các đoạn giải thích có tính giáo dục."
    ),
    "facebookEngagement": (
        "Tối ưu cho Facebook: mở đầu hook mạnh, câu ngắn hơn, tăng tính đối thoại, "
        "đưa CTA tương tác (bình luận/chia sẻ) tự nhiên, tránh quá hàn lâm."
    ),
    "socialShort": (
        "Tối ưu cho social short-form: súc tích, nhiều ý chính dễ quét nhanh, "
        "ưu tiên bullet points, đoạn ngắn, thông điệp rõ trong 3 giây đầu."
    ),
    "adCopy": (
        "Tối ưu cho quảng cáo: tập trung lợi ích, khác biệt, xử lý phản đối, "
        "CTA rõ ràng, câu chữ mạnh nhưng không phóng đại sai sự thật."
    ),
}

SYSTEM_CORE = (
    "Bạn là chuyên gia nội dung SEO tiếng Việt. "
    "Bắt buộc viết tiếng Việt tự nhiên, không pha tạp vô nghĩa, không bịa dữ kiện."
)


def get_framework_prompt(framework: str) -> str:
    return FRAMEWORK_PROMPTS.get(framework, FRAMEWORK_PROMPTS["Tự do"])


def get_platform_style_prompt(platform: PlatformPreset) -> str:
    return PLATFORM_STYLE_PROMPTS.get(platform, PLATFORM_STYLE_PROMPTS["googleSeoLongForm"])

