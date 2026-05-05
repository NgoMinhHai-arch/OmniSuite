import json
import sys
import re
import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from playwright_stealth import stealth

# --- CONFIG & CTR BENCHMARK (V12 - FINAL 2024 UPDATE) ---
CTR_BENCHMARK = {
    1: 39.8, 2: 18.7, 3: 10.2, 4: 7.4, 5: 5.1,
    6: 4.4, 7: 3.0, 8: 2.1, 9: 1.6, 10: 1.3,
    "top10": 81.0, "p11-20": 1.5, "p21-100": 0.1
}

INTENT_RULES = {
    "Transactional": ["mua", "giá", "bán", "shopee", "tiki", "lazada", "buy", "price", "sale", "order", "shop"],
    "Informational": ["là gì", "tại sao", "cách", "hướng dẫn", "kinh nghiệm", "how to", "guide", "bài viết"],
    "Commercial": ["tốt nhất", "so sánh", "đánh giá", "review", "top", "best", "vs", "compare"],
    "Navigational": ["đăng nhập", "login", "trang chủ", "official", "facebook", "youtube", "website"]
}

class SEOAnalyzerV12:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

    def get_allintitle_count(self, keyword):
        """Săn tìm số lượng kết quả đa nguồn (Google + Bing + Fallback)."""
        query = f'allintitle:"{keyword}"'
        
        # 1. LAYER 1 & 2 (Google & Bing with Playwright)
        sources = [
            f"https://www.google.com/search?q={query}&hl=vi&gl=vn",
            f"https://www.bing.com/search?q={query}"
        ]
        
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page(user_agent=self.headers["User-Agent"])
                stealth(page)

                for url in sources:
                    try:
                        page.goto(url, wait_until="load", timeout=12000)
                        # Scan all visible text for result patterns
                        body_text = page.evaluate("() => document.body.innerText")
                        
                        patterns = [
                            r'([\d\.,\s]{3,})\s*(kết quả|results)',
                            r'Khoảng\s*([\d\.,\s]{3,})',
                            r'About\s*([\d\.,\s]{2,})'
                        ]
                        
                        for pattern in patterns:
                            match = re.search(pattern, body_text, re.IGNORECASE)
                            if match:
                                digits = "".join(re.findall(r'\d+', match.group(1)))
                                if digits and int(digits) > 1: # Found data
                                    browser.close()
                                    return int(digits)
                    except: continue
                browser.close()
        except: pass
        return 0

    def calculate_semantic_difficulty(self, keyword, popularity, intent):
        """Thuật toán dự phòng: KD = 100 - (len(kw) * random(1.8, 2.3))"""
        import random
        kd = max(5, min(95, 100 - (len(keyword) * random.uniform(1.8, 2.3))))
        return round(kd)

    def get_popularity_score(self, keyword):
        url = "http://suggestqueries.google.com/complete/search"
        params = {"output": "chrome", "hl": "vi", "q": keyword, "gl": "vn"}
        try:
            resp = requests.get(url, params=params, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                suggestions = data[1] if len(data) > 1 else []
                kw_lower = keyword.lower().strip()
                for idx, s in enumerate(suggestions[:10]):
                    s_lower = s.lower().strip()
                    if kw_lower == s_lower: return 100 - (idx * 5)
                    elif kw_lower in s_lower: return 90 - (idx * 8)
                if suggestions: return 40 # Increased baseline V12
            return 0
        except: return 0

    def classify_intent(self, keyword):
        kw_lower = keyword.lower()
        for intent, modifiers in INTENT_RULES.items():
            for mod in modifiers:
                if mod in kw_lower: return intent
        return "Informational"

    def audit_page_for_keyword(self, url, keyword):
        try:
            resp = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(resp.content, "lxml")
            title = soup.title.string.strip() if soup.title else ""
            desc = soup.find("meta", attrs={"name": "description"}).get("content", "") if soup.find("meta", attrs={"name": "description"}) else ""
            h1s = [h.get_text(strip=True) for h in soup.find_all("h1")]
            kw_c = keyword.lower().strip()
            return {
                "Title": "Match" if kw_c in title.lower() else "Miss",
                "Meta": "Match" if kw_c in desc.lower() else "Miss",
                "H1": "Match" if any(kw_c in h.lower() for h in h1s) else "Miss",
                "Word Count": len(re.findall(r'\w+', soup.get_text())),
                "Status": "Optimized" if kw_c in title.lower() and h1s else "Need Optimization"
            }
        except: return {"error": "Target unreachable"}

    def get_traffic_metrics(self, popularity, rank):
        base_volume = popularity * 600 # V12 Scaling
        ctr = CTR_BENCHMARK.get(rank, CTR_BENCHMARK["p21-100"] if rank > 20 else CTR_BENCHMARK["p11-20"])
        return round((base_volume * ctr) / 100)

def main():
    if len(sys.argv) < 2: return
    mode = sys.argv[1]
    analyzer = SEOAnalyzerV12()

    if mode == "bulk_data":
        keywords = sys.argv[2].split(",")
        results = []
        for kw in keywords[:30]:
            pop = analyzer.get_popularity_score(kw)
            intent = analyzer.classify_intent(kw)
            allintitle = analyzer.get_allintitle_count(kw)
            
            # Logic V12: If allintitle fails, use Semantic Estimation
            if allintitle > 0:
                kd = min(round((allintitle / 2000) * 100), 100)
            else:
                kd = analyzer.calculate_semantic_difficulty(kw, pop, intent)
                allintitle = "N/A" # Clear indication that we used logic estimation
            
            results.append({
                "keyword": kw,
                "popularity_score": pop,
                "allintitle": allintitle,
                "kd_percent": kd,
                "intent": intent,
                "competition_level": "Low Difficulty" if kd < 30 else "High Competition" if kd > 75 else "Medium"
            })
        print(json.dumps(results, ensure_ascii=False))

    elif mode == "audit_page":
        print(json.dumps(analyzer.audit_page_for_keyword(sys.argv[2], sys.argv[3]), ensure_ascii=False))

    elif mode == "competitor_lab":
        try:
            resp = requests.get(sys.argv[3], headers=analyzer.headers, timeout=15)
            soup = BeautifulSoup(resp.content, "lxml")
            comp_h2s = list(set([h.get_text(strip=True) for h in soup.find_all(["h1", "h2"]) if len(h.get_text().split()) < 6]))
            results = [{"keyword": kw, "popularity_score": analyzer.get_popularity_score(kw), "kd_percent": 0, "intent": analyzer.classify_intent(kw), "competition_level": "Scanning"} for kw in comp_h2s[:10]]
            print(json.dumps({"results": results}, ensure_ascii=False))
        except: print(json.dumps({"results": []}))

if __name__ == "__main__":
    main()
