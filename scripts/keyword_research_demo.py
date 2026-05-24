import asyncio
import httpx
import json
import sys
import os
import re
from datetime import datetime, timedelta

# --- CONFIG & FALLBACKS ---
CACHE_FILE = "keyword_cache_demo.json"

class SimpleCache:
    def __init__(self):
        self.local_cache = {}
        self._load_local()

    def _load_local(self):
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    self.local_cache = json.load(f)
            except:
                self.local_cache = {}

    def _save_local(self):
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.local_cache, f, ensure_ascii=False, indent=2)
        except:
            pass

    def get(self, key):
        entry = self.local_cache.get(key)
        if entry:
            expiry = datetime.fromisoformat(entry['expiry'])
            if datetime.now() < expiry:
                return entry['data']
        return None

    def set(self, key, data, ttl_days=7):
        expiry = (datetime.now() + timedelta(days=ttl_days)).isoformat()
        self.local_cache[key] = {'data': data, 'expiry': expiry}
        self._save_local()

class KeywordEngine:
    def __init__(self, settings):
        self.settings = settings
        self.cache = SimpleCache()

    def normalize(self, text):
        text = text.lower().strip()
        text = re.sub(r'[^\w\s\d,.-]', '', text)
        return text

    async def scrape_autocomplete(self, seed):
        """Enhanced Recursive Scraping - Google suggestions."""
        base_url = "http://suggestqueries.google.com/complete/search"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        
        found_keywords = {} # keyword: min_position
        
        prefixes = ["", "how ", "why ", "what ", "cách ", "làm sao ", "mua ", "giá ", "review "]
        alphabet = list("abcdefghijklmnopqrstuvwxyz")
        
        queries = []
        for p in prefixes:
            queries.append(f"{p}{seed}".strip())
        for char in alphabet:
            queries.append(f"{seed} {char}".strip())
            
        async with httpx.AsyncClient(headers=headers, timeout=10) as client:
            tasks = [client.get(base_url, params={"output": "chrome", "hl": "vi", "q": q}) for q in queries]
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            for resp in responses:
                if isinstance(resp, httpx.Response) and resp.status_code == 200:
                    try:
                        data = resp.json()
                        suggestions = data[1] if len(data) > 1 else []
                        for index, s in enumerate(suggestions):
                            kw = s.lower().strip()
                            if kw not in found_keywords or index < found_keywords[kw]:
                                found_keywords[kw] = index
                    except: continue
        
        results = []
        for kw, pos in found_keywords.items():
            difficulty = self.calculate_difficulty(kw, pos)
            intent = self.detect_intent(kw)
            priority = self.calculate_priority(difficulty)
            results.append({
                "keyword": kw,
                "intent": intent,
                "difficulty": str(difficulty),
                "volume": "Tiềm năng",
                "trend": "Stable",
                "priority": priority
            })
            
        results.sort(key=lambda x: int(x['difficulty']))
        return results

    def calculate_difficulty(self, keyword, index):
        word_count = len(keyword.split())
        char_count = len(keyword)
        pos_score = (10 - index) * 5 
        len_penalty = max(0, 50 - (word_count * 8) - (char_count * 0.5))
        score = pos_score + len_penalty + (hash(keyword) % 10) 
        return min(100, max(1, int(score)))

    def detect_intent(self, keyword):
        kw = keyword.lower()
        patterns = {
            "Transactional": ["mua", "bán", "giá", "bao nhiêu", "cửa hàng", "shop", "đặt", "order", "buy", "price", "sale", "giảm giá", "địa chỉ"],
            "Commercial": ["tốt nhất", "top", "so sánh", "review", "đánh giá", "ưu điểm", "nhược điểm", "vs", "recommends", "best", "hiệu quả"],
            "Informational": ["cách", "làm sao", "là gì", "tại sao", "hướng dẫn", "kinh nghiệm", "bí quyết", "how", "why", "what", "guide", "tutorial"],
            "Navigational": ["facebook", "youtube", "shopee", "lazada", "tiki", "login"]
        }
        for intent, words in patterns.items():
            for word in words:
                if f" {word} " in f" {kw} " or kw.startswith(f"{word} ") or kw.endswith(f" {word}"):
                    return intent
        return "Informational"

    def calculate_priority(self, difficulty):
        if difficulty < 35: return "High"
        if difficulty < 70: return "Medium"
        return "Low"

async def main():
    if len(sys.argv) < 2: return
    seed = sys.argv[1]
    engine = KeywordEngine({})
    
    cached = engine.cache.get(f"demo_{seed}")
    if cached:
        print(json.dumps(cached, ensure_ascii=False))
        return

    results = await engine.scrape_autocomplete(seed)
    engine.cache.set(f"demo_{seed}", results)
    print(json.dumps(results, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(main())
