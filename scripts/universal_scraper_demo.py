import sys
import json
import re
import requests
from bs4 import BeautifulSoup
from collections import Counter
from urllib.parse import quote_plus

class UniversalScraper:
    def __init__(self):
        self.exclude_list = {
            "CHÀO", "GIÁ", "SẢN PHẨM", "MUA", "BÁN", "LIÊN HỆ", "XEM", "CHI TIẾT", 
            "TRANG CHỦ", "GIỚI THIỆU", "DỊCH VỤ", "TIN TỨC", "CỬA HÀNG", "HOTLINE",
            "ĐỊA CHỈ", "MÔ TẢ", "TÌM KIẾM", "GIỎ HÀNG", "ĐĂNG NHẬP", "ĐĂNG KÝ",
            "VND", "VNĐ", "ĐỒNG", "GIÁ RẺ", "UY TÍN", "CHẤT LƯỢNG", "CAM KẾT"
        }
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        }

    def google_search_free(self, query):
        """Cào Google SERP miễn phí 0$ để lấy Top 10 và Related Searches"""
        try:
            url = f"https://www.google.com/search?q={quote_plus(query)}&hl=vi"
            resp = requests.get(url, headers=self.headers, timeout=10)
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            # 1. Trích xuất Top 10 Ranking
            results = []
            for g in soup.find_all('div', class_='g'):
                anchors = g.find_all('a', href=True)
                if anchors:
                    link = anchors[0]['href']
                    title_tag = g.find('h3')
                    if title_tag and link.startswith('http'):
                        results.append({
                            "title": title_tag.get_text(),
                            "link": link,
                            "snippet": g.get_text(separator=' ', strip=True)[:160]
                        })
            
            # 2. Trích xuất Related Searches (Keyword Keg)
            related = []
            for r in soup.find_all(['div', 'a'], string=re.compile(r'.*', re.I)):
                # Tìm các khối chứa từ khóa liên quan (Google thường dùng div có text cụ thể)
                # Dùng thuộc tính data-u hoặc tìm trong các thẻ cụ thể
                pass
            # Cách đơn giản: Tìm các thẻ <a> trong khu vực liên quan
            for a in soup.select('div.BNeawe.de9bc.ap7nd a'):
                related.append(a.get_text())
            if not related:
                for b in soup.find_all('div', class_='s75ceu'):
                    related.append(b.get_text())

            return results[:10], list(set(related))
        except Exception:
            return [], []

    def analyze_url(self, url):
        """Phân tích trang chuẩn SEO - Tối ưu 0$"""
        try:
            if not url.startswith('http'): url = 'https://' + url
            resp = requests.get(url, headers=self.headers, timeout=10)
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            title = soup.title.string.strip() if soup.title else ""
            meta_desc = ""
            meta = soup.find("meta", attrs={"name": "description"})
            if meta: meta_desc = meta.get("content", "").strip()
            
            text_content = soup.get_text(separator=' ')
            words = re.findall(r'\w+', text_content.lower())
            
            # Extract SEO Entities with Frequency
            emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text_content)
            phones = re.findall(r'(?:(?:\+|0)84|0)(?:3|5|7|8|9|2)\d{8,9}', text_content)
            specs = re.findall(r'\d+(?:\.\d+)?\s*(?:kg|%|cm|m|mm|ml|l|km|vnđ|vnd|đ|k|tr|px)', text_content, re.IGNORECASE)
            
            brands = [b.upper() for b in re.findall(r'\b[A-Z][A-Z0-9\.]+\b', text_content) if b.upper() not in self.exclude_list and len(b) > 2]
            
            def format_ents(items):
                cnt = Counter(items)
                return [{"name": k, "count": v} for k, v in cnt.most_common(12)]

            return {
                "url": url,
                "title": title,
                "description": meta_desc,
                "word_count": len(words),
                "entities_v2": {
                    "brands": format_ents(brands),
                    "contacts": format_ents(emails + phones),
                    "specs": format_ents(specs)
                },
                "density": {
                    "bigrams": self.get_ngrams(words, 2),
                    "trigrams": self.get_ngrams(words, 3)
                },
                "headings": {
                    "h1": [h.get_text().strip() for h in soup.find_all('h1')],
                    "h2": [h.get_text().strip() for h in soup.find_all('h2')],
                    "h3": [h.get_text().strip() for h in soup.find_all('h3')]
                }
            }
        except Exception as e:
            return {"error": str(e)}

    def get_ngrams(self, words, n):
        grams = [" ".join(words[i:i+n]) for i in range(len(words)-n+1) if len(words[i]) > 3]
        cnt = Counter(grams)
        total = sum(cnt.values()) or 1
        return [{"word": k, "count": v, "percentage": round((v/total)*100, 2)} for k, v in cnt.most_common(12)]

    def compare_competitors(self, url1, url2):
        """Logic: The Competitor Killer - Tim Gap giua 2 doi thu"""
        data1 = self.analyze_url(url1)
        data2 = self.analyze_url(url2)
        
        if "error" in data1 or "error" in data2:
            return {"error": "Lỗi khi phân tích một trong hai tên miền."}

        # Lay danh sach keyword tu trigrams (Mật độ cao)
        kw1 = {item['word'] for item in data1['density']['trigrams']}
        kw2 = {item['word'] for item in data2['density']['trigrams']}
        
        return {
            "side_a": data1,
            "side_b": data2,
            "gap_analysis": {
                "unique_a": list(kw1 - kw2),
                "unique_b": list(kw2 - kw1),
                "common": list(kw1 & kw2)
            }
        }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments"}))
        sys.exit(1)

    mode = sys.argv[1].strip('"')
    input_val = sys.argv[2].strip('"')
    scraper = UniversalScraper()

    if mode == "analyze":
        print(json.dumps(scraper.analyze_url(input_val)))
    elif mode == "serp":
        results, related = scraper.google_search_free(input_val)
        print(json.dumps(results)) # Frontend expects a list for SERP
    elif mode == "keyword_full":
        # Killer Feature Link: Keyword -> SERP Top 10 + Related
        results, related = scraper.google_search_free(input_val)
        print(json.dumps({"results": results, "related": related}))
    elif mode == "gap":
        # Competitor Gap: URL1,URL2
        urls = input_val.split(',')
        if len(urls) < 2:
            print(json.dumps({"error": "Cần 2 URL để so sánh đối thủ."}))
        else:
            print(json.dumps(scraper.compare_competitors(urls[0], urls[1])))
    elif mode == "bulk":
        # Simplified Bulk
        keywords = input_val.split(',')
        final = []
        for kw in keywords:
            final.append({"keyword": kw, "traffic": 0, "difficulty": 0, "allintitle": 0, "priority": "Medium"})
        print(json.dumps(final))
    else:
        print(json.dumps({"error": "Invalid mode"}))
