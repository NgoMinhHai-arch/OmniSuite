"""
OMNITOOL AI - KEYWORD ESTIMATION ENGINE V2.0
Kỹ thuật "Mồi nhử" + Lọc sạch (Data Cleaning)
Alphabet: Latin (a-z) + Tiếng Việt (ă, â, đ, ê, ô, ơ, ư)
"""

import asyncio
import httpx
import json
import sys
import os
import re
import math
from bs4 import BeautifulSoup
import random
from datetime import datetime, timedelta
from urllib.parse import quote_plus
try:
    from pytrends.request import TrendReq
except ImportError:
    TrendReq = None

CACHE_FILE = "keyword_cache_demo.json"

# --- ALPHABET MỒI NHỬ ---
LATIN_ALPHABET = list("abcdefghijklmnopqrstuvwxyz")
VIETNAMESE_CHARS = ["ă", "â", "đ", "ê", "ô", "ơ", "ư"]
FULL_ALPHABET = LATIN_ALPHABET + VIETNAMESE_CHARS

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

        return 100000

class UniversalIntentManager:
    def __init__(self):
        self.providers = {
            "google": {"base_url": "https://generativelanguage.googleapis.com/v1beta", "default": "gemini-1.5-flash"},
            "openai": {"base_url": "https://api.openai.com/v1", "default": "gpt-4o-mini"},
            "groq": {"base_url": "https://api.groq.com/openai/v1", "default": "llama-3.3-70b-versatile"},
            "claude": {"base_url": "https://api.anthropic.com/v1", "default": "claude-3-5-sonnet-latest"},
            "deepseek": {"base_url": "https://api.deepseek.com/v1", "default": "deepseek-chat"}
        }
        self.model_cache = {} # {provider: (model_name, expiry_time)}

    async def _auto_select_model(self, provider: str, api_key: str):
        """Tự động tìm model mới nhất từ API của Provider (Gemini 2.0+, GPT-5+, v.v.)"""
        import time
        now = time.time()
        if provider in self.model_cache:
            model, expiry = self.model_cache[provider]
            if now < expiry: return model

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                if provider == "google":
                    url = f"{self.providers['google']['base_url']}/models?key={api_key}"
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        modelsData = resp.json().get("models", [])
                        flash_models = [m["name"].replace("models/", "") for m in modelsData if "gemini" in m["name"] and "flash" in m["name"]]
                        if flash_models:
                            best = sorted(flash_models, reverse=True)[0]
                            self.model_cache[provider] = (best, now + 3600)
                            return best
                elif provider in ["openai", "groq"]:
                    url = f"{self.providers[provider]['base_url']}/models"
                    headers = {"Authorization": f"Bearer {api_key}"}
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        modelsData = resp.json().get("data", [])
                        if provider == "openai":
                            gpt_models = [m["id"] for m in modelsData if m["id"].startswith("gpt-") and "vision" not in m["id"]]
                            if gpt_models:
                                best = sorted(gpt_models, reverse=True)[0]
                                self.model_cache[provider] = (best, now + 3600)
                                return best
                        else: # Groq or Other
                            valid_models = [m["id"] for m in modelsData if any(x in m["id"] for x in ["llama", "mixtral", "gpt"])]
                            if valid_models:
                                best = sorted(valid_models, reverse=True)[0]
                                self.model_cache[provider] = (best, now + 3600)
                                return best
                elif provider == "claude":
                    return "claude-3-5-sonnet-latest"
                elif provider == "deepseek":
                    return "deepseek-chat"
        except: pass
        return self.providers.get(provider, {"default": "gpt-4"}).get("default", "gpt-4")

    async def get_intents_batch(self, keywords: list[str], provider: str, api_keys: dict, model: str = None):
        """Phân tích Ý định theo Batch 50 từ khóa song song (Smart Engine)"""
        if provider not in self.providers:
            return {kw: None for kw in keywords}
            
        api_key = api_keys.get(provider)
        if not api_key:
            return {kw: None for kw in keywords}
            
        # Tự động tìm model tốt nhất/mới nhất nếu không chỉ định
        selected_model = model or await self._auto_select_model(provider, api_key)
        
        # Chia batch 50
        batch_size = 50
        batches = [keywords[i:i+batch_size] for i in range(0, len(keywords), batch_size)]
        
        system_prompt = (
            "Phân tích ý định tìm kiếm (Search Intent) của danh sách từ khóa. "
            "CHỈ được phép trả về DUY NHẤT 1 ký tự đại diện cho mỗi từ khóa: [I, N, C, T].\n"
            "1. I (Informational): Tìm kiến thức, hướng dẫn, mẹo.\n"
            "2. N (Navigational): Tìm thương hiệu, website hoặc trang cụ thể.\n"
            "3. C (Commercial): So sánh, Review, đang cân nhắc mua hàng.\n"
            "4. T (Transactional): Mua hàng, đã sẵn sàng chi tiền.\n"
            "Cấm trả về tỷ lệ phần trăm (%). Nếu không chắc chắn, mặc định gán là [I].\n"
            "Trả về JSON: [{\"keyword\": \"...\", \"intent\": \"I\"}]"
        )

        async def analyze_batch(batch):
            try:
                if provider == "google":
                    url = f"{self.providers['google']['base_url']}/models/{selected_model}:generateContent?key={api_key}"
                    payload = {"contents": [{"parts": [{"text": f"{system_prompt}\nKeywords: {json.dumps(batch)} "}]}]}
                    async with httpx.AsyncClient(timeout=15) as client:
                        resp = await client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            text = data['candidates'][0]['content']['parts'][0]['text']
                            return self._parse_json_res(text)
                elif provider == "claude":
                    url = f"{self.providers['claude']['base_url']}/messages"
                    headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
                    payload = {
                        "model": selected_model,
                        "max_tokens": 4096,
                        "system": system_prompt,
                        "messages": [{"role": "user", "content": json.dumps(batch)}]
                    }
                    async with httpx.AsyncClient(timeout=30) as client:
                        resp = await client.post(url, headers=headers, json=payload)
                        if resp.status_code == 200:
                            text = resp.json()['content'][0]['text']
                            return self._parse_json_res(text)
                else: # OpenAI & Groq
                    url = f"{self.providers[provider]['base_url']}/chat/completions"
                    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
                    payload = {
                        "model": selected_model,
                        "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": json.dumps(batch)}],
                        "response_format": {"type": "json_object"}
                    }
                    async with httpx.AsyncClient(timeout=15) as client:
                        resp = await client.post(url, headers=headers, json=payload)
                        if resp.status_code == 200:
                            text = resp.json()['choices'][0]['message']['content']
                            return self._parse_json_res(text)
            except: pass
            return {}

        resultsData = await asyncio.gather(*[analyze_batch(b) for b in batches])
        
        # Merge results
        final_data = {}
        for res in resultsData:
            final_data.update(res)
        return final_data

    def _parse_json_res(self, text):
        try:
            text = re.sub(r'```json|```', '', text).strip()
            data = json.loads(text)
            if isinstance(data, dict):
                for k in ["keywords", "results", "data"]:
                    if k in data: data = data[k]; break
            return {item["keyword"]: item.get("intent", "I") for item in data if "keyword" in item}
        except: return {}

def classify_intent_regex(keyword: str):
    """Xác định Intent mặc định dựa trên Regex (fallback)"""
    kw = keyword.lower()
    if any(w in kw for w in ['giá', 'mua', 'bán', 'rẻ', 'chính hãng', 'shop', 'order']): return "T"
    if any(w in kw for w in ['review', 'top', 'tốt nhất', 'so sánh', 'đánh giá']): return "C"
    if any(w in kw for w in ['official', 'website', 'login', 'trang chủ']): return "N"
    return "I"

intent_manager = UniversalIntentManager()

class TrendsManager:
    """Quản lý kết nối và lấy dữ liệu xu hướng từ Google Trends (Pytrends)."""
    def __init__(self):
        self.pytrends = None
        if TrendReq:
            try:
                # hl='vi-VN', tz=420 (Vietnam)
                self.pytrends = TrendReq(hl='vi-VN', tz=420, timeout=(10, 25))
            except:
                self.pytrends = None

    def get_trends(self, keywords: list[str]):
        """Lấy dữ liệu Interest Over Time cho tối đa 5 từ khóa."""
        if not self.pytrends or not keywords: return {}
        try:
            # Pytrends chỉ nhận tối đa 5 keywords 1 lúc
            safe_kw = keywords[:5]
            self.pytrends.build_payload(safe_kw, cat=0, timeframe='today 12-m', geo='VN', gprop='')
            # df = self.pytrends.interest_over_time()
            # To avoid issues with some environments, we use a try-except here too
            try:
                df = self.pytrends.interest_over_time()
            except:
                return {}
            
            trends_results = {}
            if not df.empty:
                for kw in safe_kw:
                    if kw in df.columns:
                        series = df[kw].tolist()
                        current = series[-1] if series else 0
                        previous = series[-2] if len(series) > 1 else current
                        diff = current - previous
                        growth = round((diff / (previous or 1)) * 100, 1) if previous != 0 else 0
                        trends_results[kw] = {
                            "index": int(current),
                            "growth": growth,
                            "history": [int(x) for x in series]
                        }
            return trends_results
        except Exception:
            return {}
    def generate_estimated_trend(self, keyword: str, popularity: float):
        """Tạo xu hướng mô phỏng dựa trên sức nóng của từ khóa."""
        import random
        # Sử dụng seed dựa trên từ khóa để đảm bảo kết quả nhất quán
        random.seed(keyword)
        
        # Tạo 12 điểm dữ liệu xung quanh mức popularity
        history = []
        base = max(10, min(90, popularity))
        for i in range(12):
            # Thêm một chút dao động sin và nhiễu ngẫu nhiên
            noise = random.randint(-15, 15)
            wave = math.sin(i * 0.5) * 10
            val = int(max(5, min(100, base + wave + noise)))
            history.append(val)
            
        current = history[-1]
        previous = history[-2]
        growth = round(((current - previous) / (previous or 1)) * 100, 1)
        
        return {
            "index": current,
            "growth": growth,
            "history": history,
            "is_estimated": True
        }

trends_manager = TrendsManager()

# --- ESTIMATION ENGINE ---
class EstimationEngine:
    def __init__(self):
        self.cache = SimpleCache()
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

    def normalize(self, text):
        text = text.lower().strip()
        text = re.sub(r'[^\w\s\d,.-]', '', text)
        return text

    def is_valid_keyword(self, keyword, seed):
        keyword = keyword.strip().lower()
        seed = seed.strip().lower()
        if keyword == seed: return False
        last_char = keyword[-1] if keyword else ""
        if last_char in FULL_ALPHABET and len(keyword) == len(seed) + 2:
            if keyword == f"{seed} {last_char}": return False
        if re.match(rf"^{re.escape(seed)}\s+\d+$", keyword): return False
        seed_words = seed.split()
        keyword_words = keyword.split()
        common_words = set(seed_words) & set(keyword_words)
        if not common_words: return False
        if len(keyword) < len(seed) or len(keyword) > 100: return False
        return True

    async def fetch_autocomplete(self, client, query):
        base_url = "http://suggestqueries.google.com/complete/search"
        try:
            resp = await client.get(base_url, params={"output": "chrome", "hl": "vi", "q": query})
            if resp.status_code == 200:
                data = resp.json()
                return data[1] if len(data) > 1 else []
        except: pass
        return []

    async def get_all_suggestions(self, seed):
        all_suggestions = {seed.strip().lower(): {"rank": 0, "source": "SEED"}} # Inclue the seed itself
        bait_queries = []
        for char in FULL_ALPHABET:
            bait_queries.append(f"{seed} {char}")
        prefixes = ["mua", "giá", "cách", "review", "so sánh", "tốt nhất"]
        for prefix in prefixes:
            bait_queries.append(f"{prefix} {seed}")
            for char in LATIN_ALPHABET[:5]:
                bait_queries.append(f"{prefix} {seed} {char}")
        async with httpx.AsyncClient(headers=self.headers, timeout=10, follow_redirects=True) as client:
            batch_size = 10
            for i in range(0, len(bait_queries), batch_size):
                batch = bait_queries[i:i+batch_size]
                tasks = [self.fetch_autocomplete(client, q) for q in batch]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for idx, suggestions in enumerate(results):
                    if isinstance(suggestions, list):
                        source_query = batch[idx]
                        for rank, suggestion in enumerate(suggestions):
                            suggestion = suggestion.strip().lower()
                            if not self.is_valid_keyword(suggestion, seed): continue
                            if suggestion not in all_suggestions or rank + 1 < all_suggestions[suggestion]["rank"]:
                                all_suggestions[suggestion] = {"rank": rank + 1, "source": source_query}
        return all_suggestions

    async def get_search_results_count(self, keyword):
        try:
            url = f"https://www.google.com/search?q={quote_plus(keyword)}&hl=vi"
            async with httpx.AsyncClient(headers=self.headers, timeout=15, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, 'html.parser')
                    result_stats = soup.find('div', {'id': 'result-stats'})
                    if result_stats:
                        text = result_stats.get_text()
                        numbers = re.findall(r'[\d.]+', text.replace(',', ''))
                        if numbers:
                            total_str = numbers[0].replace('.', '')
                            return int(total_str)
        except: pass
        return 100000

    def calculate_popularity(self, rank):
        if rank is None: return 15
        return max(15, min(100, 100 - (rank * 10)))

    def calculate_difficulty(self, total_results, keyword):
        if total_results <= 0 or total_results == 100000:
            kd = max(5, min(95, 100 - (len(keyword) * random.uniform(1.8, 2.3))))
            return round(kd)
        kd = min(100, round(math.log10(total_results + 1) * 12))
        return max(1, min(100, kd))

    def calculate_efficiency(self, popularity, difficulty):
        return round((popularity * (100 - difficulty)) / 100, 1)

    def get_efficiency_badge(self, ei):
        if ei > 75: return {"label": "Nên sử dụng", "color": "green", "bg": "emerald", "text": "white"}
        elif ei >= 30: return {"label": "Nên xem xét", "color": "yellow", "bg": "amber", "text": "black"}
        else: return {"label": "Nên tham khảo", "color": "red", "bg": "rose", "text": "white"}

    async def perform_bulk_analyze(self, keywords_list, provider="google", model=None, ranks=None):
        api_key_env = {
            "google": os.getenv("GEMINI_API_KEY"),
            "openai": os.getenv("OPENAI_API_KEY"),
            "groq": os.getenv("GROQ_API_KEY"),
            "claude": os.getenv("CLAUDE_API_KEY"),
            "deepseek": os.getenv("DEEPSEEK_API_KEY")
        }
        intent_provider = provider or os.getenv("INTENT_PROVIDER", "google")

        # 1. Intent Batch
        ai_intents = {}
        disable_ai = os.getenv("DISABLE_AI", "false").lower() == "true"
        if not disable_ai:
            for i in range(0, len(keywords_list), 50):
                chunk = keywords_list[i:i+50]
                scores = await intent_manager.get_intents_batch(chunk, intent_provider, api_key_env, model=model)
                ai_intents.update(scores)

        # 1.5 Trends Data (Limit to top 20 keywords for stability/rate-limit)
        trends_data = {}
        top_for_trends = keywords_list[:20]
        # Xử lý theo batch 5 để tránh lỗi Pytrends
        for i in range(0, len(top_for_trends), 5):
            batch = top_for_trends[i:i+5]
            # trends_manager.get_trends is synchronous, running in thread
            res = await asyncio.to_thread(trends_manager.get_trends, batch)
            trends_data.update(res)

        # 2. Collect Metrics
        results_raw = []
        sem = asyncio.Semaphore(10)
        async def fetch_metrics(kw):
            async with sem:
                # Raw_Score = (10 - rank) + Source Bonus
                rank = ranks.get(kw, 10) if ranks else 10
                source_bonus = 0
                if random.random() > 0.8: source_bonus += 5 # Mock source/PAA bonus
                raw_pop = (10 - min(rank, 10)) + source_bonus
                
                # Mock AllInTitle for demo if not scraping properly
                allintitle = await self.get_search_results_count(kw)
                return {"kw": kw, "raw_pop": raw_pop, "allintitle": allintitle}

        tasks = [fetch_metrics(kw) for kw in keywords_list]
        metrics_list = await asyncio.gather(*tasks)

        # 3. POP (%) Normalization: ((Raw - Min) / (Max - Min)) * 98 + 1
        raw_pops = [m["raw_pop"] for m in metrics_list]
        min_p = min(raw_pops) if raw_pops else 0
        max_p = max(raw_pops) if raw_pops else 1
        p_range = max_p - min_p or 1

        # 4. Final Calculation & Print
        final_list = []
        for m in metrics_list:
            pop = ((m["raw_pop"] - min_p) / p_range) * 98 + 1
            
            # KD = 50 + Length_Modifier + Intent_Penalty + Exact_Match_Penalty
            wc = len(m["kw"].split())
            length_mod = (4 - wc) * 5
            
            intent_char = ai_intents.get(m["kw"]) or classify_intent_regex(m["kw"])
            intent_penalty = 0
            if any(w in m["kw"].lower() for w in ['mua', 'giá', 'bán', 'rẻ', 'chính hãng']): intent_penalty = 15
            elif any(w in m["kw"].lower() for w in ['review', 'top', 'tốt nhất']): intent_penalty = 10
            elif any(w in m["kw"].lower() for w in ['cách', 'hướng dẫn', 'là gì']): intent_penalty = -5
            
            exact_penalty = 0
            ait = m["allintitle"]
            if ait > 100000: exact_penalty = 20
            elif 0 <= ait < 10000: exact_penalty = -10
            elif ait == 0:
                if wc <= 2: exact_penalty = 20
                elif wc >= 6: exact_penalty = -10
            
            kd = 50 + length_mod + intent_penalty + exact_penalty
            kd = max(1, min(99, kd))
            
            ei = (pop * (100 - kd)) / 100
            
            # Trend Fallback: Nếu không có dữ liệu từ Google Trends, tạo dữ liệu mô phỏng
            trend_info = trends_data.get(m["kw"])
            if not trend_info or not trend_info.get("history"):
                trend_info = trends_manager.generate_estimated_trend(m["kw"], pop)
            
            res = {
                "keyword": m["kw"],
                "popularity": int(pop),
                "difficulty": int(kd),
                "efficiency": round(ei, 1),
                "intent": intent_char,
                "badge": self.get_efficiency_badge(ei),
                "trend": trend_info,
                "total_results": m["allintitle"]
            }
            print(json.dumps(res, ensure_ascii=False))
            sys.stdout.flush()
            final_list.append(res)
        return final_list

    async def analyze_keywords(self, seed, provider="google", model=None, mode="FULL", input_list=None, ranks=None):
        if mode == "ANALYZE" and input_list:
            return await self.perform_bulk_analyze(input_list, provider, model, ranks=ranks)
        
        # Scrape Phase
        suggestions_data = await self.get_all_suggestions(seed)
        keywords_list = list(suggestions_data.keys())
        
        if mode == "SCRAPE":
            res_ranks = {k: v["rank"] for k, v in suggestions_data.items()}
            print(json.dumps({"keywords": keywords_list, "ranks": res_ranks}, ensure_ascii=False))
            return keywords_list

        # FULL Mode
        full_ranks = {k: v["rank"] for k, v in suggestions_data.items()}
        return await self.perform_bulk_analyze(keywords_list, provider, model, ranks=full_ranks)


async def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("seed", nargs="?", default="")
    parser.add_argument("--mode", choices=["FULL", "SCRAPE", "ANALYZE"], default="FULL")
    parser.add_argument("--list", help="JSON list of keywords for ANALYZE mode")
    parser.add_argument("--ranks", help="JSON map of keyword ranks for ANALYZE mode")
    args = parser.parse_args()
    
    provider = os.getenv("INTENT_PROVIDER", "google")
    model = os.getenv("INTENT_MODEL")
    engine = EstimationEngine()
    
    input_list = None
    if args.list:
        try: input_list = json.loads(args.list)
        except: pass

    input_ranks = None
    if args.ranks:
        try: input_ranks = json.loads(args.ranks)
        except: pass

    await engine.analyze_keywords(args.seed, provider, model, mode=args.mode, input_list=input_list, ranks=input_ranks)


if __name__ == "__main__":
    asyncio.run(main())
