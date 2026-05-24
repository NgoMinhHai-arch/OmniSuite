import re
from urllib.parse import urlparse
from dataclasses import dataclass

# === TẦNG 0: HARD REJECT (Lọc cực nhanh các trang rác/ông lớn) ===
INTERNATIONAL_INFO_GIANTS = [
    'zhihu.com', 'quora.com', 'reddit.com', 'medium.com', 'stackoverflow.com',
    'linkedin.com', 'youtube.com', 'slideshare.net', 'scribd.com', 'issuu.com',
    'baidu.com', 'weibo.com', 'douban.com', 'sina.com', 'clutch.co', 'g2.com',
    'capterra.com', 'trustpilot.com', 'pinterest.com', 'facebook.com',
    'wikipedia.org', 'wiktionary.org', 'baomoi.com', 'kenh14.vn', 'zingnews.vn', 
    'vov.vn', 'tinhte.vn', 'shopee.vn', 'lazada.vn', 'tiki.vn', 'sendo.vn', 
    'alibaba.com', 'aliexpress.com', 'vatgia.com', 'muaban.net', 'careerbuilder.vn',
    'vnexpress.net', 'dantri.com.vn', 'vietnamnet.vn', 'thanhnien.vn', 'tuoitre.vn',
    'laodong.vn', 'doisongphapluat.com', 'nguoiduatin.vn', '24h.com.vn', 'eva.vn'
]

JUNK_PATTERNS = [
    'dict.', 'tratu.', 'translate.', 'tudien', 'dictionary', 'wiki',
    'xoso', 'kqxs', 'lottery', 'support.', 'help.', 'docs.', 'manual.',
    'community.', 'faq.', 'forum', 'question', 'answers', 'threads',
    'topic', 'diendan', 'vieclam', 'tuyendung', 'search?', 'query=',
    'tag/', 'tags/', 'archives/', 'author/', 'page/', 'attachment'
]

@dataclass
class ClassificationResult:
    intent: str          # "Thương mại" | "Thông tin" | "So sánh" | "Chuyển đổi" | "REJECT"
    confidence: float    # 0.0 đến 1.0
    signals: list[str]   # Lý do phân loại
    needs_ai: bool       # True = cần gọi Gemini để phân tích thêm

class HybridIntentClassifier:
    """
    OMNITOOL-NOTE: Phân loại intent theo 3 tầng để giảm 70% chi phí AI.
    Dừng lại ngay khi đủ tự tin (confidence > 0.85).
    """
    
    # === TẦNG 1: URL Path Patterns ===
    COMMERCIAL_URL_PATTERNS = re.compile(
        r'/(dich-vu|dichvu|service|bao-gia|baogia|pricing|lien-he|lienhe|'
        r'contact|goi-dich-vu|giai-phap|solution|san-pham|product|'
        r'thiet-ke|thietke|marketing|seo-|web-design|mua-ngay|dat-hang|'
        r'order|checkout|gio-hang|cart)(/|$|-)',
        re.IGNORECASE
    )
    
    INFORMATIONAL_URL_PATTERNS = re.compile(
        r'/(blog|tin-tuc|tintuc|news|bai-viet|baiviet|kien-thuc|kienthuc|'
        r'huong-dan|huongdan|tips|chia-se|chiase|chuyen-muc|chuyenmuc|'
        r'category|tag|p=\d+|post/|posts/|article|articles|'
        r'\d{4}/\d{2}/\d{2}|\d{4}/\d{2}/)',
        re.IGNORECASE
    )

    # === TẦNG 2: Title Semantic Signals ===
    COMMERCIAL_SIGNALS = [
        ('báo giá', 0.35), ('liên hệ', 0.25), ('bảng giá', 0.35),
        ('tư vấn miễn phí', 0.40), ('hotline', 0.30), ('đặt lịch', 0.35),
        ('gói dịch vụ', 0.40), ('uy tín', 0.15), ('trọn gói', 0.30)
    ]
    
    INFORMATIONAL_SIGNALS = [
        ('là gì', 0.45), ('hướng dẫn', 0.35), ('cách ', 0.30),
        ('bí quyết', 0.25), ('review', 0.30), ('so sánh', 0.25),
        ('kinh nghiệm', 0.20), ('chia sẻ', 0.20)
    ]

    @staticmethod
    def analyze_url_structure(url: str) -> tuple[float, list[str]]:
        parsed = urlparse(url.lower())
        path = parsed.path.strip('/')
        signals = []
        score = 0.0
        
        if not path:
            signals.append("Homepage logic")
            return 0.20, signals
            
        depth = len([p for p in path.split('/') if p])
        if depth >= 3:
            score -= 0.20
            signals.append(f"Depth {depth} (Blog signal)")
        elif depth == 1:
            score += 0.15
            signals.append("Shallow path (Service signal)")
            
        if re.search(r'-\d{4,}$', path) or re.search(r'/\d{4,}/', path):
            score -= 0.25
            signals.append("Numeric pattern (CMS post)")
            
        return score, signals

    def classify(self, url: str, title: str) -> ClassificationResult:
        url_lower = url.lower()
        title_lower = (title or '').lower()
        parsed = urlparse(url_lower)
        domain = parsed.netloc
        
        # === TẦNG 0: HARD REJECT ===
        if any(giant in domain for giant in INTERNATIONAL_INFO_GIANTS):
            return ClassificationResult("REJECT", 1.0, ["Hard Reject: Info Giant"], False)
        if any(pattern in url_lower for pattern in JUNK_PATTERNS):
            return ClassificationResult("REJECT", 1.0, ["Hard Reject: Junk Pattern"], False)

        signals = []
        score = 0.0
        
        # Level 1: Hard Match
        if self.COMMERCIAL_URL_PATTERNS.search(url_lower):
            return ClassificationResult("Thương mại", 0.95, ["URL pattern"], False)
        if self.INFORMATIONAL_URL_PATTERNS.search(url_lower):
            if any(s in title_lower for s in ['so sánh', 'review', 'đánh giá']):
                return ClassificationResult("So sánh", 0.90, ["URL blog + Title Comparison"], False)
            return ClassificationResult("Thông tin", 0.92, ["URL blog pattern"], False)
            
        # Level 2: Title Scoring
        for word, weight in self.COMMERCIAL_SIGNALS:
            if word in title_lower:
                score += weight
                signals.append(f"Title: {word}")
        for word, weight in self.INFORMATIONAL_SIGNALS:
            if word in title_lower:
                score -= weight
                signals.append(f"Title: {word}")
                
        # Level 3: Structure
        s_score, s_sigs = self.analyze_url_structure(url)
        score += s_score
        signals.extend(s_sigs)
        
        # Final Verdict
        if score >= 0.40:
            return ClassificationResult("Thương mại", 0.88, signals, False)
        elif score <= -0.30:
            return ClassificationResult("Thông tin", 0.85, signals, False)
        else:
            return ClassificationResult("Thông tin", 0.5, signals, True) # Needs AI for granular check

# Global instance for easy use
classifier = HybridIntentClassifier()

def classify_site_intent(url, title):
    return classifier.classify(url, title)

def get_page_type(url):
    # Backward compatibility helper
    res = classifier.classify(url, "")
    if res.intent == "Thương mại":
        return "Landing Page"
    if res.intent == "Thông tin" or res.intent == "So sánh":
        return "Blog/Article"
    return "Website"
def classify_site_type(url, title):
    """Bridge for legacy code. Maps intents to BUSINESS/INFORMATIONAL/REJECT labels."""
    res = classifier.classify(url, title)
    verdict = "REJECT"
    
    if res.intent == "Thương mại" or res.intent == "Bán hàng":
        verdict = "BUSINESS"
    elif res.intent in ["Thông tin", "So sánh", "Chuyển đổi"]:
        verdict = "INFORMATIONAL"
    elif res.intent == "REJECT":
        verdict = "REJECT"
        
    return verdict, int(res.confidence * 100)
