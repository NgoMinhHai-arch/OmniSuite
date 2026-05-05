import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

interface SitemapInfo {
  url: string;
  isIndex: boolean;
  urls: SitemapUrl[];
  children: SitemapInfo[];
}

interface SitemapRequest {
  sitemapUrl: string;
}

async function fetchSitemap(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SEO Bot/1.0)",
      Accept: "application/xml,text/xml,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseSitemapWithCheerio(xml: string): SitemapUrl[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls: SitemapUrl[] = [];

  // Find all <url> elements
  $("url").each((_, element) => {
    const urlEl = $(element);
    const loc = urlEl.find("loc").text().trim();
    const lastmod = urlEl.find("lastmod").text().trim() || undefined;
    const changefreq = urlEl.find("changefreq").text().trim() || undefined;
    const priority = urlEl.find("priority").text().trim() || undefined;

    if (loc) {
      urls.push({ loc, lastmod, changefreq, priority });
    }
  });

  return urls;
}

function parseSitemapIndexWithCheerio(xml: string): string[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const sitemapUrls: string[] = [];

  // Find all <sitemap> -> <loc> elements
  $("sitemap loc").each((_, element) => {
    const url = $(element).text().trim();
    if (url) {
      sitemapUrls.push(url);
    }
  });

  return sitemapUrls;
}

function isSitemapIndex(xml: string): boolean {
  return xml.includes("<sitemapindex") || xml.includes("<sitemap>");
}

async function parseSitemap(xml: string, url: string): Promise<SitemapInfo> {
  try {
    // Check if it's a sitemap index
    if (isSitemapIndex(xml)) {
      const sitemapUrls = parseSitemapIndexWithCheerio(xml);

      const children: SitemapInfo[] = [];
      let allUrls: SitemapUrl[] = [];

      // Recursively parse child sitemaps
      for (const sitemapUrl of sitemapUrls.slice(0, 20)) { // Limit to 20 to avoid timeout
        try {
          const childXml = await fetchSitemap(sitemapUrl);
          const childInfo = await parseSitemap(childXml, sitemapUrl);
          children.push(childInfo);
          allUrls = allUrls.concat(childInfo.urls);
        } catch (err) {
          console.error(`Failed to parse child sitemap ${sitemapUrl}:`, err);
        }
      }

      return {
        url,
        isIndex: true,
        urls: allUrls,
        children,
      };
    }

    // Regular URL set sitemap
    const parsedUrls = parseSitemapWithCheerio(xml);

    return {
      url,
      isIndex: false,
      urls: parsedUrls,
      children: [],
    };
  } catch (err) {
    throw new Error(`Failed to parse XML: ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: SitemapRequest = await request.json();
    const { sitemapUrl } = body;

    if (!sitemapUrl || !sitemapUrl.startsWith("http")) {
      return NextResponse.json({ error: "Invalid sitemap URL" }, { status: 400 });
    }

    const xml = await fetchSitemap(sitemapUrl);
    const info = await parseSitemap(xml, sitemapUrl);

    return NextResponse.json(info);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
