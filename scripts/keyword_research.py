import asyncio
import httpx
import json
import sys
import os
import re
from datetime import datetime, timedelta

# --- CONFIG & FALLBACKS ---
CACHE_FILE = "keyword_cache.json"
CACHE_TTL_DAYS = 7

class SimpleCache:
    """A Redis-ready cache wrapper with a local JSON fallback."""
    def __init__(self):
        self.redis = None
        self.local_cache = {}
        self._load_local()
        
        # Optional: Try to connect to Redis if available
        try:
            import importlib
            redis_lib = importlib.import_module('redis')
            self.redis = redis_lib.Redis(host='localhost', port=6379, db=0, decode_responses=True)
            self.redis.ping()
            print("[*] Cache: Redis Connected.", file=sys.stderr)
        except (ImportError, Exception):
            print("[*] Cache: Redis unavailable, using local JSON storage.", file=sys.stderr)

    def _load_local(self):
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    self.local_cache = json.load(f)
            except Exception:
                self.local_cache = {}

    def _save_local(self):
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.local_cache, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def get(self, key):
        if self.redis:
            try:
                val = self.redis.get(key)
                return json.loads(val) if val else None
            except Exception:
                pass
        
        # Local Fallback
        entry = self.local_cache.get(key)
        if entry:
            expiry = datetime.fromisoformat(entry['expiry'])
            if datetime.now() < expiry:
                return entry['data']
            else:
                del self.local_cache[key]
                self._save_local()
        return None

    def set(self, key, data, ttl_days=CACHE_TTL_DAYS):
        if self.redis:
            try:
                self.redis.setex(key, timedelta(days=ttl_days), json.dumps(data, ensure_ascii=False))
            except Exception:
                pass
        
        # Local Save
        expiry = (datetime.now() + timedelta(days=ttl_days)).isoformat()
        self.local_cache[key] = {'data': data, 'expiry': expiry}
        self._save_local()

class KeywordEngine:
    def __init__(self, settings):
        self.settings = settings
        self.cache = SimpleCache()
        self.negative_patterns = self._compile_negatives(settings.get('negative_keywords', ''))

    def _compile_negatives(self, neg_str):
        if not neg_str:
            return []
        words = [w.strip().lower() for w in neg_str.split(',') if w.strip()]
        return [re.compile(rf"\b{re.escape(w)}\b", re.I) for w in words]

    def normalize(self, text):
        """Standardize: lowercase, trim, remove emojis/special chars."""
        # Convert to lowercase and trim
        text = text.lower().strip()
        # Remove emojis and non-alphanumeric (keep spaces and basic punctuation)
        text = re.sub(r'[^\w\s\d,.-]', '', text)
        return text

    def is_negative(self, keyword):
        kw = keyword.lower()
        for pattern in self.negative_patterns:
            if pattern.search(kw):
                return True
        return False

    async def scrape_autocomplete(self, seed):
        """Web Scraping Mode (FREE) - Google & YouTube suggestions."""
        base_url = "http://suggestqueries.google.com/complete/search"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        kws = set()
        
        async with httpx.AsyncClient(headers=headers) as client:
            # Expand seed with alphabet soup for better coverage
            alphabet = [""] + list("abcdefghijklmnopqrstuvwxyz0123456789")
            tasks = []
            for char in alphabet:
                q = f"{seed} {char}".strip()
                tasks.append(client.get(base_url, params={"output": "chrome", "hl": "vi", "q": q}))
            
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            for resp in responses:
                if isinstance(resp, httpx.Response) and resp.status_code == 200:
                    try:
                        data = resp.json()
                        suggestions = data[1] if len(data) > 1 else []
                        for s in suggestions:
                            clean_s = s.lower().strip()
                            if not self.is_negative(clean_s):
                                kws.add(clean_s)
                    except Exception:
                        continue
        return list(kws)

    async def fetch_paid_metrics(self, keywords):
        """Paid API Mode - DataForSEO."""
        login = self.settings.get('dfseo_user')
        password = self.settings.get('dfseo_pass')
        if not login or not password:
            return []

        results = []
        async with httpx.AsyncClient(auth=(login, password)) as client:
            # DataForSEO batch call
            post_data = [{
                "keywords": keywords[:700], # Max batch
                "location_code": 2704, # VN
                "language_code": "vi",
            }]
            try:
                resp = await client.post("https://api.dataforseo.com/v3/dataforseo_labs/google/historical_search_volume/live", json=post_data, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    items = data.get('tasks', [{}])[0].get('result', [{}])[0].get('items', [])
                    for item in items:
                        results.append({
                            "keyword": item.get('keyword'),
                            "volume": str(item.get('keyword_info', {}).get('search_volume') or 0),
                            "difficulty": str(item.get('keyword_info', {}).get('competition_level') or 0),
                            "cpc": str(item.get('keyword_info', {}).get('cpc') or 0.0)
                        })
            except Exception as e:
                print(f"[!] Paid API Error: {e}", file=sys.stderr)
        return results

    async def classify_intent(self, keywords, niche_context):
        """AI Intent Classification (LLM)."""
        api_key = self.settings.get('api_key')
        if not api_key or not keywords:
            return [{"keyword": k, "intent": "Thông tin"} for k in keywords]

        # Process in batches of 50 as per PRD
        to_process = keywords[:50]
        prompt = f"""Phân loại NGỮ NGHĨA (Intent) cho danh sách từ khóa SEO. 
Ngách: {niche_context}
Trả về JSON mảng: [{{"keyword": "...", "intent": "Transactional/Informational/Commercial"}}]
Từ khóa: {json.dumps(to_process, ensure_ascii=False)}"""

        try:
            async with httpx.AsyncClient() as client:
                # Default to Gemini if key looks like one, or OpenAI
                if "AI_KEY" in api_key or len(api_key) > 40: # Weak check for Gemini/GPT
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
                    payload = {"contents": [{"parts": [{"text": prompt}]}]}
                    resp = await client.post(url, json=payload, timeout=20)
                    res_data = resp.json()
                    text = res_data['candidates'][0]['content']['parts'][0]['text']
                else:
                    url = "https://api.openai.com/v1/chat/completions"
                    headers = {"Authorization": f"Bearer {api_key}"}
                    payload = {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}]}
                    resp = await client.post(url, json=payload, headers=headers, timeout=20)
                    text = resp.json()['choices'][0]['message']['content']
                
                match = re.search(r'\[.*\]', text, re.DOTALL)
                if match:
                    return json.loads(match.group())
        except Exception as e:
            print(f"[!] AI Intent Error: {e}", file=sys.stderr)
        
        return [{"keyword": k, "intent": "Thông tin"} for k in to_process]

async def main():
    if len(sys.argv) < 2:
        return

    # Safe argument extraction
    def get_arg(idx, default=''):
        return sys.argv[idx] if len(sys.argv) > idx else default

    # Parse Args
    raw_seeds = get_arg(1).split('\n')
    niche_context = get_arg(2)
    negative_keywords = get_arg(3)
    validation_api = get_arg(4).lower() == 'true'
    
    settings = {
        'niche_context': niche_context,
        'negative_keywords': negative_keywords,
        'dfseo_user': get_arg(5),
        'dfseo_pass': get_arg(6),
        'api_key': get_arg(7),
        'model_name': get_arg(8)
    }

    engine = KeywordEngine(settings)
    final_results = []
    
    # Process each seed keyword
    for raw_seed in raw_seeds:
        seed = engine.normalize(raw_seed)
        if not seed:
            continue
        
        # 1. Check Cache
        cached = engine.cache.get(f"kw_v1_{seed}_{validation_api}")
        if cached:
            final_results.extend(cached)
            continue
            
        # 2. Execution Routing
        if validation_api:
            # Paid Mode: Directly fetch metrics for the seed (and maybe expansions)
            step_results = await engine.fetch_paid_metrics([seed])
            # If paid API returns nothing for seed, fallback to expansion
            if not step_results:
                expansions = await engine.scrape_autocomplete(seed)
                step_results = await engine.fetch_paid_metrics(expansions[:50])
        else:
            # Free Mode: Scrape suggestions
            expansions = await engine.scrape_autocomplete(seed)
            step_results = [{"keyword": k, "volume": "N/A", "difficulty": "0", "cpc": "0.0"} for k in expansions]

        # 3. AI Intent Labeling (Process top 50 unique results)
        unique_kws = list({r['keyword'] for r in step_results})[:50]
        intents = await engine.classify_intent(unique_kws, niche_context)
        intent_map = {i['keyword']: i['intent'] for i in intents}
        
        for r in step_results:
            r['intent'] = intent_map.get(r['keyword'], "Thông tin")

        # 4. Save to Cache
        engine.cache.set(f"kw_v1_{seed}_{validation_api}", step_results)
        final_results.extend(step_results)

    # Dedup final results
    seen = set()
    deduped = []
    for r in final_results:
        if r['keyword'] not in seen:
            deduped.append(r)
            seen.add(r['keyword'])

    # Final Output
    print(json.dumps(deduped, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(main())
