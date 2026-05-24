import re

import httpx
from python_engine.core.config import get_settings

settings = get_settings()


class SchemaOptimizer:
    def __init__(self):
        self.api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

    async def improve_schema(
        self,
        raw_schema: str,
        target_keyword: str,
        target_domain: str,
        validation_errors: str | None = None,
        api_key: str | None = None,
    ) -> str:
        """Sử dụng Gemini để tối ưu hóa Schema JSON-LD theo đúng yêu cầu cực đoan."""
        key = api_key or settings.GEMINI_API_KEY
        if not key:
            raise ValueError("Thiếu Gemini API Key để thực hiện tối ưu hóa Schema.")

        system_instruction = (
            "Mày là chuyên gia SEO Schema Markup. "
            "Nhiệm vụ của mày là tái cấu trúc file JSON Schema bị lỗi thành một bản hoàn hảo. "
            "MÀY CHỈ ĐƯỢC PHÉP TRẢ VỀ DỮ LIỆU ĐỊNH DẠNG JSON HỢP LỆ, "
            "KHÔNG GIẢI THÍCH, KHÔNG MARKDOWN."
        )

        user_prompt = (
            f"- Schema gốc: {raw_schema}\n"
            f"- Lỗi hiện tại cần fix: {validation_errors or 'None'}\n"
            f"- Thay thế các thông tin thương hiệu/URL cũ thành: {target_domain}\n"
            f"- Tối ưu nội dung (tiêu đề, mô tả) tập trung vào từ khóa: {target_keyword}\n"
            "- Nếu thiếu các trường bắt buộc (như author, datePublished), "
            "hãy tự bịa dữ liệu giả (placeholder) hợp lý nhưng phải chuẩn format."
        )

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                url = f"{self.api_url}?key={key}"
                payload = {
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                {"text": f"System: {system_instruction}\n\nUser:\n{user_prompt}"}
                            ],
                        }
                    ]
                }
                resp = await client.post(url, json=payload)
                if resp.status_code != 200:
                    raise Exception(f"AI Error: {resp.text}")

                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]

                # Trích xuất JSON (đề phòng trường hợp LLM vẫn trả về markdown dù đã cấm)
                match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
                if match:
                    return match.group(1).strip()
                return text.strip()
        except Exception as e:
            print(f"Schema Optimizer Error: {str(e)}")
            raise e


schema_optimizer = SchemaOptimizer()
