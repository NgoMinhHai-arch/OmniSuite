import asyncio
import httpx
import json
import sys
import os
import re
import math
import time
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from urllib.parse import quote_plus
from bs4 import BeautifulSoup

class IntentManager:
    """Quản lý Ý định người dùng (Tự động tìm model MẠNH NHẤT)"""
    def __init__(self):
        self.providers = {
            "google": {"base_url": "https://generativelanguage.googleapis.com/v1beta", "default": "gemini-pro"},
            "openai": {"base_url": "https://api.openai.com/v1", "default": "gpt-4"},
            "groq": {"base_url": "https://api.groq.com/openai/v1", "default": "llama3-70b-8192"},
            "claude": {"base_url": "https://api.anthropic.com/v1", "default": "claude-3-5-sonnet-latest"},
            "deepseek": {"base_url": "https://api.deepseek.com/v1", "default": "deepseek-chat"}
        }
        self.model_cache = {}

    def _extract_meta(self, model_id: str):
        v_match = re.search(r'(\d+\.\d+|\d+)', model_id)
        version = float(v_match.group(1)) if v_match else 0.0
        cap = 0
        if "deep-research" in model_id: cap = 40
        elif "-pro" in model_id: cap = 30
        elif "-flash" in model_id: cap = 20
        elif "-lite" in model_id: cap = 10
        stable = 0 if "preview" in model_id or "exp" in model_id else 1
        return (version, cap, stable)

    async def _auto_select_model(self, provider, api_key):
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
                        models = resp.json().get("models", [])
                        valid = [m["name"].replace("models/", "") for m in models if "gemini" in m["name"]]
                        if valid:
                            best = sorted(valid, key=self._extract_meta, reverse=True)[0]
                            self.model_cache[provider] = (best, now + 3600)
                            return best
                elif provider in ["openai", "groq", "deepseek"]:
                    url = f"{self.providers[provider]['base_url']}/models"
                    headers = {"Authorization": f"Bearer {api_key}"}
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        models_data = resp.json().get("data", [])
                        valid = [m["id"] for m in models_data]
                        if valid:
                            best = sorted(valid, key=self._extract_meta, reverse=True)[0]
                            self.model_cache[provider] = (best, now + 3600)
                            return best
        except: pass
        return self.providers.get(provider, {"default": "gpt-4"}).get("default")

    async def get_intents_batch(self, keywords, provider, api_keys, selected_model=None):
        if provider not in self.providers: return {kw: None for kw in keywords}
        api_key = api_keys.get(provider)
        if not api_key: return {kw: None for kw in keywords}
        
        mdl = selected_model or await self._auto_select_model(provider, api_key)
        batch_size = 50
        batches = [keywords[i:i+batch_size] for i in range(0, len(keywords), batch_size)]
        
        system_prompt = (
            "Phân tích ý định tìm kiếm (Search Intent) của danh sách từ khóa. Gán điểm xác suất (0.0 - 1.0) cho 4 loại sau:\n"
            "1. I (Informational): Tìm kiến thức, hướng dẫn, mẹo.\n"
            "2. N (Navigational): Tìm thương hiệu, website hoặc trang cụ thể.\n"
            "3. C (Commercial): So sánh, Review, đang cân nhắc mua hàng.\n"
            "4. T (Transactional): Mua hàng, đã sẵn sàng chi tiền.\n"
            "Yêu cầu: Tổng điểm = 1.0. Ưu tiên Tie-break: T > C > N > I. Trả về duy nhất chuẩn JSON."
        )

        async def analyze_batch(batch):
            try:
                if provider == "google":
                    url = f"{self.providers['google']['base_url']}/models/{mdl}:generateContent?key={api_key}"
                    payload = {"contents": [{"parts": [{"text": f"{system_prompt}\nKeywords: {json.dumps(batch)}"}]}]}
                    async with httpx.AsyncClient(timeout=20) as client:
                        r = await client.post(url, json=payload)
                        return self._parse(r.json()['candidates'][0]['content']['parts'][0]['text'])
                else: # OpenAI/Groq/DeepSeek
                    url = f"{self.providers[provider]['base_url']}/chat/completions"
                    headers = {"Authorization": f"Bearer {api_key}"}
                    payload = {
                        "model": mdl,
                        "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": json.dumps(batch)}],
                        "response_format": {"type": "json_object"}
                    }
                    async with httpx.AsyncClient(timeout=20) as client:
                        r = await client.post(url, headers=headers, json=payload)
                        return self._parse(r.json()['choices'][0]['message']['content'])
            except: return {}
        
        tasks = [analyze_batch(b) for b in batches]
        results = await asyncio.gather(*tasks)
        final = {}
        for r in results: final.update(r)
        return final

    def _parse(self, text):
        try:
            text = re.sub(r'```json|```', '', text).strip()
            data = json.loads(text)
            if isinstance(data, dict):
                for k in ["keywords", "results", "data"]:
                    if k in data: data = data[k]; break
            return {item["keyword"]: item["scores"] for item in data if "keyword" in item and "scores" in item}
        except: return {}

class TripleSourceScraper:
    """Hệ thống vét cạn Triple-Source: Alphabet Soup, PAA, LSI"""
    def __init__(self):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"}

    async def get_alphabet_soup(self, seed):
        found = {}
        base = "http://suggestqueries.google.com/complete/search"
        alphabet = list("abcdefghijklmnopqrstuvwxyz") + ["ă", "â", "đ", "ê", "ô", "ơ", "ư"]
        queries = [seed] + [f"{seed} {c}" for c in alphabet]
        
        async with httpx.AsyncClient(headers=self.headers, timeout=10) as client:
            for q in queries:
                try:
                    r = await client.get(base, params={"output": "chrome", "hl": "vi", "q": q})
                    if r.status_code == 200:
                        for idx, s in enumerate(r.json()[1]):
                            kw = re.sub(r'\s[a-zA-Z0-9]$', '', s).lower().strip()
                            if kw not in found or idx < found[kw]: found[kw] = idx
                except: continue
        return found

    async def get_serp_data(self, seed):
        paa = []
        lsi = []
        total_results = 0
        depth = 0
        try:
            url = f"https://www.google.com/search?q={quote_plus(seed)}&hl=vi"
            async with httpx.AsyncClient(headers=self.headers, timeout=15) as client:
                r = await client.get(url)
                if r.status_code == 200:
                    soup = BeautifulSoup(r.text, 'lxml')
                    stats = soup.select_one('#result-stats')
                    if stats:
                        nums = re.findall(r'[\d.,]+', stats.get_text())
                        if nums: total_results = int(nums[0].replace('.', '').replace(',', ''))
                    lsi_items = soup.select('div.BNeawe.s3V91c.AP7Wnd, div.wW7B9b, .Tr0dw')
                    lsi = list(set([i.get_text().lower().strip() for i in lsi_items if len(i.get_text()) > 3]))[:15]
                    paa_items = soup.select('div.related-question-pair, .iDP98c, .match-mod-horizontal-padding span')
                    paa = list(set([i.get_text().lower().strip() for i in paa_items if '?' in i.get_text()]))[:15]
                    nav = soup.select('td.cur, td a.fl')
                    depth = min(100, len(nav) * 10) if nav else 10
        except: pass
        return paa, lsi, total_results, depth

class SEOAnalyzerEngine:
    async def analyze(self, seed, provider="google", model=None, api_keys=None):
        scraper = TripleSourceScraper()
        intent_mgr = IntentManager()
        
        soup_task = scraper.get_alphabet_soup(seed)
        serp_task = scraper.get_serp_data(seed)
        found_soup, (found_paa, found_lsi, total_r, depth) = await asyncio.gather(soup_task, serp_task)
        
        all_kws = list(set(list(found_soup.keys()) + found_paa + found_lsi))
        final_list = all_kws[:400]
        intents = await intent_mgr.get_intents_batch(final_list, provider, api_keys or {}, model)
        
        # Power Law Calculation
        raw_scores = []
        metrics_list = []
        for kw in final_list:
            rank = found_soup.get(kw, 10)
            wc = len(kw.split())
            # Raw_Score = ((11 - rank)**2) * np.log10(total_results + 1) / (word_count**1.5)
            r_val = total_r if total_r > 0 else 1000 # Fallback
            raw_s = ((11 - rank)**2) * math.log10(r_val + 1) / (wc ** 1.5)
            raw_scores.append(raw_s)
            metrics_list.append({"kw": kw, "wc": wc, "r": r_val})
            
        # Normalization
        scores_arr = np.array(raw_scores).reshape(-1, 1)
        if len(raw_scores) > 1 and np.max(scores_arr) > np.min(scores_arr):
            scaler = MinMaxScaler(feature_range=(0.001, 1.0))
            normalized = scaler.fit_transform(scores_arr).flatten()
        else:
            normalized = np.ones(len(raw_scores))
        
        results = []
        for i, m in enumerate(metrics_list):
            kw = m["kw"]
            # Popularity = Normalized^2.5 * 100
            pop = np.power(normalized[i], 2.5) * 100
            pop = max(1, min(99, round(pop)))
            
            # KD = (Popularity * 0.6) + (np.log10(total_results + 1) * 4) - (word_count * 2)
            kd_raw = (pop * 0.6) + (math.log10(m["r"] + 1) * 4) - (m["wc"] * 2)
            kd = max(1, min(99, round(kd_raw)))
            
            ei = round((pop * (100 - kd)) / 100, 1)
            
            results.append({
                "keyword": kw,
                "popularity": pop,
                "difficulty": kd,
                "efficiency": ei,
                "intent_scores": intents.get(kw) or {"I": 0.5, "N": 0.1, "C": 0.2, "T": 0.2},
                "source": "PAA" if kw in found_paa else ("LSI" if kw in found_lsi else "Autocomplete")
            })
            
        results.sort(key=lambda x: x['efficiency'], reverse=True)
        return results

async def main():
    if len(sys.argv) < 2: return
    seed = sys.argv[1]
    keys = {
        "google": os.getenv("GEMINI_API_KEY"),
        "openai": os.getenv("OPENAI_API_KEY"),
        "groq": os.getenv("GROQ_API_KEY"),
        "deepseek": os.getenv("DEEPSEEK_API_KEY"),
        "claude": os.getenv("CLAUDE_API_KEY")
    }
    engine = SEOAnalyzerEngine()
    res = await engine.analyze(seed, os.getenv("INTENT_PROVIDER", "google"), os.getenv("INTENT_MODEL"), keys)
    print(json.dumps(res, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(main())
