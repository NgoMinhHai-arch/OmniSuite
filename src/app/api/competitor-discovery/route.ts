import { NextRequest, NextResponse } from 'next/server';
import { chromium, Browser } from 'playwright';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { generateText } from 'ai';
import { getAIModel } from '@/shared/lib/ai-provider';

async function aiFilterCompetitors(
  competitors: any[], 
  keyword: string, 
  provider: string, 
  apiKey: string, 
  modelName: string
) {
  if (!apiKey || !competitors.length) return competitors.map(c => ({ ...c, aiReason: 'No AI filtering applied.' }));

  try {
    const model = getAIModel(provider, apiKey, modelName);
    const prompt = `You are a RUTHLESS Competitive Intelligence Filter. Your ONE job is to protect the integrity of a competitor analysis dataset. You have ZERO tolerance for false positives.

CORE MENTAL MODEL:
A "competitor" is defined as: an entity that directly SELLS a service or product to end customers in exchange for money, and competes for the same customer wallet as the business being analyzed.

THE BINARY TEST:
Ask yourself: "Does this website's PRIMARY business model involve a HUMAN TEAM delivering a service or a physical/digital product TO clients?" 
If YES → candidate for KEEPING.
If NO, or even UNCERTAIN → EXCLUDE IMMEDIATELY. No second chances.

MANDATORY EXCLUSION CATEGORIES:
Category 1 — TOOLS & PLATFORMS: SaaS, Design Tools, App, Software Licenses (e.g., Canva, Adobe, Wix, Shopify).
Category 2 — AGGREGATORS & DIRECTORIES: Review platforms, business listings, job boards, "top 10" lists.
Category 3 — MEDIA & INFORMATIONAL: Blogs, news, YouTube, Wikipedia, educational sites.
Category 4 — SOCIAL & COMMUNITY: Facebook, Pinterest, Reddit, etc.
Category 5 — DOUBT CASES: If you are even 10% uncertain — EXCLUDE IT.

KEEP ONLY: Verifiable Agencies, Studios, or Consultants whose website primary purpose is "Hire us / Buy from us".

TARGET KEYWORD: "${keyword}"

DANH SÁCH CẦN LỌC:
${competitors.map((c, i) => `${i+1}. Tiêu đề: ${c.title} | URL: ${c.url}`).join('\n')}

OUTPUT FORMAT (JSON ONLY):
[{"id": <number>, "verdict": "KEEP" | "EXCLUDE", "reason": "<one concise sentence in Vietnamese explaining the classification decision>"}]`;

    const { text } = await generateText({ model, prompt });
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const aiResults = JSON.parse(match[0]);
      return competitors
        .map((c, i) => {
          const aiMatch = aiResults.find((r: any) => r.id === i + 1);
          if (aiMatch && aiMatch.verdict === 'KEEP') {
            return { ...c, aiReason: aiMatch.reason };
          }
          return null;
        })
        .filter(Boolean);
    }
  } catch (e) {
    console.warn('AI Filtering failed:', e);
  }
  return competitors.map(c => ({ ...c, aiReason: 'AI lọc lỗi hoặc không phản hồi.' }));
}

async function searchWithSerpApi(keyword: string, apiKey: string) {
  try {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(keyword)}&api_key=${apiKey}&hl=vi&gl=vn`;
    const response = await axios.get(url, { timeout: 10000 });
    const organicResults = response.data.organic_results || [];

    return organicResults.map((item: any) => ({
      title: item.title || '',
      url: item.link || '',
      description: item.snippet || ''
    }))
    .filter((c: any) => {
      if (!c.title || !c.url || isBlacklisted(c.url)) return false;
      return calculateRelevance(c.title, c.description, keyword);
    })
    .slice(0, 10);
  } catch (error: any) {
    console.error('SerpAPI Error:', error.message);
    throw new Error(`SerpAPI Error: ${error.message}`);
  }
}


function calculateRelevance(title: string, description: string, keyword: string): boolean {
  const t = (title + ' ' + description).toLowerCase();
  const k = keyword.toLowerCase();
  
  // Rule 1: Exact phrase match (High relevance)
  if (t.includes(k)) return true;
  
  // Rule 2: Multi-word majority match (at least 70% of parts)
  // For Vietnamese, many important words are 2 characters long (e.g., 'kế', 'nha', 'đồ')
  const parts = k.split(/\s+/).filter(p => p.length >= 2);

  if (parts.length === 0) return true;
  
  const matches = parts.filter(p => t.includes(p)).length;
  const matchRatio = matches / parts.length;
  
  // Rule 3: Anti-Informational Filter (if keyword is commercial)
  const isRecipeTerm = /cách làm|hướng dẫn|công thức|bí quyết|kinh nghiệm|vao-bep|chia-se/.test(t);
  const userWantsRecipe = /cách làm|hướng dẫn|công thức/.test(k);
  
  if (isRecipeTerm && !userWantsRecipe) return false;
  
  return matchRatio >= 0.7; // Strict threshold
}

const BLACKLIST_DOMAINS = [
  'facebook.com', 'youtube.com', 'linkedin.com', 'twitter.com', 'pinterest.com', 'instagram.com', 'tiktok.com',
  'shopee.vn', 'tiki.vn', 'lazada.vn', 'sendo.vn', 'shopeefood.vn',
  'tinhte.vn', 'kenh14.vn', 'zingnews.vn', 'thanhnien.vn', 'tuoitre.vn', 'vnexpress.net',
  'wikipedia.org', 'wiktionary.org', 'thivien.net', 'soha.vn', 'rung.vn', 'vdict.com', 'tudien.net',
  'kqxs.vn', 'xoso.com.vn', 'minhngoc.net.vn', 'vov.vn', 'baomoi.com',
  'wordpress.com', 'blogspot.com', 'medium.com', 'beibei.vn', 'baomoi.com',
  'vovan-kienthuc.com', 'vovankienthuc.com', 'vovoakienthuc.com', 'google.com', 'translate.google.com',
  'canva.com', 'adobe.com', 'figma.com', 'wix.com', 'shopify.com', 'topcv.vn', 'vietnamworks.com'
];


function isBlacklisted(url: string) {
  try {
    const domain = new URL(url).hostname.replace('www.', '').toLowerCase();
    return BLACKLIST_DOMAINS.some(b => domain.includes(b));
  } catch (e) {
    return false;
  }
}

function isAdLink(url: string) {
  const adPatterns = ['googleadservices.com', 'doubleclick.net', 'ad.doubleclick', '/aclk', 'bing.com/aclick', 'google.com/aclk', 'taboola.com', 'outbrain.com'];
  return adPatterns.some(p => url.includes(p));
}

async function searchWithDuckDuckGo(keyword: string, browser: Browser) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  try {
    await page.goto('https://duckduckgo.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#search_form_input_homepage', { timeout: 10000 });
    await page.type('#search_form_input_homepage', keyword, { delay: 100 });
    await page.press('#search_form_input_homepage', 'Enter');
    
    await page.waitForSelector('div.result, article', { timeout: 15000 });

    const competitors = await page.$$eval('div.result, article', (elements) => {
      return elements.map(el => {
        const a = el.querySelector('a[data-testid="result-title-a"], a.result__a') as HTMLAnchorElement;
        const descEl = el.querySelector('div[data-testid="result-snippet"], a.result__snippet');
        const title = a ? a.innerText.trim() : '';
        const url = a ? a.href : '';
        const description = descEl ? descEl.textContent?.trim() : '';
        return { title, url, description };
      });
    });

    return competitors
      .filter(c => {
        if (!c.title || !c.url || isBlacklisted(c.url) || isAdLink(c.url)) return false;
        return calculateRelevance(c.title, c.description, keyword);
      })
      .slice(0, 10);
  } finally {
    await page.close();
    await context.close();
  }
}

async function searchWithBing(keyword: string, browser: Browser) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'vi-VN'
  });
  const page = await context.newPage();
  
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(keyword)}&setlang=vi`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    
    await page.waitForTimeout(2000 + Math.random() * 2000);

    try {
      await page.waitForSelector('#b_results', { timeout: 15000 });
    } catch (e) {
      const content = await page.content();
      if (content.includes('Verify that you are a human') || content.includes('mCaptcha')) {
        throw new Error('Bing yêu cầu xác minh robot. Vui lòng thử lại sau hoặc chuyển sang DuckDuckGo.');
      }
      throw new Error('Không thể tìm thấy kết quả trên Bing (Timeout).');
    }

    const competitors = await page.$$eval('#b_results li.b_algo', (elements) => {
      return elements.map(el => {
        const a = el.querySelector('h2 a') as HTMLAnchorElement;
        const cite = el.querySelector('cite');
        const descEl = el.querySelector('.b_caption p, .b_algo_snippet');
        
        let title = a ? (a.innerText || a.textContent || '').trim() : '';
        let url = a ? a.href : '';
        const description = descEl ? descEl.textContent?.trim() : '';

        if (url.includes('bing.com/ck/a') || !url.startsWith('http')) {
          if (cite) {
            let cleanCite = cite.textContent?.trim() || '';
            if (cleanCite) {
              cleanCite = cleanCite.split(' ')[0];
              if (!cleanCite.startsWith('http')) {
                url = 'https://' + cleanCite;
              } else {
                url = cleanCite;
              }
            }
          }
        }

        return { title, url, description };
      });
    });

    return competitors
      .filter(c => c.title && c.url && !c.url.includes('bing.com/ck/a') && !isBlacklisted(c.url) && !isAdLink(c.url))
      .slice(0, 10);
  } finally {
    await page.close();
    await context.close();
  }
}

async function getSitemapUrls(domain: string) {
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
  const sitemapPaths = [
    `https://${cleanDomain}/sitemap.xml`,
    `https://${cleanDomain}/sitemap_index.xml`,
    `https://${cleanDomain}/post-sitemap.xml`,
    `https://${cleanDomain}/blogs/tin-tuc.xml`,
    `https://${cleanDomain}/sitemap_products_1.xml`
  ];
  
  const results: any[] = [];
  const seen = new Set();

  const fetchSitemap = async (url: string, depth = 0): Promise<string[]> => {
    if (depth > 2) return [];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return [];
      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      
      const locs = $('loc').map((i, el) => $(el).text()).get();
      const blogLocs = locs.filter(l => /[\/\?](blog|tin-tuc|article|bai-viet|blogs)\//.test(l));
      
      // If index, recurse into sub-sitemaps
      const subSitemaps = $('sitemap loc').map((i, el) => $(el).text()).get();
      if (subSitemaps.length > 0) {
        const subTasks = subSitemaps.map(s => fetchSitemap(s, depth + 1));
        const subResults = await Promise.all(subTasks);
        blogLocs.push(...subResults.flat());
      }
      
      return blogLocs;
    } catch { return []; }
  };

  const initialTasks = sitemapPaths.map(url => fetchSitemap(url));
  const allFound = await Promise.all(initialTasks);
  const flattened = allFound.flat();

  for (const url of flattened) {
    if (!seen.has(url)) {
      results.push({ title: 'Blog Post', url, description: 'Từ Deep Sitemap' });
      seen.add(url);
    }
  }
  return results;
}

async function crawlBlogCategory(domain: string, browser: Browser) {
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
  const categoryUrls = [
    `https://${cleanDomain}/blogs/tin-tuc`,
    `https://${cleanDomain}/blogs/all`,
    `https://${cleanDomain}/tin-tuc`,
    `https://${cleanDomain}/blog`
  ];

  const allPosts: any[] = [];
  const seen = new Set();
  const context = await browser.newContext();

  try {
    // Parallel category crawling using multiple pages
    const scrapeTasks = categoryUrls.map(async (catUrl) => {
      const page = await context.newPage();
      try {
        await page.goto(catUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
        const links = await page.$$eval('a', (elements) => {
          return elements.map(el => ({ href: (el as HTMLAnchorElement).href, text: el.innerText.trim() }));
        });
        return links;
      } catch {
        return [];
      } finally {
        await page.close();
      }
    });

    const allPagesLinks = await Promise.all(scrapeTasks);
    for (const links of allPagesLinks) {
      for (const link of links) {
        const isBlog = link.href.includes('/blogs/tin-tuc/') || link.href.includes('/blogs/all/') || (link.href.startsWith(`https://${cleanDomain}`) && (link.href.includes('/blog/') || link.href.includes('/tin-tuc/')));
        if (isBlog && !seen.has(link.href)) {
          allPosts.push({ title: link.text || 'Blog Post', url: link.href, description: 'Từ Category' });
          seen.add(link.href);
        }
      }
    }
  } finally {
    await context.close();
  }
  return allPosts;
}

async function findBlogsOnDomain(domain: string, keyword: string, browser: Browser, engine: string, maxPosts: number = 50) {
  // PRIORITY 1: SITEMAP (API FREE & FAST)
  const sitemapResults = await getSitemapUrls(domain);
  if (sitemapResults.length > 5) return sitemapResults.slice(0, maxPosts);

  // PRIORITY 2: CATEGORY CRAWLING (API FREE)
  const crawlResults = await crawlBlogCategory(domain, browser);
  if (crawlResults.length > 5) return crawlResults.slice(0, maxPosts);

  // PRIORITY 3: SEARCH ENGINE (FALLBACK)
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
  const patterns = [
    `site:${cleanDomain} "${keyword}"`,
    `site:${cleanDomain}/blog "${keyword}"`,
    `site:${cleanDomain}/tin-tuc "${keyword}"`
  ];
  
  const allResults: any[] = [];
  const seen = new Set();

  for (const query of patterns) {
    try {
      const results = engine === 'bing' 
        ? await searchWithBing(query, browser) 
        : await searchWithDuckDuckGo(query, browser);
      
      for (const res of results) {
        const isJunk = /[\/\?](tag|category|author|page|tim-kiem|search)\b|#/.test(res.url);
        if (!seen.has(res.url) && !isJunk) {
          allResults.push(res);
          seen.add(res.url);
        }
      }
      if (allResults.length >= 10) break;
    } catch (e) {
      continue;
    }
  }
  
  return allResults;
}

export async function POST(req: NextRequest) {
  const { 
    keyword, 
    url, 
    engine = 'duckduckgo', 
    isRecursive = false, 
    serpApiKey = '',
    aiSettings = null,
    useAiFilter = true,
    maxPosts = 50,
    discoveryLimit = 10
  } = await req.json();

  if (!keyword && !url) {
    return NextResponse.json({ error: 'Vui lòng cung cấp Từ khóa hoặc URL.' }, { status: 400 });
  }
 
  let finalKeyword = keyword;
  let currentEngine = engine;
  let useSerpApi = !!serpApiKey;

  // ... (URL parsing logic remains same)
  if (url) {
    try {
      const urlResponse = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' } });
      const html = await urlResponse.text();
      const $ = cheerio.load(html);
      
      const h1 = $('h1').first().text().trim();
      const title = $('title').text().trim();
      const ogTitle = $('meta[property="og:title"]').attr('content');
      
      finalKeyword = h1 || ogTitle || title.split('|')[0].split('-')[0].trim();
      
      finalKeyword = finalKeyword
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[\[\]\(\)\{\}\*\|]/g, ' ')
        .trim();

      if (!finalKeyword || finalKeyword.length < 2) {
        finalKeyword = title.split(/[|\-]/)[0].trim();
      }

      if (!finalKeyword) {
        return NextResponse.json({ error: 'Không thể tự động xác định từ khóa từ URL này.' }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json({ error: 'Không thể truy cập hoặc phân tích URL.' }, { status: 500 });
    }
  }

  try {
    let competitors: { title: string; url: string; description: string }[] = [];
    let browser: Browser | null = null;
    
    // Helper to ensure we have a browser instance
    const getBrowser = async () => {
      if (browser) return browser;
      browser = await chromium.launch({ 
        headless: true, 
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--no-setuid-sandbox'] 
      });
      return browser;
    };

    try {
      // STEP 1: INITIAL DISCOVERY
      if (useSerpApi) {
        try {
          competitors = await searchWithSerpApi(finalKeyword, serpApiKey);
          currentEngine = 'serpapi';
        } catch (err: any) { useSerpApi = false; }
      }

      if (!useSerpApi) {
        const b = await getBrowser();
        try {
          competitors = currentEngine === 'bing' 
            ? await searchWithBing(finalKeyword, b) 
            : await searchWithDuckDuckGo(finalKeyword, b);
        } catch (err) {
          const fallback = currentEngine === 'bing' ? 'duckduckgo' : 'bing';
          competitors = fallback === 'bing' ? await searchWithBing(finalKeyword, b) : await searchWithDuckDuckGo(finalKeyword, b);
          currentEngine = fallback;
        }
      }

      if (competitors.length === 0) throw new Error('Không tìm thấy đối thủ nào phù hợp.');
      
      // Limit homepages before scan
      competitors = competitors.slice(0, Math.min(discoveryLimit, 20));

      // STEP 1.5: AI FILTERING
      if (useAiFilter && aiSettings?.apiKey) {
        const filtered = await aiFilterCompetitors(competitors, finalKeyword, aiSettings.provider, aiSettings.apiKey, aiSettings.model);
        if (filtered.length > 0) competitors = filtered;
      }

      // STEP 2: RECURSIVE BLOG SCAN (Balanced Approach)
      if (isRecursive) {
        const b = await getBrowser();
        const seen = new Set();
        
        // For each top competitor separately to ensure they are all represented
        const finalResults = [];
        for (const rootComp of competitors) {
          try {
            const blogs = await findBlogsOnDomain(rootComp.url, finalKeyword, b, 'duckduckgo', maxPosts);
            
            // Clean and limit blogs for THIS specific domain
            const cleanBlogs = blogs
              .filter(blog => {
                const isJunk = /[\/\?](tag|category|author|page|tim-kiem|search|trang)\b|#|\?/.test(blog.url);
                if (isJunk || seen.has(blog.url)) return false;
                seen.add(blog.url);
                return true;
              })
              .slice(0, 15); // Don't let one site dominate

            if (cleanBlogs.length > 0) {
              finalResults.push(...cleanBlogs);
            } else {
              finalResults.push(rootComp); // Keep homepage if no blogs found
            }
          } catch (e) {
            finalResults.push(rootComp);
          }
        }
        competitors = finalResults;
      }

      return NextResponse.json({ competitors, keyword: finalKeyword, engineUsed: currentEngine });
    } finally {
      if (browser) await (browser as any).close();
    }

  } catch (error: any) {
    console.error(`Lỗi tìm kiếm đối thủ:`, error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi không xác định.' }, { status: 500 });
  }
}
