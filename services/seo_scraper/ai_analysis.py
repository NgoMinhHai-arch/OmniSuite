import json
from google import genai

def analyze_site_intent_with_ai(candidates, gemini_api_key):
    """Sử dụng AI để phân tích sâu các website thuộc 'vùng xám'."""
    if not gemini_api_key or not candidates: return []
    try:
        print(f"[*] AI Layer: Analyzing {len(candidates)} uncertain sites...")
        batch = [{"url": c['url'], "title": c['title']} for c in candidates]
        
        prompt = f"""
        Bạn là chuyên gia phân tích SEO. Hãy phân tích danh sách website sau và trả về JSON mảng đối tượng:
        {json.dumps(batch, ensure_ascii=False)}

        Mỗi đối tượng JSON gồm: 
        - 'url': URL gốc
        - 'intent': Một trong [Thương mại, Thông tin, So sánh, Chuyển đổi]
        - 'coverage': Một trong [Cao, Trung bình]
        - 'weakness': Một mô tả ngắn điểm yếu tiêu biểu nhất (ví dụ: 'Thiếu bảng giá', 'Nội dung ngắn', 'Mobile kém')
        
        Sơ khảo về Intent:
        - Thương mại: Trang chủ, trang dịch vụ, Landing page giới thiệu giải pháp.
        - Thông tin: Bài viết kiến thức, hướng dẫn, tin tức chuyên ngành.
        - So sánh: Bài viết review, so sánh đối thủ, Top list giải pháp.
        - Chuyển đổi: Trang báo giá, trang đăng ký, trang giỏ hàng.

        Trả về DUY NHẤT mảng JSON.
        """
        client = genai.Client(api_key=gemini_api_key)
        response = client.models.generate_content(model='gemini-2.0-flash', contents=prompt)
        txt = response.text.strip('` \n')
        if txt.startswith('json'): txt = txt[4:]
        
        # Robust JSON finding
        start = txt.find("[")
        end = txt.rfind("]")
        if start != -1 and end != -1:
            return json.loads(txt[start:end+1])
    except Exception as e:
        print(f"[!] AI Layer error: {e}")
    return []
