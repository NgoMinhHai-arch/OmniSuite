import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface ExtractRequest {
  url: string;
  timeout?: number;
  userAgent?: string;
  includeMeta?: boolean;
  includeOG?: boolean;
}

interface ExtractResponse {
  success: boolean;
  title: string | null;
  h1: string | null;
  content: string | null;
  contentLength: number;
  wordCount: number;
  metaDescription: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  error?: string;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ExtractRequest = await request.json();
    const { url, timeout = 10, userAgent, includeMeta = true, includeOG = true } = body;

    if (!url || !url.startsWith("http")) {
      return NextResponse.json(
        { success: false, error: "Invalid URL" },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          userAgent ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        },
        { status: 500 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script, style, nav, footer, header
    $("script, style, nav, footer, header, aside, [role='complementary']").remove();

    // Extract title
    const title = $("title").text().trim() || null;

    // Extract H1
    const h1 = $("h1").first().text().trim() || null;

    // Extract meta description
    const metaDescription = includeMeta
      ? $("meta[name='description']").attr("content") ||
        $("meta[property='og:description']").attr("content") ||
        null
      : null;

    // Extract canonical
    const canonical = $("link[rel='canonical']").attr("href") || null;

    // Extract Open Graph
    const ogTitle = includeOG ? $("meta[property='og:title']").attr("content") || null : null;
    const ogDescription = includeOG
      ? $("meta[property='og:description']").attr("content") || null
      : null;

    // Extract main content
    // Try to find main content areas
    let content = "";

    // Look for common content containers
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
      if (element.length && element.text().trim().length > 100) {
        content = element.text();
        break;
      }
    }

    // Fallback to body if no content container found
    if (!content) {
      content = $("body").text();
    }

    // Clean content
    content = cleanText(content);
    const contentLength = content.length;
    const wordCount = countWords(content);

    const result: ExtractResponse = {
      success: true,
      title,
      h1,
      content: content.substring(0, 5000), // Limit content to 5000 chars
      contentLength,
      wordCount,
      metaDescription,
      canonical,
      ogTitle,
      ogDescription,
    };

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
