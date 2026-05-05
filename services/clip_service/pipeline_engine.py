import sys
import uvicorn
import threading
import torch
import requests
import re
import traceback
import os

# Force UTF-8 for Windows console support
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
from io import BytesIO
import concurrent.futures
from fastapi import Header, Depends

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- AI CORE CONFIG ---
MODEL_ID = "openai/clip-vit-base-patch32"
device = "cuda" if torch.cuda.is_available() else "cpu"
model = None
processor = None
is_ready = False
loading_error = None

def load_ai():
    global model, processor, is_ready, loading_error
    print(f"[*] AI System: Loading CLIP on {device}...")
    try:
        model = CLIPModel.from_pretrained(MODEL_ID).to(device)
        processor = CLIPProcessor.from_pretrained(MODEL_ID)
        is_ready = True
        print("[*] AI System: READY and FUNCTIONAL.")
    except Exception as e:
        loading_error = str(e)
        print(f"[!] AI LOAD ERROR: {traceback.format_exc()}")

# Khoi dong nạp model ngầm
threading.Thread(target=load_ai, daemon=True).start()

# --- KEYWORD ENGINE CACHE (RAM ONLY) ---

class SearchReq(BaseModel):
    keyword: str
    location: str = ''
    place_type: str = ''
    limit: int = 24
    use_premium: bool = False
    serpapi_key: str = ''
    filter_strength: str = 'default'  # default | precise | advanced

# Bing/DDG pool sizes and CLIP primary threshold per strength (fallback logic unchanged).
STRENGTH_CONFIG = {
    'default': {'bing': 50, 'ddg': 50, 'threshold': 0.30, 'expand': False},
    'precise': {'bing': 80, 'ddg': 80, 'threshold': 0.35, 'expand': False},
    'advanced': {'bing': 150, 'ddg': 150, 'threshold': 0.40, 'expand': True},
}

def fetch_bing_urls(keyword, location='', limit=50):
    query = f"{keyword} {location}".strip()
    print(f"[*] [THREAD] Fetching from BING: {query} (Limit: {limit})")
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"}
        search_url = f"https://www.bing.com/images/search?q={query}"
        resp = requests.get(search_url, headers=headers, timeout=12)
        found_urls = re.findall(r'murl&quot;:&quot;(http.*?)&quot;', resp.text)
        return list(dict.fromkeys(found_urls))[:limit]
    except Exception as e:
        print(f"[!] Bing Error: {str(e)}")
        return []

def fetch_google_images(keyword, location='', serpapi_key='', limit=30):
    query = f"{keyword} {location}".strip()
    print(f"[*] [THREAD] Fetching from GOOGLE IMAGES: {query}")
    # Try SerpAPI first (More stable)
    if serpapi_key:
        try:
            url = f"https://serpapi.com/search.json?engine=google_images&q={query}&api_key={serpapi_key}"
            resp = requests.get(url, timeout=12)
            data = resp.json()
            images = data.get("images_results", [])
            return [img.get("original") for img in images if img.get("original")][:limit]
        except Exception as e:
            print(f"[!] SerpAPI Image Error: {str(e)}")
    return []

def fetch_google_maps(keyword, location='', serpapi_key='', limit=30):
    # Specialized Maps Query: Location is critical here
    query = f"{keyword} {location}".strip()
    print(f"[*] [THREAD] Deep Local Fetching from GOOGLE MAPS: {query}")
    urls = []
    
    if serpapi_key:
        try:
            # Step 1: Search for the place
            url = f"https://serpapi.com/search.json?engine=google_maps&q={query}&type=search&api_key={serpapi_key}"
            resp = requests.get(url, timeout=12)
            data = resp.json()
            results = data.get("place_results", []) or data.get("local_results", [])
            
            for p in results[:10]: # Check top results for real photos
                if p.get("thumbnail"):
                    urls.append(p.get("thumbnail"))
                if p.get("photos"):
                    for photo in p.get("photos")[:8]:
                        if photo.get("thumbnail"):
                            urls.append(photo.get("thumbnail"))
            
            # Step 2: If we didn't get enough, try a broader images search specifically targeted at maps/reviews
            if len(urls) < 10:
                url_img = f"https://serpapi.com/search.json?engine=google_images&q={query} customer real photos google maps&api_key={serpapi_key}"
                resp_img = requests.get(url_img, timeout=10)
                images = resp_img.json().get("images_results", [])
                urls.extend([img.get("original") for img in images if img.get("original")][:15])

            return list(dict.fromkeys(urls))[:limit]
        except Exception as e:
            print(f"[!] SerpAPI Maps Optimization Error: {str(e)}")
            
    return []

def fetch_duckduckgo_urls(keyword, location='', limit=50):
    query = f"{keyword} {location}".strip()
    print(f"[*] [THREAD] Fetching from DUCKDUCKGO: {query} (Limit: {limit})")
    try:
        # DDG specific headers
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest"
        }
        # First get the vqd token
        token_url = f"https://duckduckgo.com/?q={query}&t=h_&iar=images&iax=images&ia=images"
        token_resp = requests.get(token_url, headers=headers, timeout=10)
        vqd_match = re.search(r"vqd='(.*?)'", token_resp.text)
        if not vqd_match:
            return []
        vqd = vqd_match.group(1)
        
        # Now fetch images via DDG API
        api_url = "https://duckduckgo.com/i.js"
        params = {
            "q": query, "o": "json", "vqd": vqd, "f": ",,,", "p": "1"
        }
        resp = requests.get(api_url, headers=headers, params=params, timeout=10)
        data = resp.json()
        results = data.get("results", [])
        return [r.get("image") for r in results if r.get("image")][:limit]
    except Exception as e:
        print(f"[!] DuckDuckGo Error: {str(e)}")
        return []

# --- SECURITY CONFIG (INTERNAL ONLY) ---
INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN")
if not INTERNAL_TOKEN:
    raise RuntimeError("Missing INTERNAL_TOKEN environment variable.")

@app.get("/api/v1/health")
def health():
    if loading_error:
        return {"status": "error", "message": loading_error}
    return {"status": "ready" if is_ready else "loading"}

async def verify_token(x_internal_token: str = Header(None)):
    if x_internal_token != INTERNAL_TOKEN:
        print(f"[!] SECURITY ALERT: Unauthorized access attempt with token: {x_internal_token}")
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid security token.")
    return True

@app.post("/api/v1/semantic-filter")
async def search(req: SearchReq, authenticated: bool = Depends(verify_token)):
    try:
        if not is_ready:
            raise HTTPException(status_code=503, detail="AI System is still warming up.")
        
        # SMART SEARCH EXPANSION
        queries = [
            f"{req.keyword} {req.location} {req.place_type}".strip(),
            f"real photo of {req.keyword} {req.location}".strip()
        ]
        
        full_query = queries[0]
        fs = (req.filter_strength or 'default').strip().lower()
        if fs not in STRENGTH_CONFIG:
            fs = 'default'
        cfg = STRENGTH_CONFIG[fs]
        score_threshold = cfg['threshold']
        bing_n = cfg['bing']
        ddg_n = cfg['ddg']

        # Primary fetch uses keyword + location; advanced adds second query variant for broader pool.
        search_pairs = [(req.keyword, req.location)]
        if cfg['expand']:
            expand_kw = f"real photo of {req.keyword} {req.location}".strip()
            search_pairs.append((expand_kw, ''))

        print(f"\n--- DEEP HYBRID SEARCH: {full_query} (Premium: {req.use_premium}, Strength: {fs}) ---")
        
        # Sources Tracking for Trust Scoring
        source_map = {} # url -> source_type
        
        def track_urls(urls, source_type):
            if not urls:
                return []
            for u in urls:
                if not u:
                    continue
                # Simple normalization to avoid basic duplicates
                norm_u = u.split('?')[0].split('#')[0].lower().strip()
                if norm_u not in source_map:
                    source_map[norm_u] = source_type
            return urls

        # Parallel Fetching (multiple query variants when advanced)
        jobs_per_variant = 2 + (2 if req.use_premium else 0)
        pool_workers = min(16, max(5, len(search_pairs) * jobs_per_variant))
        with concurrent.futures.ThreadPoolExecutor(max_workers=pool_workers) as executor:
            futures = {}
            for kw, loc in search_pairs:
                futures[executor.submit(fetch_bing_urls, kw, loc, bing_n)] = "bing"
                futures[executor.submit(fetch_duckduckgo_urls, kw, loc, ddg_n)] = "ddg"
                if req.use_premium:
                    futures[executor.submit(fetch_google_images, kw, loc, req.serpapi_key, 30)] = "google"
                    futures[executor.submit(fetch_google_maps, kw, loc, req.serpapi_key, 25)] = "maps"
                
            for future in concurrent.futures.as_completed(futures):
                stype = futures[future]
                try:
                    track_urls(future.result(), stype)
                except Exception as e:
                    print(f"[!] Thread Exception ({stype}): {e}")

        urls = list(source_map.keys())
        print(f"[*] Aggregated {len(urls)} unique candidates. Applying Deep AI Filtering...")

        final_results = []
        scored_candidates = []
        
        # ENSURE LABELS ARE OPTIMIZED
        # Positive vs Negative logic
        labels = [
            f"a high quality clear photo of {full_query}", 
            "text-heavy image, screenshot, map with pins, logo, digital illustration, blurred photo, icon"
        ]

        for url in urls:
            if len(final_results) >= req.limit:
                break
            
            try:
                source_type = source_map.get(url, "unknown")
                img_resp = requests.get(url, timeout=5, stream=True)
                if img_resp.status_code != 200:
                    continue
                
                # Check file size (ignore tiny files)
                if int(img_resp.headers.get('Content-Length', 0)) < 5000:
                    continue
                
                img_data = img_resp.content
                img = Image.open(BytesIO(img_data)).convert("RGB")
                
                # REJECTION: Too small (Accuracy improvement)
                if img.width < 350 or img.height < 350:
                    continue

                inputs = processor(text=labels, images=[img], return_tensors="pt", padding=True).to(device)
                with torch.no_grad():
                    outputs = model(**inputs)
                
                probs = outputs.logits_per_image.softmax(dim=1)
                score = float(probs[0][0].item())
                
                # --- SMART TRUST SCORING ---
                if source_type == "maps":
                    score += 0.15 # Strong Trust for Maps
                elif source_type == "google":
                    score += 0.05 # Trust for Google Images
                elif source_type == "ddg":
                    score += 0.02 # DDG is usually cleaner than Bing
                
                candidate = {
                    "url": url,
                    "score": round(min(score, 1.0), 4),
                    "source": source_type,
                    "width": img.width,
                    "height": img.height
                }
                scored_candidates.append(candidate)

                # Filtering threshold by strength (fallback below still fills to req.limit when possible)
                if score > score_threshold:
                    final_results.append(candidate)
            except Exception:
                continue

        # Sort by score descending
        final_results.sort(key=lambda x: x['score'], reverse=True)

        # Fallback có kiểm soát:
        # Nếu chưa đủ số lượng yêu cầu, nới ngưỡng vừa phải để bổ sung ảnh còn thiếu.
        if len(final_results) < req.limit:
            seen_urls = {item["url"] for item in final_results}
            source_priority = {"maps": 0, "google": 1, "ddg": 2, "bing": 3, "unknown": 4}
            fallback_threshold = 0.22

            scored_candidates.sort(
                key=lambda x: (
                    source_priority.get(x.get("source", "unknown"), 4),
                    -x.get("score", 0.0)
                )
            )

            for candidate in scored_candidates:
                if len(final_results) >= req.limit:
                    break
                if candidate["url"] in seen_urls:
                    continue
                if candidate.get("score", 0.0) < fallback_threshold:
                    continue
                final_results.append(candidate)
                seen_urls.add(candidate["url"])

            # Hard fallback: if still short, fill from remaining validated candidates
            # so returned count matches user-selected limit whenever possible.
            if len(final_results) < req.limit:
                for candidate in scored_candidates:
                    if len(final_results) >= req.limit:
                        break
                    if candidate["url"] in seen_urls:
                        continue
                    final_results.append(candidate)
                    seen_urls.add(candidate["url"])

        print(f"--- COMPLETE: Found {len(final_results)} optimized results ---")
        return {"status": "success", "images": final_results}

    except Exception as e:
        error_detail = traceback.format_exc()
        print(f"[CRITICAL SEARCH ERROR] {error_detail}")
        raise HTTPException(status_code=500, detail=f"Python Error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
