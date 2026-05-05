import sys
import io
import json
import asyncio
import random

# Force UTF-8 encoding for stdout on Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import re
import requests
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

# Define Authority Domains (Vietnam Context)
AUTHORITY_DOMAINS = [
    'shopee.vn', 'lazada.vn', 'tiki.vn', 'facebook.com', 'youtube.com', 
    'tiktok.com', 'vnexpress.net', 'dantri.com.vn', 'tuoitre.vn', 
    'wikipedia.org', 'kenh14.vn', 'zingnews.vn', 'vietnamnet.vn', 'thanhnien.vn',
    'baomoi.com', 'genk.vn', 'ictnews.vietnamnet.vn'
]

class GoogleScraper:
    def __init__(self, keyword):
        self.keyword = keyword
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
        ]

    async def get_long_tail_suggestions(self):
        """Fetch from Google Autocomplete XML API"""
        url = f"http://google.com/complete/search?output=toolbar&q={quote_plus(self.keyword)}"
        try:
            # Use requests for simple XML fetch
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                root = ET.fromstring(response.content)
                suggestions = [child.attrib['data'] for child in root.findall('.//suggestion')]
                return suggestions[:10]
        except Exception:
            return []
        return []

    async def scrape(self):
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent=random.choice(self.user_agents))
            page = await context.new_page()

            # --- 1. Step 1: Regular Search ---
            search_url = f"https://www.google.com/search?q={quote_plus(self.keyword)}&hl=vi"
            await page.goto(search_url)
            await asyncio.sleep(random.uniform(2, 4))
            
            content = await page.content()
            soup = BeautifulSoup(content, 'html.parser')

            # Extract Total Results (e.g. "Khoảng 1.200.000 kết quả (0,50 giây)")
            total_results_str = "0"
            result_stats = soup.select_one('#result-stats')
            if result_stats:
                text = result_stats.text.replace('\xa0', ' ')
                match = re.search(r'([0-9.,\s]+)', text)
                if match:
                    total_results_str = match.group(1).replace('.', '').replace(',', '').strip().replace(' ', '')

            # Related Keywords
            related_keywords = []
            # Selector for mobile/desktop related searches
            rel_items = soup.find_all('div', string=re.compile('Tìm kiếm liên quan|Các tìm kiếm liên quan'))
            if rel_items:
                parent = rel_items[0].parent
                links = parent.find_all('a')
                for l in links:
                    txt = l.text.strip()
                    if txt: related_keywords.append(txt)

            # Extract PAA (People Also Ask)
            paa_questions = []
            paa_containers = soup.select('div[data-q]')
            for item in paa_containers:
                paa_questions.append(item.text.strip())

            # Top 10 Analysis
            top_10 = []
            # Main result containers
            results_containers = soup.select('div.g')
            for i, res in enumerate(results_containers[:10]):
                link_tag = res.select_one('a')
                if not link_tag: continue
                link = link_tag['href']
                title_tag = res.select_one('h3')
                title = title_tag.text if title_tag else "N/A"
                
                domain = link.split('/')[2] if '://' in link else "N/A"
                is_authority = any(auth in domain for auth in AUTHORITY_DOMAINS)
                on_page = self.keyword.lower() in title.lower() or self.keyword.lower() in link.lower()

                top_10.append({
                    "rank": i + 1,
                    "domain": domain,
                    "is_authority": is_authority,
                    "on_page_optimized": on_page
                })

            # --- 2. Step 2: Allintitle Search ---
            allintitle_url = f"https://www.google.com/search?q=allintitle:%22{quote_plus(self.keyword)}%22&hl=vi"
            await page.goto(allintitle_url)
            await asyncio.sleep(random.uniform(2, 4))
            
            content_all = await page.content()
            soup_all = BeautifulSoup(content_all, 'html.parser')
            
            allintitle_count = 0
            all_result_stats = soup_all.select_one('#result-stats')
            if all_result_stats:
                text = all_result_stats.text.replace('\xa0', ' ')
                match = re.search(r'([0-9.,\s]+)', text)
                if match:
                    allintitle_count = int(match.group(1).replace('.', '').replace(',', '').strip().replace(' ', ''))
            else:
                # If no stats, check for actual results count
                results_all = soup_all.select('div.g')
                allintitle_count = len(results_all)

            await browser.close()

            # Autocomplete
            long_tail = await self.get_long_tail_suggestions()

            return {
                "total_results": total_results_str,
                "allintitle_count": allintitle_count,
                "related_keywords": related_keywords,
                "people_also_ask": paa_questions,
                "long_tail_suggestions": long_tail,
                "top_10": top_10
            }

class SEOAnalyzer:
    @staticmethod
    def analyze(data, keyword):
        try:
            total = int(data['total_results']) if data['total_results'] and data['total_results'].isdigit() else 1000
        except:
            total = 1000
            
        allintitle = data['allintitle_count']
        
        # 1. Saturation Rate (Density)
        saturation = (allintitle / total * 100) if total > 0 else 0
        saturation_str = "{:.4f}%".format(saturation) if saturation < 1 else "{:.2f}%".format(saturation)

        # 2. Top 10 Analysis
        authority_count = sum(1 for item in data['top_10'] if item['is_authority'])
        
        # 3. KD CALCULATION Logic:
        # KD = (40% Allintitle) + (30% Top 10 Authority) + (30% Content Saturation)
        
        # KD Allintitle (Log scale or capped linear)
        # We assume 1000+ allintitle is hard. We map 0-1000 to 0-100 score.
        score_allintitle = min(allintitle / 10, 100)
        
        # KD Authority (Capped at 6 high authority domains)
        score_authority = min(authority_count * 16.6, 100)
        
        # KD Saturation (if allintitle/total ratio is > 0.1%, it gets harder)
        # Map 0% - 0.5% to 0 - 100 score.
        score_saturation = min(saturation * 200, 100)
        
        kd_score = (0.4 * score_allintitle) + (0.3 * score_authority) + (0.3 * score_saturation)
        
        # Spec rule: If allintitle > 1000 and > 5 authority sites => KD > 80
        if allintitle > 1000 and authority_count > 5:
            kd_score = max(kd_score, 85)
            
        # Determine Level and Color
        level = "Dễ"
        color = "#22c55e" # emerald-500
        if kd_score > 70:
            level = "Cực khó"
            color = "#f43f5e" # rose-500
        elif kd_score > 50:
            level = "Khó"
            color = "#ef4444" # red-500
        elif kd_score > 30:
            level = "Trung bình"
            color = "#f59e0b" # amber-500
            
        return {
            "keyword_stats": {
                "total_results": "{:,}".format(total).replace(',', '.'),
                "competitor_articles": "{:,}".format(allintitle).replace(',', '.'),
                "saturation_rate": saturation_str,
                "kd_score": int(kd_score),
                "level": level,
                "color": color
            },
            "related_data": {
                "related_keywords": data['related_keywords'][:8],
                "people_also_ask": data['people_also_ask'][:5],
                "long_tail_suggestions": data['long_tail_suggestions'][:10]
            },
            "top_10_analysis": data['top_10']
        }

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Keyword is required"}))
        return

    keyword = sys.argv[1]
    scraper = GoogleScraper(keyword)
    try:
        raw_data = await scraper.scrape()
        # Ensure we have at least empty results to avoid analysis crash
        if not raw_data:
             print(json.dumps({"error": "No data scraped"}))
             return
        result = SEOAnalyzer.analyze(raw_data, keyword)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
