import { NextResponse } from 'next/server';
import { getInterpreterUrl } from '@/shared/lib/interpreter-url';

// Domains to block (domain-level check)
const FORBIDDEN = [
  'facebook.com', 'shopee.vn', 'wikipedia.org', 'wiktionary.org',
  'zhihu.com', 'quora.com', 'reddit.com', 'medium.com', 'stackoverflow.com',
  'baidu.com', 'weibo.com', 'clutch.co', 'g2.com', 'pinterest.com',
  'baomoi.com', 'kenh14.vn', 'zingnews.vn', 'translate.google', 'bing.com/translator',
  'dictionary.com', 'oxfordlearnersdictionaries.com', 'cambridge.org',
  'vov.vn', 'tinhte.vn', 'lazada.vn', 'tiki.vn', 'sendo.vn', 'alibaba.com',
  'aliexpress.com', 'vatgia.com', 'muaban.net', 'careerbuilder.vn',
  'vnexpress.net', 'dantri.com.vn', 'vietnamnet.vn', 'thanhnien.vn', 'tuoitre.vn',
  'laodong.vn', 'doisongphapluat.com', 'nguoiduatin.vn', '24h.com.vn', 'eva.vn'
];

const LANDING_PAGE_PATTERNS = /\/(dich-vu|service|bao-gia|pricing|lien-he|contact|goi-dich-vu|giai-phap|solution|san-pham|product|ve-chung-toi|about|portfolio|du-an|khach-hang|thiet-ke-web|seo|marketing)(\/|$)/i;
const BLOG_PATTERNS = /\/(blog|tin-tuc|news|bai-viet|kien-thuc|huong-dan|tips|chia-se|chuyen-muc|category|tag|p=\d+|post\/|posts\/|\d{4}\/\d{2}\/\d{2})/i;



export async function POST(req: Request) {
  try {
    const { keywords, keys, mode }: { keywords: string[], keys?: any, mode?: string } = await req.json();

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'Keywords must be a non-empty array' }, { status: 400 });
    }

    const selectedKeywords = keywords.slice(0, 5);

    // --- Gọi Python Backend (duckduckgo_search + AI Filter) ---
    try {
      console.log(`[Search API] Calling Python DDGS for: ${selectedKeywords.join(', ')} with mode: ${mode}`);
      const pyRes = await fetch(`${getInterpreterUrl()}/api/search/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: selectedKeywords, keys, mode }),
        signal: AbortSignal.timeout(120000), // Tăng timeout cho tìm kiếm đa nền tảng (Google, Bing, DDG)
      });

      if (pyRes.ok) {
        const data = await pyRes.json();
        if (data.urls && data.urls.length > 0) {
          console.log(`[Search API] Python backend returned ${data.urls.length} URLs.`);
          return NextResponse.json({ 
            urls: data.urls,
            analysis: data.analysis || {} 
          });
        }
      }

      const errText = await pyRes.text().catch(() => 'unknown');
      console.warn(`[Search API] Python backend returned non-OK: ${pyRes.status} - ${errText}`);
    } catch (pyErr: any) {
      console.warn(`[Search API] Python backend unreachable: ${pyErr.message}`);
    }

  // Helper: check if a URL should be filtered out
  const isUrlBlocked = (url: string, searchMode?: string): boolean => {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace('www.', '').toLowerCase();
      const path = parsed.pathname.toLowerCase();

      // Geofencing
      if (hostname.endsWith('.cn') || hostname.endsWith('.zh')) return true;

      // Forbidden giants
      if (FORBIDDEN.some(f => hostname.includes(f))) return true;
      
      // Intent Filtering
      const isLanding = LANDING_PAGE_PATTERNS.test(path) || path === '/' || path === '';
      const isBlog = BLOG_PATTERNS.test(path);

      if (searchMode === 'lead' && isBlog) return true;
      if (searchMode === 'content' && !isBlog && !isLanding) return true;
      // smart: no additional filter, just forbidden giants

      return false;
    } catch (e) { return true; }
  };

  // --- Fallback: Bing scraping bằng Cheerio ---
  console.log('[Search API] Falling back to Bing...');
  const decodeBingUrl = (url: string) => {
    try {
      if (url.includes('bing.com/ck/a')) {
        const urlObj = new URL(url);
        const u = urlObj.searchParams.get('u');
        if (u) {
          const base64 = u.substring(2);
          return Buffer.from(base64, 'base64').toString('utf-8');
        }
      }
    } catch (e) {}
    return url;
  };

  const cheerio = await import('cheerio');
  const results: string[] = [];
  const seenUrls = new Set<string>();
  const seenDomains = new Set<string>();

  // Search Bing for all keywords in parallel
  const searchBing = async (keyword: string): Promise<string[]> => {
    const found: string[] = [];
    try {
      const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(keyword)}&setlang=vi&count=30`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
        },
      });
      const html = await res.text();
      const $ = cheerio.load(html);
      $('li.b_algo h2 a, li.b_ans h2 a, .b_algo h2 a').each((_, el) => {
        let rawUrl = $(el).attr('href');
        if (rawUrl) {
          const decodedUrl = decodeBingUrl(rawUrl);
          if (decodedUrl && decodedUrl.startsWith('http') && !isUrlBlocked(decodedUrl, mode) && !seenUrls.has(decodedUrl)) {
            const domain = new URL(decodedUrl).hostname;
            const domainCount = Array.from(seenUrls).filter(u => u.includes(domain)).length;
            if (domainCount < 2) {
              seenUrls.add(decodedUrl);
              found.push(decodedUrl);
            }
          }
        }
      });
    } catch (bingErr) {
      console.error(`[Search API] Bing error for "${keyword}":`, bingErr);
    }
    return found;
  };

  // Run Bing searches in parallel for all keywords
  const bingResults = await Promise.all(selectedKeywords.map(kw => searchBing(kw)));
  results.push(...bingResults.flat());

  // De-duplicate
  const uniqueResults = [...new Set(results)];



  if (uniqueResults.length > 0) {
    return NextResponse.json({ urls: uniqueResults.slice(0, 50) });
  }

  return NextResponse.json({ error: 'Không tìm thấy kết quả phù hợp. Hãy thử từ khóa khác.' }, { status: 404 });

  } catch (error: any) {
    console.error('[Search API] Fatal error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
