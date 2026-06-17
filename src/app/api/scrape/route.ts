import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { imageSize } from 'image-size';
import { logger } from '@/shared/lib/logger';
import { chromium } from 'playwright';
import { PLAYWRIGHT_HEADLESS, PLAYWRIGHT_LAUNCH_ARGS } from '@/shared/lib/playwright/config';
import { getPythonEngineUrl } from '@/shared/lib/python-engine-url';
import { internalTokenHeaders } from '@/shared/lib/server/internal-token';

// ---------------------------------------------------------
// SEO SCRAPER CONSTANTS & HELPERS
// ---------------------------------------------------------
const COMMON_AFFILIATE_PATTERNS = ['shopee.vn', 'shope.ee', 'tiki.vn', 'lazada.vn', 'accesstrade.vn'];
const VIETNAMESE_STOP_WORDS = new Set([
  "this", "that", "and", "the", "for", "with", "you", "are", "our", "your", "from",
  "lÃ ", "cá»§a", "nhá»¯ng", "cÃ¡c", "má»™t", "cho", "vá»›i", "khÃ´ng", "thÃ¬", "mÃ ", "nhÆ°", "khi", "tá»«", "nÃ y", "Ä‘Æ°á»£c", "vá»", "vÃ o", "ra", "Ä‘áº¿n", "á»Ÿ", "táº¡i", "sá»±", "thÃªm", "láº¡i", "chi", "tiáº¿t", "trang", "bÃ i", "viáº¿t", "xem", "ngÆ°á»i", "nháº¥t", "hÆ¡n", "nÃ o", "Ä‘Ã³", "Ä‘Ã¢y", "ráº¥t", "hay", "cÅ©ng", "Ä‘ang", "qua", "trÃªn", "dÆ°á»›i", "ngoÃ i", "pháº§n", "website", "tá»•ng", "quan", "cÃ´ng", "ty", "dá»‹ch", "vá»¥", "giÃ¡", "ráº»", "uy", "tÃ­n", "cháº¥t", "lÆ°á»£ng"
]);
const VIETNAMESE_FILLER_WORDS = new Set([
  'vÃ ', 'hoáº·c', 'lÃ ', 'cá»§a', 'cho', 'vá»›i', 'trong', 'trÃªn', 'dÆ°á»›i', 'táº¡i', 'Ä‘Æ°á»£c', 'nhá»¯ng', 'cÃ¡c', 'má»™t', 'nÃ y', 'kia'
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
    // LÃ m sáº¡ch cÃ¡c kÃ½ tá»± rÃ¡c do AI cÃ³ thá»ƒ tráº£ vá» (ngoáº·c kÃ©p, cháº¥m cuá»‘i cÃ¢u)
    let clean = kw.trim().replace(/^["']|["']$|\.$/g, ''); 
    
    // Loáº¡i bá» cÃ¡c tiá»n tá»‘ AI hay dÃ¹ng (Detailed SEO Style)
    clean = clean.replace(/^(Tá»« khÃ³a chÃ­nh lÃ :|Tá»« khÃ³a lÃ :|Focus keyword:|Keyword:)\s*/i, '');

    if (!clean) return "";
    if (clean === "Missing") return clean;
    // Viáº¿t hoa chá»¯ cÃ¡i Ä‘áº§u vÃ  GIá»® NGUYÃŠN pháº§n cÃ²n láº¡i (Ä‘á»ƒ khÃ´ng há»ng danh tá»« riÃªng Nha Trang, SEO...)
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
      message: `Trang tráº£ vá» mÃ£ lá»—i ${statusCode}.`,
    });
  } else if (statusCode >= 300) {
    issues.push({
      id: 'http-redirect',
      severity: 'info',
      category: 'HTTP',
      message: `Trang tráº£ vá» chuyá»ƒn hÆ°á»›ng ${statusCode}.`,
    });
  }

  if (!title) {
    issues.push({ id: 'title-missing', severity: 'error', category: 'Title', message: 'Thiáº¿u tháº» title.' });
  } else {
    if (title.length > 60) {
      issues.push({
        id: 'title-too-long',
        severity: 'warning',
        category: 'Title',
        message: `Title dÃ i (${title.length} kÃ½ tá»±), nÃªn <= 60.`,
      });
    } else if (title.length < 20) {
      issues.push({
        id: 'title-too-short',
        severity: 'info',
        category: 'Title',
        message: `Title ngáº¯n (${title.length} kÃ½ tá»±), cÃ³ thá»ƒ chÆ°a Ä‘á»§ ngá»¯ cáº£nh SEO.`,
      });
    }
  }

  if (!description) {
    issues.push({
      id: 'meta-description-missing',
      severity: 'warning',
      category: 'Meta Description',
      message: 'Thiáº¿u meta description.',
    });
  } else if (description.length > 160) {
    issues.push({
      id: 'meta-description-too-long',
      severity: 'info',
      category: 'Meta Description',
      message: `Meta description dÃ i (${description.length} kÃ½ tá»±), nÃªn <= 160.`,
    });
  }

  if (!h1) {
    issues.push({ id: 'h1-missing', severity: 'error', category: 'Heading', message: 'Thiáº¿u tháº» H1.' });
  }
  if ((headingCounts.h1 || 0) > 1) {
    issues.push({
      id: 'h1-multiple',
      severity: 'warning',
      category: 'Heading',
      message: `CÃ³ nhiá»u H1 (${headingCounts.h1}).`,
    });
  }

  if (!canonical) {
    issues.push({
      id: 'canonical-missing',
      severity: 'warning',
      category: 'Canonical',
      message: 'Thiáº¿u canonical URL.',
    });
  }

  if (robots.toLowerCase().includes('noindex')) {
    issues.push({
      id: 'robots-noindex',
      severity: 'info',
      category: 'Indexability',
      message: 'Trang Ä‘ang Ä‘áº·t noindex.',
    });
  }

  if (wordCount > 0 && wordCount < 200) {
    issues.push({
      id: 'thin-content',
      severity: 'warning',
      category: 'Content',
      message: `Ná»™i dung má»ng (${wordCount} tá»«).`,
    });
  }

  if (responseTimeMs > 3000) {
    issues.push({
      id: 'slow-response',
      severity: 'warning',
      category: 'Performance',
      message: `Pháº£n há»“i cháº­m (${responseTimeMs}ms).`,
    });
  }

  if (imagesMissingAlt > 0) {
    issues.push({
      id: 'images-missing-alt',
      severity: imagesMissingAlt >= 5 ? 'warning' : 'info',
      category: 'Images',
      message: `${imagesMissingAlt} áº£nh thiáº¿u alt.`,
    });
  }

  if (linkStats.external > 0 && linkStats.nofollow === 0 && linkStats.dofollow > 0) {
    issues.push({
      id: 'external-links-all-dofollow',
      severity: 'info',
      category: 'Links',
      message: 'CÃ³ external links dofollow, nÃªn rÃ  soÃ¡t rá»§i ro outbound link.',
    });
  }

  return issues;
};


async function extractKeywordAI(text: string, aiSettings: any) {
    if (!text || !aiSettings) return null;
    
    // Tá»± Ä‘á»™ng nháº­n diá»‡n Provider vÃ  Key
    const provider = aiSettings.default_provider || 'Gemini';
    let apiKey = '';
    let apiEndpoint = '';
    let model = aiSettings.default_model || '';

    // XÃ¡c Ä‘á»‹nh Key vÃ  Endpoint phÃ¹ há»£p
    if (provider === 'Groq' && aiSettings.groq_api_key) {
        apiKey = aiSettings.groq_api_key;
        apiEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
        if (!model || !model.includes('llama') && !model.includes('mixtral')) model = 'llama-3.3-70b-versatile';
    } else if (provider === 'Gemini' && aiSettings.gemini_api_key) {
        apiKey = aiSettings.gemini_api_key;
        apiEndpoint = 'GeminiAPI'; // ÄÃ¡nh dáº¥u dÃ¹ng luá»“ng Gemini riÃªng
        if (!model || !model.includes('gemini')) model = 'gemini-1.5-flash';
    } else if (provider === 'OpenAI' && aiSettings.openai_api_key) {
        apiKey = aiSettings.openai_api_key;
        apiEndpoint = 'https://api.openai.com/v1/chat/completions';
        if (!model || !model.includes('gpt')) model = 'gpt-3.5-turbo';
    } else {
        // Fallback tá»± Ä‘á»™ng tÃ¬m Key báº¥t ká»³ náº¿u Provider chÃ­nh khÃ´ng cÃ³ Key
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
            prompt = `Báº¡n lÃ  chuyÃªn gia SEO ká»³ cá»±u. TÃ´i sáº½ cung cáº¥p sÆ¡ Ä‘á»“ cÃ¡c tháº» Heading (H1-H6). XÃ¡c Ä‘á»‹nh DUY NHáº¤T má»™t "Tá»« khÃ³a chÃ­nh" (Focus Keyword) cÃ³ giÃ¡ trá»‹ SEO cao nháº¥t.
              NGUYÃŠN Táº®C Báº®T BUá»˜C: 
              - CHá»ˆ TRáº¢ Vá»€ DUY NHáº¤T Cá»¤M Tá»ª KHÃ“A. 
              - KHÃ”NG GIáº¢I THÃCH, KHÃ”NG CHá»¦ NGá»®, KHÃ”NG Dáº¤U CÃ‚U.
              - Náº¿u khÃ´ng thá»ƒ xÃ¡c Ä‘á»‹nh, tráº£ vá» "Missing".
              
              SÆ¡ Ä‘á»“ Heading:\n${text}`;
        } else if (isH1) {
            prompt = `Báº¡n lÃ  chuyÃªn gia SEO. TrÃ­ch xuáº¥t má»™t tá»« khÃ³a chÃ­nh (Focus Keyword) tá»« tiÃªu Ä‘á» H1 sau. 
              YÃŠU Cáº¦U: 
              - Káº¿t quáº£ pháº£i lÃ  cá»¥m danh tá»« tá»± nhiÃªn (vÃ­ dá»¥: 'Dá»‹ch vá»¥ SEO Nha Trang').
              - KHÃ”NG GIáº¢I THÃCH, KHÃ”NG DáºªN Dáº®T.
              - TRáº¢ Vá»€ DUY NHáº¤T Cá»¤M Tá»ª KHÃ“A.
              TiÃªu Ä‘á»: "${text}"`;
        } else {
            prompt = `PhÃ¢n tÃ­ch Ä‘oáº¡n ná»™i dung nÃ y vÃ  xÃ¡c Ä‘á»‹nh 1 tá»« khÃ³a SEO chÃ­nh (Focus Keyword) duy nháº¥t. 
              CHá»ˆ TRáº¢ Vá»€ ÄÃšNG Tá»ª KHÃ“A, KHÃ”NG GIáº¢I THÃCH.
              Ná»™i dung: ${text.slice(0, 1500)}`;
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
        logger.error(`AI Extraction Error: ${e}`);
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

    type RenderedMeta = {
      title: string;
      h1: string;
      canonical: string;
      robots: string;
    };
    type PlaywrightCollectResult = {
      images: Array<{ src: string; alt: string; title: string }>;
      rendered: RenderedMeta | null;
    };
    const collectImagesWithPlaywright = async (targetUrl: string): Promise<PlaywrightCollectResult> => {
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
        const collected = await page.evaluate(() => {
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

          const titleEl = document.querySelector('title');
          const h1El = document.querySelector('h1');
          const canonicalEl = document.querySelector('link[rel="canonical"]');
          const robotsEl = document.querySelector('meta[name="robots"]');

          return {
            images: out,
            rendered: {
              title: (titleEl?.textContent || '').trim(),
              h1: (h1El?.textContent || '').trim(),
              canonical: (canonicalEl?.getAttribute('href') || '').trim(),
              robots: (robotsEl?.getAttribute('content') || '').trim(),
            } as { title: string; h1: string; canonical: string; robots: string },
          };
        });
        const images = collected.images.map((img) => {
          try {
            return { ...img, src: new URL(img.src, targetUrl).href };
          } catch {
            return img;
          }
        });
        let rendered: RenderedMeta | null = null;
        if (collected.rendered) {
          let canonical = collected.rendered.canonical;
          if (canonical) {
            try {
              canonical = new URL(canonical, targetUrl).href;
            } catch {}
          }
          rendered = { ...collected.rendered, canonical };
        }
        return { images, rendered };
      } catch {
        return { images: [], rendered: null };
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

        // Open Graph & Twitter
        const og: Record<string, string> = {};
        $('meta[property^="og:"]').each((i, el) => {
          const prop = $(el).attr('property')?.replace('og:', '') || '';
          og[prop] = $(el).attr('content') || '';
        });
        const twitter: Record<string, string> = {};
        $('meta[name^="twitter:"]').each((i, el) => {
          const name = $(el).attr('name')?.replace('twitter:', '') || '';
          twitter[name] = $(el).attr('content') || '';
        });

        // Collect a rendered snapshot for JS-mutated SEO metadata and lazy images.
        const { images: renderedImages, rendered: renderedMeta } = await collectImagesWithPlaywright(url);

        // Images â†’ absolute URL + metadata
        const imageMap = new Map<string, { src: string; alt: string; title: string }>();
        $('img').each((i, el) => {
          const srcRaw = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || '';
          if (!srcRaw) return;
          try {
            const abs = new URL(srcRaw, url).href;
            if (!imageMap.has(abs)) {
              imageMap.set(abs, {
                src: abs,
                alt: ($(el).attr('alt') || '').trim(),
                title: ($(el).attr('title') || '').trim(),
              });
            }
          } catch {}
        });
        for (const img of renderedImages) {
          if (!img.src) continue;
          if (!imageMap.has(img.src)) imageMap.set(img.src, img);
        }
        const images = await Promise.all(
          Array.from(imageMap.values()).map(async (img) => {
            const meta = await enrichImageMeta(img.src);
            return { ...img, ...meta };
          }),
        );
        const totalImages = images.length;
        const imagesMissingAlt = images.filter(i => !i.alt || i.alt === '').length;
        const imagesMissingTitle = images.filter(i => !i.title || i.title === '').length;

        // Links â†’ collect both anchor navigation links and resource references.
        const origin = new URL(url).origin;
        const normalizeHref = (href: string) => {
          try {
            return new URL(href, url).href;
          } catch {
            return href;
          }
        };
        const affiliatePatterns = COMMON_AFFILIATE_PATTERNS;
        const isAffiliateLink = (href: string) => affiliatePatterns.some((pattern) => href.includes(pattern));
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

        type LinkRow = {
          source: 'anchor' | 'resource';
          href: string;
          type: 'internal' | 'external';
          rel: string;
          follow: 'nofollow' | 'dofollow' | 'unknown';
          affiliate: boolean;
          text: string;
          tag: string;
        };
        const linkRows: LinkRow[] = [];

        const addLink = (hrefRaw: string, source: 'anchor' | 'resource', relRaw: string, text: string, tag: string) => {
          if (!hrefRaw) return;
          const href = normalizeHref(hrefRaw);
          if (!/^https?:/i.test(href)) return;
          const type = href.startsWith(origin) ? 'internal' : 'external';
          const rel = (relRaw || '').toLowerCase();
          const follow: 'nofollow' | 'dofollow' | 'unknown' = rel.includes('nofollow')
            ? 'nofollow'
            : rel
              ? 'dofollow'
              : 'unknown';
          const bucket = linkBuckets[source];
          bucket[type] += 1;
          bucket[follow] += 1;
          if (type === 'internal') bucket.internalUrls.add(href);
          else bucket.externalUrls.add(href);
          linkRows.push({
            source,
            href,
            type,
            rel,
            follow,
            affiliate: isAffiliateLink(href),
            text: text.trim(),
            tag,
          });
        };

        $('a[href]').each((i, el) => {
          const href = $(el).attr('href') || '';
          addLink(href, 'anchor', $(el).attr('rel') || '', $(el).text() || '', 'a');
        });
        $('[src]').each((i, el) => {
          const tag = $(el).prop('tagName')?.toLowerCase() || 'resource';
          if (tag === 'img' || tag === 'script' || tag === 'iframe' || tag === 'source' || tag === 'video') {
            addLink($(el).attr('src') || '', 'resource', '', $(el).attr('alt') || '', tag);
          }
        });
        $('link[href]').each((i, el) => {
          const rel = ($(el).attr('rel') || '').toLowerCase();
          if (rel.includes('canonical') || rel.includes('alternate')) return;
          addLink($(el).attr('href') || '', 'resource', rel, rel, 'link');
        });

        // JSON-LD & Schema Types
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
                  
                  // BÆ¯á»šC 1: RÃ ng buá»™c pháº¡m vi Schema
                  const validTypes = ['Article', 'NewsArticle', 'BlogPosting', 'WebPage'];
                  const isTypeValid = typeArray.some((t: string) => validTypes.includes(t));
                  
                  if (isTypeValid) {
                    if (obj.datePublished && !schemaDatePublished) schemaDatePublished = obj.datePublished;
                    if (obj.dateModified && !schemaDateModified) schemaDateModified = obj.dateModified;
                    
                    // VÃ¹ng Æ°u tiÃªn 3 (Dá»¯ liá»‡u cáº¥u trÃºc) - Tá»« khoÃ¡
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

        // CLEAN TEXT FOR ANALYSIS (Gá»ŒT Vá»Ž - Láº¤Y Háº T)
        // ---------------------------------------------------------
        const cleanContent = cheerio.load(html);
        let totalWordsForDensity = 0;
        let cleanWords: string[] = [];
        let cleanBodyText = '';

        // BÆ¯á»šC 1: Chá»n Ä‘Ãºng vÃ¹ng chá»©a bÃ i viáº¿t (Scope)
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
            // Loáº¡i bá» rÃ¡c
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

            // Láº¥y text sáº¡ch
            mainContent.find('*').append(' '); 
            const rawText = mainContent.text().trim();
            cleanWords = rawText.match(/[\p{L}\p{N}_]+/gu) || [];
            totalWordsForDensity = cleanWords.length;
            cleanBodyText = rawText.replace(/\s+/g, ' ');
        }

        // Äáº£m báº£o textPreview cÃ³ dá»¯ liá»‡u ká»ƒ cáº£ khi scrubbing tháº¥t báº¡i
        const bodyTextRaw = $('body').text().trim();
        // Identification (Group 1) - MOVE UP to support Keyword logic

        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.replace(/\/$/, '').split('/').filter(p => p);
        const urlDepth = pathSegments.length;
        
        let contentType = 'Trang khÃ¡c';
        if (urlObj.pathname === '/' || urlObj.pathname === '') contentType = 'Trang chá»§';
        else if (urlObj.pathname.includes('product') || urlObj.pathname.includes('san-pham')) contentType = 'Sáº£n pháº©m';
        else if (urlObj.pathname.includes('blog') || urlObj.pathname.includes('tin-tuc') || urlObj.pathname.includes('post')) contentType = 'BÃ i viáº¿t';
        else if (urlObj.pathname.includes('category') || urlObj.pathname.includes('danh-muc')) contentType = 'Danh má»¥c';
        
        // Dynamic Content Type from Schema
        if (schemaTypes.includes('Product')) contentType = 'Sáº£n pháº©m';
        else if (schemaTypes.includes('Article') || schemaTypes.includes('BlogPosting')) contentType = 'BÃ i viáº¿t';

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

        // BÆ¯á»šC 4 (AI FALLBACK): Náº¿u váº«n khÃ´ng tÃ¬m tháº¥y, gá»i AI lÃ m viá»‡c
        // Chá»‰ gá»i AI cho cÃ¡c trang ná»™i dung thá»±c sá»± (trÃ¡nh XML, PDF, 404 ká»¹ thuáº­t)
        const isContentPage = ['BÃ i viáº¿t', 'Sáº£n pháº©m', 'Trang chá»§', 'Trang khÃ¡c'].includes(contentType) && statusCode === 200;
        const isNotInternalFile = !url.includes('.xml') && !url.includes('.txt') && !url.includes('.pdf');

        if (primaryKeyword === "Missing" && aiSettings && isContentPage && isNotInternalFile) {
           let aiResult = null;
           
           // Æ¯u tiÃªn 1: PhÃ¢n tÃ­ch toÃ n bá»™ sÆ¡ Ä‘á»“ Heading (H1-H6)
           const headingOutline = headings.map(h => `${h.tag.toUpperCase()}: ${h.text}`).join('\n').slice(0, 1000);
           if (headingOutline && headingOutline.length > 20) {
              aiResult = await extractKeywordAI(headingOutline, aiSettings);
           }

           // Æ¯u tiÃªn 2: Fallback H1 Ä‘Æ¡n láº»
           if (!aiResult || aiResult.toLowerCase() === 'missing') {
              const h1Text = $('h1').first().text().trim();
              if (h1Text && h1Text.length > 5) {
                 aiResult = await extractKeywordAI(h1Text, aiSettings);
              }
           }

           // Æ¯u tiÃªn 3: Äá»c ná»™i dung bÃ i viáº¿t
           if (!aiResult || aiResult.toLowerCase() === 'missing') {
              aiResult = await extractKeywordAI(textPreview, aiSettings);
           }

           // LENGTH GUARD: Náº¿u AI tráº£ vá» cÃ¢u dÃ i (giáº£i thÃ­ch) thay vÃ¬ tá»« khÃ³a, bá» qua.
           if (aiResult) {
              const cleanedAi = aiResult.trim();
              const wordCount = cleanedAi.split(/\s+/).length;
              const isTrash = cleanedAi.toLowerCase().includes('khÃ´ng tÃ¬m tháº¥y') || 
                              cleanedAi.toLowerCase().includes('xin lá»—i') || 
                              cleanedAi.toLowerCase().includes('vá» má»™t dá»‹ch vá»¥');
              
              if (wordCount <= 10 && !isTrash && cleanedAi.length < 100) {
                 primaryKeyword = formatKeyword(cleanedAi);
                 densityCrawlPhrase = cleanedAi.toLowerCase();
              } else {
                 logger.warn(`AI Keyword too long/trash for ${url}: ${cleanedAi}`);
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
             // Sá»­ dá»¥ng ranh giá»›i Unicode (?<=^|[^...]) Ä‘á»ƒ há»— trá»£ tiáº¿ng Viá»‡t
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
            const pythonEngineUrl = getPythonEngineUrl();
            const pyRes = await fetch(`${pythonEngineUrl}/api/seo/extract-keywords`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...internalTokenHeaders(),
                },
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
            logger.warn(`[SCRAPE] Falling back to basic NLP for ${url}: ${(e as Error).message}`);
            finalTopKeywords = extractPhraseKeywordsFallback(cleanBodyText || bodyTextRaw, 10);
        }

        // --- Advanced Date Extraction (Meta + Schema) ---
        // BÆ¯á»šC 2: QuÃ©t Meta Tags trong <head>
        const metaPublished = $('head meta[property="article:published_time"]').attr('content') || 
                              $('head meta[name="publish_date"]').attr('content') ||
                              $('[itemprop="datePublished"]').attr('content') ||
                              $('time[itemprop="datePublished"]').attr('datetime') || '';
        
        const metaModified = $('head meta[property="article:modified_time"]').attr('content') || 
                             $('head meta[property="og:updated_time"]').attr('content') ||
                             $('[itemprop="dateModified"]').attr('content') ||
                             $('time[itemprop="dateModified"]').attr('datetime') || '';

        // BÆ¯á»šC 3: QuÃ©t URL Pattern (/YYYY/MM/DD)
        const urlMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
        const urlDate = urlMatch ? `${urlMatch[1]}-${urlMatch[2]}-${urlMatch[3]}` : '';

        const cleanDate = (dateStr: string) => {
          if (!dateStr) return 'N/A';
          const isoDate = dateStr.split(/[T\s\+]/)[0]; // TrÃ­ch xuáº¥t Ä‘oáº¡n YYYY-MM-DD
          const parts = isoDate.split('-');
          // Äá»‹nh danh dá»¯ liá»‡u vá» Ä‘á»‹nh dáº¡ng NGÃ€Y - THÃNG - NÄ‚M (DD-MM-YYYY)
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

        // Indexability analysis for Googlebot's Eye
        const xRobotsTag = (response.headers.get('x-robots-tag') || '').trim();
        const robotsMetaLower = (robots || '').toLowerCase();
        const xRobotsLower = xRobotsTag.toLowerCase();
        const noindexInMeta = /\bnoindex\b/.test(robotsMetaLower);
        const noindexInHeader = /\bnoindex\b/.test(xRobotsLower);
        let canonicalSelf = false;
        try {
          const canonicalNorm = new URL(canonical || url, url).href.replace(/\/$/, '');
          const finalNorm = new URL(url).href.replace(/\/$/, '');
          canonicalSelf = canonicalNorm === finalNorm;
        } catch {
          canonicalSelf = !canonical || canonical === url;
        }
        let jsRenderedDiff:
          | { titleChanged: boolean; h1Changed: boolean; canonicalChanged: boolean; noindexChanged: boolean }
          | undefined;
        if (renderedMeta) {
          const renderedNoindex = /\bnoindex\b/.test((renderedMeta.robots || '').toLowerCase());
          const renderedCanonical = renderedMeta.canonical || '';
          jsRenderedDiff = {
            titleChanged: (renderedMeta.title || '') !== (title || ''),
            h1Changed: (renderedMeta.h1 || '') !== (h1 || ''),
            canonicalChanged: renderedCanonical !== (canonical || ''),
            noindexChanged: renderedNoindex !== noindexInMeta,
          };
        }
        const indexability = {
          xRobotsTag,
          noindexInMeta,
          noindexInHeader,
          metaRobots: robots,
          canonicalSelf,
          jsRenderedDiff,
        };

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
          linkRows,
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
          indexability,
          status: 'success' 
        };

        // --- Persist to Database (Fire and Forget) ---
        try {
            const pythonEngineUrl = getPythonEngineUrl();
            fetch(`${pythonEngineUrl}/api/seo/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...internalTokenHeaders(),
                },
                body: JSON.stringify(result)
            }).catch(err => logger.error(`Database save failed: ${err}`));
        } catch (e) {}

        return result;
      } catch (error: any) {
        logger.error(`Error scraping ${url}: ${error}`);
        return { 
          url, 
          statusCode: 500,
          title: 'Lá»—i truy cáº­p',
          description: error.message || 'KhÃ´ng thá»ƒ cÃ o dá»¯ liá»‡u tá»« trang nÃ y.',
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
          linkRows: [],
          totalLinks: 0,
          wordCount: 0,
          urlDepth: 0,
          contentType: 'Lá»—i',
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
              message: 'KhÃ´ng thá»ƒ cÃ o dá»¯ liá»‡u tá»« URL nÃ y.',
            },
          ],
          indexability: {
            xRobotsTag: '',
            noindexInMeta: false,
            noindexInHeader: false,
            metaRobots: 'N/A',
            canonicalSelf: false,
            jsRenderedDiff: undefined,
          },
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
