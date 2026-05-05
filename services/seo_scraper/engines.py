import requests
import random
from bs4 import BeautifulSoup
from duckduckgo_search import DDGS

from services.core.browser_manager import managed_page, HumanBehaviorSimulator
from services.seo_scraper.classifier import get_page_type, classify_site_intent, classify_site_type

# UI THEME COLORS
P = "\033[38;2;99;102;241m" # Indigo
C = "\033[96m"             # Cyan
R = "\033[0m"              # Reset

def search_with_scraperapi(search_query, api_key):
    try:
        print(f"{P}[*] ScraperAPI Booster (Volume=100):{R} {C}{search_query}{R}")
        proxy_url = f"http://api.scraperapi.com?api_key={api_key}&url={requests.utils.quote(f'https://www.google.com/search?q={search_query}&hl=vi&gl=vn&num=100')}&country_code=vn"
        response = requests.get(proxy_url, timeout=60)
        results = []
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            for g in soup.select('div.g'):
                link = g.select_one('a')
                title = g.select_one('h3')
                if link and title:
                    url = decode_bing_url(link.get('href'))
                    if url and url.startswith('http') and 'google.com' not in url:
                        verdict, score = classify_site_type(url, title.get_text())
                        if verdict != "REJECT":
                            results.append({'url': url, 'title': title.get_text(), 'verdict': verdict, 'score': score})
        return results
    except Exception as e:
        print(f"[!] ScraperAPI error: {e}")
        return []

def search_with_valueserp(search_query, api_key):
    try:
        print(f"{P}[*] ValueSERP Booster (Volume=100):{R} {C}{search_query}{R}")
        params = {'api_key': api_key, 'q': search_query, 'location': 'Vietnam', 'google_domain': 'google.com.vn', 'gl': 'vn', 'hl': 'vi', 'num': '100'}
        api_result = requests.get('https://api.valueserp.com/search', params)
        data = api_result.json()
        results = []
        if 'organic_results' in data:
            for r in data['organic_results']:
                url = r.get('link')
                title = r.get('title')
                if url:
                    verdict, score = classify_site_type(url, title)
                    if verdict != "REJECT":
                        results.append({'url': url, 'title': title, 'verdict': verdict, 'score': score})
        return results
    except Exception as e:
        print(f"[!] ValueSERP error: {e}")
        return []

def search_with_serpapi(search_query, api_key):
    """
    OMNITOOL-NOTE: Calling SerpApi with num=100 to get maximum value from 1 credit.
    Targeting Google Vietnam (google.com.vn, gl=vn, hl=vi).
    """
    try:
        print(f"{P}[*] SerpApi Booster (Volume=100):{R} {C}{search_query}{R}")
        params = {
            'api_key': api_key,
            'q': search_query,
            'location': 'Vietnam',
            'google_domain': 'google.com.vn',
            'gl': 'vn',
            'hl': 'vi',
            'num': 100
        }
        res = requests.get('https://serpapi.com/search', params=params, timeout=60)
        data = res.json()
        results = []
        if 'organic_results' in data:
            for r in data['organic_results']:
                url = r.get('link')
                title = r.get('title')
                if url:
                    verdict, score = classify_site_type(url, title)
                    if verdict != "REJECT":
                        results.append({'url': url, 'title': title, 'verdict': verdict, 'score': score})
        return results
    except Exception as e:
        print(f"[!] SerpApi error: {e}")
        return []

def search_with_google(search_query):
    results = []
    print(f"{P}[*] Pro Google Search (Hardened):{R} {C}{search_query}{R}")
    try:
        with managed_page() as page:
            google_url = f'https://www.google.com/search?q={requests.utils.quote(search_query)}&hl=vi&gl=vn&cr=countryVN&pws=0&num=50&tbs=lf:1,lf_ui:2'
            page.goto(google_url, timeout=45000, wait_until='domcontentloaded')
            
            HumanBehaviorSimulator.simulate_reading_scroll(page, total_scrolls=2)
            
            links = page.query_selector_all('div.g a, a[jsname="UWckNb"]')
            for link_el in links:
                try:
                    title_el = link_el.query_selector('h3') 
                    title = title_el.inner_text() if title_el else link_el.inner_text()
                    url = link_el.get_attribute('href')
                    if url and url.startswith('http') and 'google.com' not in url:
                        url = decode_bing_url(url)
                        res = classify_site_intent(url, title)
                        if res.intent != "REJECT":
                            results.append({
                                'url': url, 
                                'title': title, 
                                'verdict': "BUSINESS" if res.intent == "Bán hàng" else "INFORMATIONAL", 
                                'score': int(res.confidence * 100)
                            })
                except Exception:
                    continue
                if len(results) >= 40:
                    break
    except Exception as e:
        print(f"[!] Google error: {e}")
    return results

def decode_bing_url(url):
    """Giải mã URL redirect của Bing để lấy URL gốc."""
    import base64
    from urllib.parse import urlparse, parse_qs
    try:
        if 'bing.com/ck/a' in url:
            parsed = urlparse(url)
            u_param = parse_qs(parsed.query).get('u', [None])[0]
            if u_param:
                if u_param.startswith('a1'):
                    base64_str = u_param[2:]
                    missing_padding = len(base64_str) % 4
                    if missing_padding:
                        base64_str += '=' * (4 - missing_padding)
                    return base64.b64decode(base64_str).decode('utf-8')
    except Exception:
        pass
    return url

def search_with_bing_playwright(search_query):
    results = []
    print(f"{P}[*] Pro Bing Search (Pool):{R} {C}{search_query}{R}")
    try:
        with managed_page() as page:
            bing_url = f'https://www.bing.com/search?q={requests.utils.quote(search_query)}&setlang=vi&cc=VN&mkt=vi-VN&count=50'
            page.goto(bing_url, timeout=45000, wait_until='domcontentloaded')
            HumanBehaviorSimulator.simulate_reading_scroll(page, total_scrolls=2)
            links = page.query_selector_all('li.b_algo h2 a, li.b_ans h2 a')
            for a in links:
                url = a.get_attribute('href')
                title = a.inner_text()
                if url and url.startswith('http'):
                    url = decode_bing_url(url)
                    res = classify_site_intent(url, title)
                    if res.intent != "REJECT":
                        results.append({
                            'url': url, 
                            'title': title, 
                            'verdict': "BUSINESS" if res.intent == "Bán hàng" else "INFORMATIONAL", 
                            'score': int(res.confidence * 100)
                        })
                if len(results) >= 35:
                    break
    except Exception as e:
        print(f"[!] Bing error: {e}")
    return results

def search_with_duckduckgo(search_query):
    results = []
    print(f"{P}[*] Pro DDG Search (Pool):{R} {C}{search_query}{R}")
    try:
        with managed_page() as page:
            ddg_url = f'https://duckduckgo.com/?q={requests.utils.quote(search_query)}&kl=vn-vi&region=vn-vi'
            page.goto(ddg_url, timeout=45000, wait_until='domcontentloaded')
            HumanBehaviorSimulator.simulate_reading_scroll(page, total_scrolls=2)
            links = page.query_selector_all('[data-testid="result"] h2 a, div.result__body a.result__a')
            for a in links:
                url = a.get_attribute('href')
                title = a.inner_text()
                if url and url.startswith('http'):
                    res = classify_site_intent(url, title)
                    if res.intent != "REJECT":
                        results.append({
                            'url': url, 
                            'title': title, 
                            'verdict': "BUSINESS" if res.intent == "Bán hàng" else "INFORMATIONAL", 
                            'score': int(res.confidence * 100)
                        })
                if len(results) >= 30:
                    break
    except Exception as e:
        print(f"[!] DDG error: {e}")
    return results

def search_with_ddg_api(search_query):
    results = []
    try:
        print(f"{P}[*] DDG API Fallback:{R} {C}{search_query}{R}")
        with DDGS() as ddgs:
            for r in ddgs.text(search_query, region='vn-vi', max_results=30):
                url = r.get('href', '')
                title = r.get('title', '')
                if url and url.startswith('http'):
                    res = classify_site_intent(url, title)
                    if res.intent != "REJECT":
                        results.append({
                            'url': url, 
                            'title': title, 
                            'verdict': "BUSINESS" if res.intent == "Bán hàng" else "INFORMATIONAL", 
                            'score': int(res.confidence * 100)
                        })
    except Exception as e:
        print(f"[!] DDG API error: {e}")
    return results

def search_with_tiered_strategy(query, keys, mode='hybrid'):
    """
    Chiến lược tìm kiếm đa tầng với lọc theo Mode:
    - LEAD:    Ưu tiên Homepage + Landing Page (dịch vụ, bao giá...)
    - CONTENT: Ưu tiên Blog/Article (hướng dẫn, kiến thức...)
    - HYBRID:  Lấy tất cả, không giới hạn loại trang
    """
    results = []
    seen = set()

    # === QUERY HARDENING THEO MODE ===
    # OMNITOOL-NOTE: Với Smart Mode, gộp cả intent thương mại và thông tin để lấy kết quả vây bắt rộng.
    if mode == 'lead':
        hardened_query = f'{query} dịch vụ báo giá liên hệ'
    elif mode == 'content':
        hardened_query = f'{query} hướng dẫn kiến thức bài viết'
    elif mode == 'smart':
        # TRÍ TUỆ OMNITOOL: Sử dụng các từ khóa hạt nhân để vây bắt 4 Intent mà không làm loãng keyword gốc.
        hardened_query = f'{query} (dịch vụ OR báo giá OR hướng dẫn OR review)'
    else:  # hybrid
        hardened_query = query

    results.extend(search_with_google(hardened_query))
    results.extend(search_with_bing_playwright(hardened_query))
    results.extend(search_with_duckduckgo(hardened_query))

    if len(results) < 10:
        print(f"{P}[Tier Switch] Playwright weak ({len(results)} results), activating paid tier...{R}")
        val_key = keys.get('valueserp_api_key') or keys.get('valueserp_key')
        scr_key = keys.get('scraperapi_key')
        serp_key = keys.get('serpapi_key')

        # Priority: SerpApi -> ValueSERP -> ScraperAPI
        # SerpApi dùng hardened_query (đã được truyền từ caller nếu là consolidated)
        if serp_key:
            results.extend(search_with_serpapi(hardened_query, serp_key))
        if val_key and len(results) < 10:
            results.extend(search_with_valueserp(hardened_query, val_key))
        if scr_key and len(results) < 10:
            results.extend(search_with_scraperapi(hardened_query, scr_key))

    results.extend(search_with_ddg_api(hardened_query))

    final = []
    for r in results:
        url = r['url'].lower().rstrip('/')
        title = r.get('title', '')

        verdict, score = classify_site_type(url, title)
        if verdict == "REJECT":
            continue

        if url not in seen:
            seen.add(url)
            page_type = get_page_type(url)
            r['page_type'] = page_type
            r['score'] = score

            # === LỌC KẾT QUẢ THEO MODE ===
            if mode == 'lead':
                # Chỉ lấy Homepage và Landing Page, bỏ Blog/Article
                if page_type == 'Blog/Article':
                    continue
            elif mode == 'content':
                # Chỉ lấy Blog/Article, bỏ Homepage và Landing Page
                if page_type not in ('Blog/Article',):
                    continue
            # smart/hybrid: lấy tất cả các trang chất lượng
            
            final.append(r)

    return final

def build_consolidated_queries(keywords, max_tokens=28):
    """
    OMNITOOL-NOTE: Tách keywords thành các nhóm 2-3 từ để tránh bị Google cắt query.
    Sử dụng random.shuffle để trung hòa bias của Google (thiên vị từ đứng đầu).
    """
    groups = []
    current_group = []
    current_tokens = 0
    
    for kw in keywords:
        tokens = len(kw.split()) + 2
        if current_tokens + tokens > max_tokens and current_group:
            groups.append(current_group)
            current_group = [kw]
            current_tokens = tokens
        else:
            current_group.append(kw)
            current_tokens += tokens
            
    if current_group:
        groups.append(current_group)
        
    queries = []
    for g in groups:
        shuffled = g.copy()
        random.shuffle(shuffled)
        or_query = " OR ".join([f'"{k}"' for k in shuffled])
        queries.append(or_query)
        
    return queries
