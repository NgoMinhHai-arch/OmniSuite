
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { imageSize } from 'image-size';
import { chromium } from 'playwright';
import { PLAYWRIGHT_HEADLESS, PLAYWRIGHT_LAUNCH_ARGS } from '@/shared/lib/playwright/config';

// ---------------------------------------------------------
// SEO SCRAPER CONSTANTS & HELPERS
// ---------------------------------------------------------
const COMMON_AFFILIATE_PATTERNS = ['shopee.vn', 'shope.ee', 'tiki.vn', 'lazada.vn', 'accesstrade.vn'];
const VIETNAMESE_STOP_WORDS = new Set([
  "this", "that", "and", "the", "for", "with", "you", "are", "our", "your", "from",
  "là", "của", "những", "các", "một", "cho", "với", "không", "thì", "mà", "như", "khi", "từ", "này", "được", "về", "vào", "ra", "đến", "ở", "tại", "sự", "thêm", "lại", "chi", "tiết", "trang", "bài", "viết", "xem", "người", "nhất", "hơn", "nào", "đó", "đây", "rất", "hay", "cũng", "đang", "qua", "trên", "dưới", "ngoài", "phần", "website", "tổng", "quan", "công", "ty", "dịch", "vụ", "giá", "rẻ", "uy", "tín", "chất", "lượng"
]);
const VIETNAMESE_FILLER_WORDS = new Set([
  'và', 'hoặc', 'là', 'của', 'cho', 'với', 'trong', 'trên', 'dưới', 'tại', 'được', 'những', 'các', 'một', 'này', 'kia'
]);

type HeadingNode = {
  tag: 'h1' | 'h2' | 'h3';
  text: string;
  children: HeadingNode[];
  isSkippedLevel?: boolean;
};

type SeoIssue = {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
};

const buildHeadingTree = (headings: { tag: string; text: string }[]): HeadingNode[] => {
  const tree: HeadingNode[] = [];
  let currentH1: HeadingNode | null = null;
  let currentH2: HeadingNode | null = null;

  for (const heading of headings) {
    if (!['h1', 'h2', 'h3'].includes(heading.tag) || !heading.text) continue;
    const level = Number(heading.tag.slice(1));
    const node: HeadingNode = {
      tag: heading.tag as HeadingNode['tag'],
      text: heading.text,
      children: [],
    };

    if (level === 1) {
      tree.push(node);
      currentH1 = node;
      currentH2 = null;
      continue;
    }

    if (level === 2) {
      if (!currentH1) {
        node.isSkippedLevel = true;
        tree.push(node);
      } else {
        currentH1.children.push(node);
      }
      currentH2 = node;
      continue;
    }

    if (!currentH2) {
      node.isSkippedLevel = true;
      if (currentH1) currentH1.children.push(node);
      else tree.push(node);
      continue;
    }
    currentH2.children.push(node);
  }

  return tree;
};

const formatKeyword = (kw: string) => {
    // Làm sạch các ký tự rác do AI có thể trả về (ngoặc kép, chấm cuối câu)
    let clean = kw.trim().replace(/^["']|["']$|\.$/g, ''); 
    
    // Loại bỏ các tiền tố AI hay dùng (Detailed SEO Style)
    clean = clean.replace(/^(Từ khóa chính là:|Từ khóa là:|Focus keyword:|Keyword:)\s*/i, '');

    if (!clean) return "";
    if (clean === "Missing") return clean;
    // Viết hoa chữ cái đầu và GIỮ NGUYÊN phần còn lại (để không hỏng danh từ riêng Nha Trang, SEO...)
    return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const extractPhraseKeywordsFallback = (rawText: string, topN = 10): Array<{ word: string; count: number; density: string }> => {
  const wordsOnly = rawText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = wordsOnly
    .split(' ')
    .filter((w) => w.length > 1 && !VIETNAMESE_STOP_WORDS.has(w) && Number.isNaN(Number(w)));

  if (!tokens.length) return [];

  const phraseFreq: Record<string, number> = {};
  const maxN = 4;
  const minN = 2;
  for (let i = 0; i < tokens.length; i++) {
    for (let n = minN; n <= maxN; n++) {
      if (i + n > tokens.length) continue;
      const phraseTokens = tokens.slice(i, i + n);
      const fillerCount = phraseTokens.filter((t) => VIETNAMESE_FILLER_WORDS.has(t)).length;
      if (fillerCount > Math.floor(n / 2)) continue;
      const phrase = phraseTokens.join(' ').trim();
      if (phrase.length < 6) continue;
      phraseFreq[phrase] = (phraseFreq[phrase] || 0) + 1;
    }
  }

  const phraseEntries = Object.entries(phraseFreq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  // Keep longer phrases first when counts are similar.
  phraseEntries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0].split(' ').length - a[0].split(' ').length;
  });

  const selected: Array<[string, number]> = [];
  for (const [phrase, count] of phraseEntries) {
    const overlaps = selected.some(([picked]) => picked.includes(phrase) || phrase.includes(picked));
    if (overlaps) continue;
    selected.push([phrase, count]);
    if (selected.length >= topN) break;
  }

  const finalPicked = selected.length
    ? selected
    : Object.entries(phraseFreq).sort((a, b) => b[1] - a[1]).slice(0, topN);
  const total = finalPicked.reduce((sum, [, count]) => sum + count, 0) || 1;

  return finalPicked.map(([word, count]) => ({
    word,
    count,
    density: ((count / total) * 100).toFixed(2) + '%',
  }));
};

const detectSeoIssues = (params: {
  statusCode: number;
  title: string;
  description: string;
  h1: string;
  canonical: string;
  robots: string;
  wordCount: number;
  responseTimeMs: number;
  imagesMissingAlt: number;
  headingCounts: Record<string, number>;
  linkStats: { internal: number; external: number; nofollow: number; dofollow: number; unknown?: number };
}): SeoIssue[] => {
  const {
    statusCode,
    title,
    description,
    h1,
    canonical,
    robots,
    wordCount,
    responseTimeMs,
    imagesMissingAlt,
    headingCounts,
    linkStats,
  } = params;
  const issues: SeoIssue[] = [];

  if (statusCode >= 400) {
    issues.push({
      id: 'http-error',
      severity: 'error',
      category: 'HTTP',
      message: `Trang trả về mã lỗi ${statusCode}.`,
    });
  } else if (statusCode >= 300) {
    issues.push({
      id: 'http-redirect',
      severity: 'info',
      category: 'HTTP',
      message: `Trang trả về chuyển hướng ${statusCode}.`,
    });
  }

  if (!title) {
    issues.push({ id: 'title-missing', severity: 'error', category: 'Title', message: 'Thiếu thẻ title.' });
  } else {
    if (title.length > 60) {
      issues.push({
        id: 'title-too-long',
        severity: 'warning',
        category: 'Title',
        message: `Title dài (${title.length} ký tự), nên <= 60.`,
      });
    } else if (title.length < 20) {
      issues.push({
        id: 'title-too-short',
        severity: 'info',
        category: 'Title',
        message: `Title ngắn (${title.length} ký tự), có thể chưa đủ ngữ cảnh SEO.`,
      });
    }
  }

  if (!description) {
    issues.push({
      id: 'meta-description-missing',
      severity: 'warning',
      category: 'Meta Description',
      message: 'Thiếu meta description.',
    });
  } else if (description.length > 160) {
    issues.push({
      id: 'meta-description-too-long',
      severity: 'info',
      category: 'Meta Description',
      message: `Meta description dài (${description.length} ký tự), nên <= 160.`,
    });
  }

  if (!h1) {
    issues.push({ id: 'h1-missing', severity: 'error', category: 'Heading', message: 'Thiếu thẻ H1.' });
  }
  if ((headingCounts.h1 || 0) > 1) {
    issues.push({
      id: 'h1-multiple',
      severity: 'warning',
      category: 'Heading',
      message: `Có nhiều H1 (${headingCounts.h1}).`,
    });
  }

  if (!canonical) {
    issues.push({
      id: 'canonical-missing',
      severity: 'warning',
      category: 'Canonical',
      message: 'Thiếu canonical URL.',
    });
  }

  if (robots.toLowerCase().includes('noindex')) {
    issues.push({
      id: 'robots-noindex',
      severity: 'info',
      category: 'Indexability',
      message: 'Trang đang đặt noindex.',
    });
  }

  if (wordCount > 0 && wordCount < 200) {
    issues.push({
      id: 'thin-content',
      severity: 'warning',
      category: 'Content',
      message: `Nội dung mỏng (${wordCount} từ).`,
    });
  }

  if (responseTimeMs > 3000) {
    issues.push({
      id: 'slow-response',
      severity: 'warning',
      category: 'Performance',
      message: `Phản hồi chậm (${responseTimeMs}ms).`,
    });
  }

  if (imagesMissingAlt > 0) {
    issues.push({
      id: 'images-missing-alt',
      severity: imagesMissingAlt >= 5 ? 'warning' : 'info',
      category: 'Images',
      message: `${imagesMissingAlt} ảnh thiếu alt.`,
    });
  }

  if (linkStats.external > 0 && linkStats.nofollow === 0 && linkStats.dofollow > 0) {
    issues.push({
      id: 'external-links-all-dofollow',
      severity: 'info',
      category: 'Links',
      message: 'Có external links dofollow, nên rà soát rủi ro outbound link.',
    });
  }

  return issues;
};


async function extractKeywordAI(text: string, aiSettings: any) {
    if (!text || !aiSettings) return null;
    
    // Tự động nhận diện Provider và Key
    const provider = aiSettings.default_provider || 'Gemini';
    let apiKey = '';
    let apiEndpoint = '';
    let model = aiSettings.default_model || '';

    // Xác định Key và Endpoint phù hợp
    if (provider === 'Groq' && aiSettings.groq_api_key) {
        apiKey = aiSettings.groq_api_key;
        apiEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
        if (!model || !model.includes('llama') && !model.includes('mixtral')) model = 'llama-3.3-70b-versatile';
    } else if (provider === 'Gemini' && aiSettings.gemini_api_key) {
        apiKey = aiSettings.gemini_api_key;
        apiEndpoint = 'GeminiAPI'; // Đánh dấu dùng luồng Gemini riêng
        if (!model || !model.includes('gemini')) model = 'gemini-1.5-flash';
    } else if (provider === 'OpenAI' && aiSettings.openai_api_key) {
        apiKey = aiSettings.openai_api_key;
        apiEndpoint = 'https://api.openai.com/v1/chat/completions';
        if (!model || !model.includes('gpt')) model = 'gpt-3.5-turbo';
    } else {
        // Fallback tự động tìm Key bất kỳ nếu Provider chính không có Key
        if (aiSettings.gemini_api_key) {
            apiKey = aiSettings.gemini_api_key;
            apiEndpoint = 'GeminiAPI';
            model = 'gemini-1.5-flash';
        } else if (aiSettings.groq_api_key) {
            apiKey = aiSettings.groq_api_key;
            apiEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
            model = 'llama-3.3-70b-versatile';
        } else if (aiSettings.openai_api_key) {
            apiKey = aiSettings.openai_api_key;
            apiEndpoint = 'https://api.openai.com/v1/chat/completions';
            model = 'gpt-3.5-turbo';
        } else return null;
    }

    try {
        const isOutline = text.includes('H1:') || text.includes('H2:');
        const isH1 = text.length < 300 && text.split('\n').length <= 2;
        
        let prompt = "";
        if (isOutline) {
            prompt = `Bạn là chuyên gia SEO kỳ cựu. Tôi sẽ cung cấp sơ đồ các thẻ Heading (H1-H6). Xác định DUY NHẤT một "Từ khóa chính" (Focus Keyword) có giá trị SEO cao nhất.
              NGUYÊN TẮC BẮT BUỘC: 
              - CHỈ TRẢ VỀ DUY NHẤT CỤM TỪ KHÓA. 
              - KHÔNG GIẢI THÍCH, KHÔNG CHỦ NGỮ, KHÔNG DẤU CÂU.
              - Nếu không thể xác định, trả về "Missing".
              
              Sơ đồ Heading:\n${text}`;
        } else if (isH1) {
            prompt = `Bạn là chuyên gia SEO. Trích xuất một từ khóa chính (Focus Keyword) từ tiêu đề H1 sau. 
              YÊU CẦU: 
              - Kết quả phải là cụm danh từ tự nhiên (ví dụ: 'Dịch vụ SEO Nha Trang').
              - KHÔNG GIẢI THÍCH, KHÔNG DẪN DẮT.
              - TRẢ VỀ DUY NHẤT CỤM TỪ KHÓA.
              Tiêu đề: "${text}"`;
        } else {
            prompt = `Phân tích đoạn nội dung này và xác định 1 từ khóa SEO chính (Focus Keyword) duy nhất. 
              CHỈ TRẢ VỀ ĐÚNG TỪ KHÓA, KHÔNG GIẢI THÍCH.
              Nội dung: ${text.slice(0, 1500)}`;
        }


        if (apiEndpoint === 'GeminiAPI') {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 20 }
                })
            });
            if (!response.ok) return null;
            const data = await response.json();
            return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
        } else {
            // OpenAI chat completion compatible (OpenAI, Groq, DeepSeek...)
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1,
                    max_tokens: 20
                })
            });
            if (!response.ok) return null;
            const data = await response.json();
            return data?.choices?.[0]?.message?.content?.trim() || null;
        }
    } catch (e) {
        console.error("AI Extraction Error:", e);
        return null;
    }
}

export async function POST(req: NextRequest) {
  try {
    const { urls, aiSettings }: { urls: string[], aiSettings?: any } = await req.json();

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json({ error: 'Invalid input: urls must be an array of strings' }, { status: 400 });
    }

    const TIMEOUT_MS = 10000;
    const MAX_RETRIES = 3;

    const fetchWithRetry = async (url: string, options: any, retries = 0): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        // Retry on Server Errors (5xx)
        if (!response.ok && retries < MAX_RETRIES && response.status >= 500) {
          await new Promise(r => setTimeout(r, 1000 * (retries + 1))); 
          return fetchWithRetry(url, options, retries + 1);
        }
        return response;
      } catch (err: any) {
        // Retry on timeouts or network errors
        if (retries < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * (retries + 1)));
          return fetchWithRetry(url, options, retries + 1);
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const enrichImageMeta = async (src: string): Promise<{ sizeKb: number; width: number | null; height: number | null }> => {
      try {
        const imageRes = await fetchWithRetry(
          src,
          {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
              Referer: 'https://www.google.com/',
            },
            redirect: 'follow',
            next: { revalidate: 0 },
          },
          0,
        );
        if (!imageRes.ok) return { sizeKb: 0, width: null, height: null };

        const buffer = Buffer.from(await imageRes.arrayBuffer());
        const rawLen = Number(imageRes.headers.get('content-length') || 0);
        const sizeKb = Math.max(1, Math.round((rawLen || buffer.byteLength) / 1024));

        try {
          const parsed = imageSize(buffer);
          return {
            sizeKb,
            width: parsed.width || null,
            height: parsed.height || null,
          };
        } catch {
          return { sizeKb, width: null, height: null };
        }
      } catch {
        return { sizeKb: 0, width: null, height: null };
      }
    };

    const collectImagesWithPlaywright = async (targetUrl: string): Promise<Array<{ src: string; alt: string; title: string }>> => {
      let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
      try {
        browser = await chromium.launch({
          headless: PLAYWRIGHT_HEADLESS,
          args: PLAYWRIGHT_LAUNCH_ARGS,
        });
        const page = await browser.newPage({
          viewport: { width: 1366, height: 900 },
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        });
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1200);
        await page.evaluate(async () => {
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise((resolve) => setTimeout(resolve, 700));
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(700);
        const images = await page.evaluate(() => {
          const out: Array<{ src: string; alt: string; title: string }> = [];
          const pickTitle = (el: Element): string => {
            const v =
              el.getAttribute('title') ||
              el.getAttribute('data-title') ||
              el.getAttribute('aria-label') ||
              el.getAttribute('data-caption') ||
              '';
            return v.trim();
          };

          document.querySelectorAll('img').forEach((img) => {
            const src =
              (img as HTMLImageElement).currentSrc ||
              img.getAttribute('src') ||
              img.getAttribute('data-src') ||
              img.getAttribute('data-lazy-src') ||
              img.getAttribute('data-original') ||
              img.getAttribute('data-srcset')?.split(' ')[0] ||
              '';
            if (!src || src.startsWith('data:')) return;
            out.push({
              src,
              alt: (img.getAttribute('alt') || '').trim(),
              title: pickTitle(img),
            });
          });

          document.querySelectorAll('[style*="background-image"]').forEach((el) => {
            const style = (el as HTMLElement).style?.backgroundImage || '';
            const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (!match?.[1] || match[1].startsWith('data:')) return;
            out.push({ src: match[1], alt: 'BG Image', title: pickTitle(el) });
          });

          document.querySelectorAll('picture').forEach((pic) => {
            if (pic.querySelector('img')) return;
            const source = pic.querySelector('source');
            const srcset = source?.getAttribute('srcset') || '';
            const first = srcset.split(',')[0]?.trim().split(' ')[0];
            if (!first || first.startsWith('data:')) return;
            out.push({ src: first, alt: '', title: pickTitle(pic) });
          });

          return out;
        });
        return images.map((img) => {
          try {
            return { ...img, src: new URL(img.src, targetUrl).href };
          } catch {
            return img;
          }
        });
      } catch {
        return [];
      } finally {
        if (browser) await browser.close();
      }
    };

    const scrapeUrl = async (url: string, aiSettings?: any) => {
      try {
        const startTime = performance.now();
        const fetchOptions = { 
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://www.google.com/',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Connection': 'keep-alive',
            'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
          },
          redirect: 'follow',
          next: { revalidate: 0 }
        };

        const response = await fetchWithRetry(url, fetchOptions);
        const statusCode = response.status;
        const html = await response.text();
        const endTime = performance.now();
        const $ = cheerio.load(html);
 
        // Metadata Extraction (On FULL DOM for accuracy)
        const title = $('title').text().trim();
        const description = $('meta[name="description"]').attr('content')?.trim() || '';
        const h1 = $('h1').first().text().trim();
        
        // Robust Canonical Selection (Detailed SEO Style)
        let canonical = $('link[rel="canonical"]').attr('href') || 
                        $('link[rel=\'canonical\']').attr('href') || 
                        '';
        
        // Fallback to Self-URL if canonical is missing (Same as SEO extensions)
        if (!canonical) {
           canonical = url;
        }
        
        const robots = $('meta[name="robots"]').attr('content') || 'index, follow';
        const lang = $('html').attr('lang') || 'N/A';

        // Metadata: Open Graph
        const og = {
          title: $('meta[property="og:title"]').attr('content') || '',
          description: $('meta[property="og:description"]').attr('content') || '',
          image: $('meta[property="og:image"]').attr('content') || '',
          type: $('meta[property="og:type"]').attr('content') || '',
        };

        // Metadata: Twitter
        const twitter = {
          card: $('meta[name="twitter:card"]').attr('content') || '',
          title: $('meta[name="twitter:title"]').attr('content') || '',
          description: $('meta[name="twitter:description"]').attr('content') || '',
        };

        // Image Analysis (covers <img>, lazy-loaded images, and prevents double-counting in <picture>)
        let totalImages = 0;
        let imagesMissingAlt = 0;
        let imagesMissingTitle = 0;
        let images: { src: string; alt: string; title: string; sizeKb: number; width: number | null; height: number | null }[] = [];

        $('img').each((i, el) => {
          totalImages++;
          
          const alt = $(el).attr('alt') || '';
          if (alt.trim() === '') imagesMissingAlt++;
          
          const titleAttr =
            $(el).attr('title') ||
            $(el).attr('data-title') ||
            $(el).attr('aria-label') ||
            $(el).attr('data-caption') ||
            '';
          // Treat image title as missing only when BOTH title and alt are empty.
          if (titleAttr.trim() === '' && alt.trim() === '') imagesMissingTitle++;
          
          // Comprehensive Lazy-load detection
          const src = $(el).attr('src') || 
                      $(el).attr('data-src') || 
                      $(el).attr('data-lazy-src') || 
                      $(el).attr('data-original') ||
                      $(el).attr('data-srcset')?.split(' ')[0] ||
                      '';
          
          if (src && !src.startsWith('data:')) {
            try {
              const fullSrc = new URL(src, url).href;
              images.push({ src: fullSrc, alt, title: titleAttr, sizeKb: 0, width: null, height: null });
            } catch (e) {
               if (src.startsWith('http')) {
                 images.push({ src, alt, title: titleAttr, sizeKb: 0, width: null, height: null });
               }
            }
          }
        });

        // Refined background-image detection
        $('[style*="background-image"]').each((i, el) => {
          const style = $(el).attr('style') || '';
          const match = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
          if (match && match[1]) {
            const bgUrl = match[1];
            if (!bgUrl.startsWith('data:')) {
              totalImages++;
              try {
                const fullBgUrl = new URL(bgUrl, url).href;
                images.push({ src: fullBgUrl, alt: 'BG Image', title: '', sizeKb: 0, width: null, height: null });
              } catch(e) {
                images.push({ src: bgUrl, alt: 'BG Image', title: '', sizeKb: 0, width: null, height: null });
              }
            }
          }
        });

        // Count <picture> as 1 image even if it has multiple <source> tags
        // the <img> inside is already counted. If no <img> but has <source>, count it.
        $('picture').each((i, el) => {
           if ($(el).find('img').length === 0) {
              totalImages++;
           }
        });

        // Prefer Playwright-rendered DOM for image completeness (human/bot visible),
        // fallback to static Cheerio extraction if Playwright is unavailable.
        const playwrightImages = await collectImagesWithPlaywright(url);
        if (playwrightImages.length) {
          images = playwrightImages.map((img) => ({
            src: img.src,
            alt: img.alt || '',
            title: img.title || '',
            sizeKb: 0,
            width: null,
            height: null,
          }));
          totalImages = images.length;
          imagesMissingAlt = images.filter((img) => !img.alt.trim()).length;
          imagesMissingTitle = images.filter((img) => !img.title.trim() && !img.alt.trim()).length;
        }

        // Enrich image rows with file size and dimensions for UI details modal.
        const IMAGE_META_LIMIT = 20;
        for (const img of images.slice(0, IMAGE_META_LIMIT)) {
          const meta = await enrichImageMeta(img.src);
          img.sizeKb = meta.sizeKb;
          img.width = meta.width;
          img.height = meta.height;
        }

        // --- PROFESSIONAL SEO LINK AUDIT ENGINE (V3.0) ---
        const linkBuckets = {
          anchor: {
            internal: 0,
            external: 0,
            nofollow: 0,
            dofollow: 0,
            unknown: 0,
            internalUrls: new Set<string>(),
            externalUrls: new Set<string>(),
          },
          resource: {
            internal: 0,
            external: 0,
            nofollow: 0,
            dofollow: 0,
            unknown: 0,
            internalUrls: new Set<string>(),
            externalUrls: new Set<string>(),
          },
        };
        const externalDomains = new Set<string>();
        const affiliateDomains = new Set<string>();
        const baseHostname = new URL(url).hostname.replace('www.', '');

        const normalizeRelTokens = (relRaw: string): Set<string> => {
          return new Set((relRaw || '').toLowerCase().split(/\s+/).map((token) => token.trim()).filter(Boolean));
        };

        const processUrl = (hrefRaw: string, rel: string = '', bucket: 'anchor' | 'resource' = 'anchor') => {
          const href = hrefRaw.trim();
          if (!href) return;
          const relTokens = normalizeRelTokens(rel);
          const hasRel = relTokens.size > 0;
          try {
            if (href.startsWith('#') || href.startsWith('javascript:')) {
              linkBuckets[bucket].internal++;
              return;
            }
            if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('sms:')) {
              linkBuckets[bucket].external++;
              if (hasRel && relTokens.has('nofollow')) linkBuckets[bucket].nofollow++;
              else if (hasRel) linkBuckets[bucket].dofollow++;
              else linkBuckets[bucket].unknown++;
              return;
            }
            
            const absoluteUrl = new URL(href, url);
            const isInternal = absoluteUrl.hostname.replace('www.', '') === baseHostname;
            if (isInternal) {
              linkBuckets[bucket].internal++;
              linkBuckets[bucket].internalUrls.add(absoluteUrl.href);
            } else {
              linkBuckets[bucket].external++;
              linkBuckets[bucket].externalUrls.add(absoluteUrl.href);
              const domain = absoluteUrl.hostname.toLowerCase().replace('www.', '');
              externalDomains.add(domain);
              if (COMMON_AFFILIATE_PATTERNS.some(p => domain.includes(p))) affiliateDomains.add(domain);
            }
            if (hasRel && relTokens.has('nofollow')) linkBuckets[bucket].nofollow++;
            else if (hasRel) linkBuckets[bucket].dofollow++;
            else linkBuckets[bucket].unknown++;
          } catch (e) {}
        };

        // 1. Anchor Tags (<a>) - Main Navigation
        $('a').each((i, el) => {
          processUrl($(el).attr('href') || '', $(el).attr('rel') || '', 'anchor');
        });

        // 2-7. Resource Links
        $('link, form, iframe, img, script, area').each((i, el) => {
          const href = $(el).attr('href') || $(el).attr('src') || $(el).attr('action') || $(el).attr('data-src') || '';
          if (href) processUrl(href, $(el).attr('rel') || '', 'resource');
        });

        // Schema JSON-LD & Date Extraction from Schema
        const schemas: string[] = [];
        const schemaTypes: string[] = [];
        let schemaDatePublished = '';
        let schemaDateModified = '';
        let schemaKeywords = ''; 

        $('script[type="application/ld+json"]').each((i, el) => {
          try {
            const content = $(el).html();
            if (content) {
              schemas.push(content);
              const parsed = JSON.parse(content);
              const findData = (obj: any) => {
                const type = obj['@type'];
                if (type) {
                  // handle array or string type
                  const typeArray = Array.isArray(type) ? type : [type];
                  schemaTypes.push(...typeArray);
                  
                  // BƯỚC 1: Ràng buộc phạm vi Schema
                  const validTypes = ['Article', 'NewsArticle', 'BlogPosting', 'WebPage'];
                  const isTypeValid = typeArray.some((t: string) => validTypes.includes(t));
                  
                  if (isTypeValid) {
                    if (obj.datePublished && !schemaDatePublished) schemaDatePublished = obj.datePublished;
                    if (obj.dateModified && !schemaDateModified) schemaDateModified = obj.dateModified;
                    
                    // Vùng ưu tiên 3 (Dữ liệu cấu trúc) - Từ khoá
                    if (obj.keywords && !schemaKeywords) {
                        schemaKeywords = Array.isArray(obj.keywords) ? obj.keywords.join(', ') : obj.keywords;
                    } else if (obj.about && !schemaKeywords) {
                        schemaKeywords = Array.isArray(obj.about) ? obj.about.join(', ') : obj.about;
                    }
                  }
                }
                
                if (obj['@graph'] && Array.isArray(obj['@graph'])) {
                  obj['@graph'].forEach((g: any) => findData(g));
                }
              };
              findData(parsed);
            }
          } catch (e) {}
        });

        // Headings Detail
        const headings: { tag: string; text: string }[] = [];
        const headingCounts: Record<string, number> = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
        $('h1, h2, h3, h4, h5, h6').each((i, el) => {
          const tag = $(el).prop('tagName').toLowerCase();
          headingCounts[tag]++;
          headings.push({ tag, text: $(el).text().trim() });
        });
        const headingTree = buildHeadingTree(headings);

        // Hreflang
        const hreflangs: { lang: string; href: string }[] = [];
        $('link[rel="alternate"][hreflang]').each((i, el) => {
          hreflangs.push({ lang: $(el).attr('hreflang') || '', href: $(el).attr('href') || '' });
        });

        // CLEAN TEXT FOR ANALYSIS (GỌT VỎ - LẤY HẠT)
        // ---------------------------------------------------------
        const cleanContent = cheerio.load(html);
        let totalWordsForDensity = 0;
        let cleanWords: string[] = [];
        let cleanBodyText = '';

        // BƯỚC 1: Chọn đúng vùng chứa bài viết (Scope)
        let mainContent = cleanContent('.entry-content');
        if (mainContent.length === 0) mainContent = cleanContent('article');
        if (mainContent.length === 0) mainContent = cleanContent('.post-content');
        if (mainContent.length === 0) mainContent = cleanContent('main');

        let isFallbackToBody = false;
        if (mainContent.length === 0) {
            mainContent = cleanContent('body');
            isFallbackToBody = true;
        }

        if (mainContent.length > 0) {
            // Loại bỏ rác
            let trashTags = ['script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'aside', 'form', 'svg'];
            if (isFallbackToBody) {
                trashTags = [...trashTags, '.sidebar', '#sidebar', '.widget', '.comments', '#comments', '.related-posts'];
            }
            trashTags.forEach(tag => mainContent.find(tag).remove());
            
            mainContent.find('*').each(function(this: any) {
                const className = ($(this).attr('class') || '') + ' ' + ($(this).attr('id') || '');
                const lowerClass = className.toLowerCase();
                if (lowerClass.includes('comment') || lowerClass.includes('related') || lowerClass.includes('sidebar') || lowerClass.includes('toc')) {
                    $(this).remove();
                }
            });

            // Lấy text sạch
            mainContent.find('*').append(' '); 
            const rawText = mainContent.text().trim();
            cleanWords = rawText.match(/[\p{L}\p{N}_]+/gu) || [];
            totalWordsForDensity = cleanWords.length;
            cleanBodyText = rawText.replace(/\s+/g, ' ');
        }

        // Đảm bảo textPreview có dữ liệu kể cả khi scrubbing thất bại
        const bodyTextRaw = $('body').text().trim();
        // Identification (Group 1) - MOVE UP to support Keyword logic

        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.replace(/\/$/, '').split('/').filter(p => p);
        const urlDepth = pathSegments.length;
        
        let contentType = 'Trang khác';
        if (urlObj.pathname === '/' || urlObj.pathname === '') contentType = 'Trang chủ';
        else if (urlObj.pathname.includes('product') || urlObj.pathname.includes('san-pham')) contentType = 'Sản phẩm';
        else if (urlObj.pathname.includes('blog') || urlObj.pathname.includes('tin-tuc') || urlObj.pathname.includes('post')) contentType = 'Bài viết';
        else if (urlObj.pathname.includes('category') || urlObj.pathname.includes('danh-muc')) contentType = 'Danh mục';
        
        // Dynamic Content Type from Schema
        if (schemaTypes.includes('Product')) contentType = 'Sản phẩm';
        else if (schemaTypes.includes('Article') || schemaTypes.includes('BlogPosting')) contentType = 'Bài viết';

        const textPreview = (cleanBodyText.length > 100 ? cleanBodyText : bodyTextRaw.replace(/\s+/g, ' ').trim()).slice(0, 1500);


        const getPrimaryKeywords = () => {
          // Priority 1 (Meta Tags) - The most reliable source for "Detailed SEO" extension style
          const metaKw = $('meta[name="keywords"]').attr('content') || '';
          if (metaKw && metaKw.trim().length > 0) {
             const cleaned = metaKw.split(',')[0].trim();
             return { display: formatKeyword(cleaned), raw: cleaned.toLowerCase() };
          }

          // Priority 2 (JSON-LD Schema)
          if (schemaKeywords && schemaKeywords.trim().length > 0) {
             const cleaned = schemaKeywords.split(',')[0].trim();
             return { display: formatKeyword(cleaned), raw: cleaned.toLowerCase() };
          }
          
          return { display: "Missing", raw: "" };
        };

        const kwLocal = getPrimaryKeywords();
        let primaryKeyword = kwLocal.display;
        let densityCrawlPhrase = kwLocal.raw;

        // BƯỚC 4 (AI FALLBACK): Nếu vẫn không tìm thấy, gọi AI làm việc
        // Chỉ gọi AI cho các trang nội dung thực sự (tránh XML, PDF, 404 kỹ thuật)
        const isContentPage = ['Bài viết', 'Sản phẩm', 'Trang chủ', 'Trang khác'].includes(contentType) && statusCode === 200;
        const isNotInternalFile = !url.includes('.xml') && !url.includes('.txt') && !url.includes('.pdf');

        if (primaryKeyword === "Missing" && aiSettings && isContentPage && isNotInternalFile) {
           let aiResult = null;
           
           // Ưu tiên 1: Phân tích toàn bộ sơ đồ Heading (H1-H6)
           const headingOutline = headings.map(h => `${h.tag.toUpperCase()}: ${h.text}`).join('\n').slice(0, 1000);
           if (headingOutline && headingOutline.length > 20) {
              aiResult = await extractKeywordAI(headingOutline, aiSettings);
           }

           // Ưu tiên 2: Fallback H1 đơn lẻ
           if (!aiResult || aiResult.toLowerCase() === 'missing') {
              const h1Text = $('h1').first().text().trim();
              if (h1Text && h1Text.length > 5) {
                 aiResult = await extractKeywordAI(h1Text, aiSettings);
              }
           }

           // Ưu tiên 3: Đọc nội dung bài viết
           if (!aiResult || aiResult.toLowerCase() === 'missing') {
              aiResult = await extractKeywordAI(textPreview, aiSettings);
           }

           // LENGTH GUARD: Nếu AI trả về câu dài (giải thích) thay vì từ khóa, bỏ qua.
           if (aiResult) {
              const cleanedAi = aiResult.trim();
              const wordCount = cleanedAi.split(/\s+/).length;
              const isTrash = cleanedAi.toLowerCase().includes('không tìm thấy') || 
                              cleanedAi.toLowerCase().includes('xin lỗi') || 
                              cleanedAi.toLowerCase().includes('về một dịch vụ');
              
              if (wordCount <= 10 && !isTrash && cleanedAi.length < 100) {
                 primaryKeyword = formatKeyword(cleanedAi);
                 densityCrawlPhrase = cleanedAi.toLowerCase();
              } else {
                 console.warn(`AI Keyword too long/trash for ${url}: ${cleanedAi}`);
                 primaryKeyword = "Missing";
              }
           }
        }


        // Keyword Density calculation with Unicode-safe Phrase Match
        let keywordDensity = '0.00%';
        let keywordMatchCount = 0;
        if (densityCrawlPhrase && totalWordsForDensity > 0) {
           try {
             const escapedKw = densityCrawlPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
             // Sử dụng ranh giới Unicode (?<=^|[^...]) để hỗ trợ tiếng Việt
             const regex = new RegExp(`(?<=^|[^\\p{L}\\p{N}])(${escapedKw})(?=[^\\p{L}\\p{N}]|$)`, 'gui');
             const matches = cleanBodyText.match(regex);
             keywordMatchCount = matches ? matches.length : 0;
             keywordDensity = ((keywordMatchCount / totalWordsForDensity) * 100).toFixed(2) + '%';
           } catch (e) { /* ignore regex errors */ }
        }


        // --- Keyword NLP Processing (Calling Python Engine) ---
        let finalTopKeywords: any[] = [];
        let keywordsInTitle = 0;
        let keywordsInMeta = 0;

        try {
            const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'http://localhost:8082';
            const pyRes = await fetch(`${pythonEngineUrl}/api/seo/extract-keywords`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, html, title, description }),
                // Moderate timeout for keyword analysis
                signal: AbortSignal.timeout(12000)
            });

            if (pyRes.ok) {
                const pyData = await pyRes.json();
                finalTopKeywords = pyData.top_keywords || [];
                keywordsInTitle = pyData.keywords_in_title || 0;
                keywordsInMeta = pyData.keywords_in_meta || 0;
            } else {
                throw new Error("Python bridge error");
            }
        } catch (e) {
            console.warn(`[SCRAPE] Falling back to basic NLP for ${url}:`, (e as Error).message);
            finalTopKeywords = extractPhraseKeywordsFallback(cleanBodyText || bodyTextRaw, 10);
        }

        // --- Advanced Date Extraction (Meta + Schema) ---
        // BƯỚC 2: Quét Meta Tags trong <head>
        const metaPublished = $('head meta[property="article:published_time"]').attr('content') || 
                              $('head meta[name="publish_date"]').attr('content') ||
                              $('[itemprop="datePublished"]').attr('content') ||
                              $('time[itemprop="datePublished"]').attr('datetime') || '';
        
        const metaModified = $('head meta[property="article:modified_time"]').attr('content') || 
                             $('head meta[property="og:updated_time"]').attr('content') ||
                             $('[itemprop="dateModified"]').attr('content') ||
                             $('time[itemprop="dateModified"]').attr('datetime') || '';

        // BƯỚC 3: Quét URL Pattern (/YYYY/MM/DD)
        const urlMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
        const urlDate = urlMatch ? `${urlMatch[1]}-${urlMatch[2]}-${urlMatch[3]}` : '';

        const cleanDate = (dateStr: string) => {
          if (!dateStr) return 'N/A';
          const isoDate = dateStr.split(/[T\s\+]/)[0]; // Trích xuất đoạn YYYY-MM-DD
          const parts = isoDate.split('-');
          // Định danh dữ liệu về định dạng NGÀY - THÁNG - NĂM (DD-MM-YYYY)
          if (parts.length === 3) {
             return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          return isoDate;
        };

        const targetPublished = schemaDatePublished || metaPublished || urlDate;
        const targetModified = schemaDateModified || metaModified;

        const publishDate = {
          published: cleanDate(targetPublished),
          modified: cleanDate(targetModified)
        };

        // 2. Content Metadata (Group 2)
        const wordCount = totalWordsForDensity; // Use the cleaned word count

        
        const metaKeywordsRaw = $('meta[name="keywords"]').attr('content')?.trim() || '';
        const metaKeywordsLabel = metaKeywordsRaw || 'Missing';
        const metaKeywordsCount = metaKeywordsRaw ? metaKeywordsRaw.split(',').filter(k => k.trim()).length : 0;
        
        const publisher = $('link[rel="publisher"]').attr('href') || $('meta[name="author"]').attr('content') || 'Missing';
        const language = $('html').attr('lang') || 'N/A';

        // 3. Technical & Control (Group 3)
        const pageSizeKB = Math.round(Buffer.byteLength(html) / 1024);
        const responseTimeMs = Math.round(endTime - startTime);
        const totalImageSizeKB = images.reduce((sum, img) => sum + (img.sizeKb || 0), 0);

        const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').attr('href') || '/favicon.ico';

        const result = { 
          url, 
          statusCode, 
          title: title || 'N/A', 
          description: description || 'N/A',
          titleLength: title.length, 
          descriptionLength: description.length,
          titleWordCount: title ? title.trim().split(/\s+/).length : 0,
          descriptionWordCount: description ? description.trim().split(/\s+/).length : 0,
          h1: h1 || 'N/A', 
          metaKeywords: metaKeywordsLabel, 
          metaKeywordsCount,
          primaryKeyword, 
          densityCrawlPhrase,
          keywordDensity,
          publisher,
          language,
          robots, 
          lang,
          canonical,
          og, 
          twitter, 
          hreflangs, 
          favicon,
          imageStats: { 
            total: totalImages, 
            missingAlt: imagesMissingAlt, 
            missingTitle: imagesMissingTitle, 
            sizeKB: totalImageSizeKB 
          },
          images, // Full array of image objects
          linkStats: { 
            internal: linkBuckets.anchor.internal + linkBuckets.resource.internal,
            external: linkBuckets.anchor.external + linkBuckets.resource.external,
            nofollow: linkBuckets.anchor.nofollow + linkBuckets.resource.nofollow,
            dofollow: linkBuckets.anchor.dofollow + linkBuckets.resource.dofollow,
            unknown: linkBuckets.anchor.unknown + linkBuckets.resource.unknown,
            anchor: {
              internal: linkBuckets.anchor.internal,
              external: linkBuckets.anchor.external,
              nofollow: linkBuckets.anchor.nofollow,
              dofollow: linkBuckets.anchor.dofollow,
              unknown: linkBuckets.anchor.unknown,
            },
            resource: {
              internal: linkBuckets.resource.internal,
              external: linkBuckets.resource.external,
              nofollow: linkBuckets.resource.nofollow,
              dofollow: linkBuckets.resource.dofollow,
              unknown: linkBuckets.resource.unknown,
            },
          },
          collectedLinks: {
            internal: Array.from(new Set([...linkBuckets.anchor.internalUrls, ...linkBuckets.resource.internalUrls])),
            external: Array.from(new Set([...linkBuckets.anchor.externalUrls, ...linkBuckets.resource.externalUrls])),
            anchorLinks: {
              internal: Array.from(linkBuckets.anchor.internalUrls),
              external: Array.from(linkBuckets.anchor.externalUrls),
            },
            resourceLinks: {
              internal: Array.from(linkBuckets.resource.internalUrls),
              external: Array.from(linkBuckets.resource.externalUrls),
            },
          },
          totalLinks: linkBuckets.anchor.internal + linkBuckets.anchor.external + linkBuckets.resource.internal + linkBuckets.resource.external,
          publishDate,
          wordCount, 
          urlDepth,
          contentType,
          pageSizeKB,
          responseTimeMs,
          headings, 
          headingTree,
          headingCounts, 
          schemas, 
          schemaTypes: Array.from(new Set(schemaTypes)),
          topKeywords: finalTopKeywords,
          keywordsInTitle,
          keywordsInMeta,
          issues: detectSeoIssues({
            statusCode,
            title,
            description,
            h1,
            canonical,
            robots,
            wordCount,
            responseTimeMs,
            imagesMissingAlt,
            headingCounts,
            linkStats: {
              internal: linkBuckets.anchor.internal + linkBuckets.resource.internal,
              external: linkBuckets.anchor.external + linkBuckets.resource.external,
              nofollow: linkBuckets.anchor.nofollow + linkBuckets.resource.nofollow,
              dofollow: linkBuckets.anchor.dofollow + linkBuckets.resource.dofollow,
              unknown: linkBuckets.anchor.unknown + linkBuckets.resource.unknown,
            },
          }),
          textPreview,
          status: 'success' 
        };

        // --- Persist to Database (Fire and Forget) ---
        try {
            const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'http://localhost:8082';
            fetch(`${pythonEngineUrl}/api/seo/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result)
            }).catch(err => console.error("Database save failed", err));
        } catch (e) {}

        return result;
      } catch (error: any) {
        console.error(`Error scraping ${url}:`, error);
        return { 
          url, 
          statusCode: 500,
          title: 'Lỗi truy cập',
          description: error.message || 'Không thể cào dữ liệu từ trang này.',
          h1: 'N/A',
          metaKeywords: 'N/A',
          metaKeywordsCount: 0,
          primaryKeyword: 'N/A',
          keywordDensity: '0.00%',
          canonical: url,
          publisher: 'N/A',
          language: 'N/A',
          robots: 'N/A',
          lang: 'N/A',
          og: {},
          twitter: {},
          imageStats: { total: 0, missingAlt: 0, missingTitle: 0, sizeKB: 0 },
          linkStats: { internal: 0, external: 0, nofollow: 0, dofollow: 0 },
          collectedLinks: { internal: [], external: [], anchorLinks: { internal: [], external: [] }, resourceLinks: { internal: [], external: [] } },
          totalLinks: 0,
          wordCount: 0,
          urlDepth: 0,
          contentType: 'Lỗi',
          lastModified: 'N/A',
          pageSizeKB: 0,
          responseTimeMs: 0,
          headings: [],
          headingTree: [],
          headingCounts: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
          schemas: [],
          schemaTypes: [],
          topKeywords: [],
          keywordsInTitle: 0,
          keywordsInMeta: 0,
          issues: [
            {
              id: 'crawl-failed',
              severity: 'error',
              category: 'Crawler',
              message: 'Không thể cào dữ liệu từ URL này.',
            },
          ],
          status: 'error' 
        };
      }
    };

    // Use a gentler BATCH_SIZE (3) to avoid triggering Firewalls (WAF) or overloading targets
    const BATCH_SIZE = 3;
    const allResults = [];
    
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(url => scrapeUrl(url, aiSettings)));
      allResults.push(...batchResults);
      
      // Safety Cooldown: Wait 1s between batches to stay under the radar
      if (i + BATCH_SIZE < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json(allResults);
  } catch (error) {
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

// Version: 1.0.2 - Force rebuild
