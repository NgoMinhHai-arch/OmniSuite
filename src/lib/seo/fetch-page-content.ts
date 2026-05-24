import * as cheerio from "cheerio";

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\n+/g, "\n").trim();
}

export type FetchPageResult =
  | { ok: true; url: string; title: string | null; h1: string | null; text: string; html: string }
  | { ok: false; url: string; error: string };

export async function fetchPageMainText(
  url: string,
  timeoutSec = 12
): Promise<FetchPageResult> {
  if (!url?.startsWith("http")) {
    return { ok: false, url, error: "URL không hợp lệ" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSec * 1000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.8,vi;q=0.6",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { ok: false, url, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header, aside, [role='complementary']").remove();

    const title = $("title").first().text().trim() || null;
    const h1 = $("h1").first().text().trim() || null;

    let content = "";
    const contentSelectors = [
      "main",
      "article",
      "[role='main']",
      ".content",
      ".main-content",
      "#content",
      "#main-content",
      ".post-content",
      ".entry-content",
      ".article-content",
    ];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 80) {
        content = element.text();
        break;
      }
    }

    if (!content) {
      content = $("body").text();
    }

    const text = cleanText(content);

    return { ok: true, url, title, h1, text, html };
  } catch (e) {
    clearTimeout(timeoutId);
    const msg = e instanceof Error ? e.message : "Lỗi không xác định";
    return { ok: false, url, error: msg };
  }
}

export function pageAlreadyLinksTo(html: string, targetUrl: string): boolean {
  try {
    const u = new URL(targetUrl);
    const patterns = [targetUrl, u.pathname + u.search, u.pathname];
    const lower = html.toLowerCase();
    return patterns.some((p) => p && lower.includes(p.toLowerCase().replace(/&/g, "&amp;")));
  } catch {
    return html.includes(targetUrl);
  }
}

export function pickSentenceWithKeyword(text: string, keyword: string, maxLen = 280): string {
  const lower = text.toLowerCase();
  const kw = keyword.trim().toLowerCase();
  if (!kw) return text.slice(0, maxLen);

  const idx = lower.indexOf(kw);
  if (idx === -1) {
    return text.slice(0, maxLen);
  }

  const start = Math.max(0, idx - 80);
  const chunk = text.slice(start, start + maxLen);
  return chunk.trim();
}
