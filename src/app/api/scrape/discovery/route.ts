import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const DEFAULT_MAX_URLS = 1000;
const HARD_MAX_URLS = 5000;

function resolveMaxUrls(input: unknown): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_URLS;
  return Math.min(Math.floor(parsed), HARD_MAX_URLS);
}

async function fetchInternalLinks(homepageUrl: string, maxUrls: number): Promise<string[]> {
  const links = new Set<string>();
  const urlObj = new URL(homepageUrl);
  const baseHostname = urlObj.hostname.replace('www.', '');

  try {
    const res = await fetch(homepageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
      next: { revalidate: 0 }
    });
    
    if (!res.ok) return [homepageUrl];

    const html = await res.text();
    const $ = cheerio.load(html);

    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

        const absoluteUrl = new URL(href, homepageUrl);
        const isInternal = absoluteUrl.hostname.replace('www.', '') === baseHostname;

        if (isInternal) {
          // Normalize: remove hash, remove trailing slash
          let finalUrl = absoluteUrl.origin + absoluteUrl.pathname;
          finalUrl = finalUrl.replace(/\/$/, "");
          if (finalUrl.startsWith('http')) {
             links.add(finalUrl);
             if (links.size >= maxUrls) return false;
          }
        }
      } catch (e) {}
    });

  } catch (err) {
    console.error(`Discovery error for ${homepageUrl}:`, err);
  }

  // Ensure homepage is always in the list
  links.add(homepageUrl.replace(/\/$/, ""));
  
  return Array.from(links).slice(0, maxUrls); // Guard limit
}

async function getLinksFromSitemap(domain: string): Promise<string[]> {
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
  const sitemapPaths = [
    `https://${cleanDomain}/sitemap.xml`,
    `https://${cleanDomain}/sitemap_index.xml`,
    `https://${cleanDomain}/post-sitemap.xml`,
    `https://${cleanDomain}/page-sitemap.xml`,
  ];
  
  const foundUrls = new Set<string>();

  const fetchSitemap = async (url: string, depth = 0): Promise<void> => {
    if (depth > 2) return;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) return;
      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      
      const expectedHost = new URL(url).hostname.replace(/^www\./, '');
      $('loc').each((i, el) => {
        const loc = $(el).text().trim();
        if (loc && loc.startsWith('http')) {
           try {
             const locHost = new URL(loc).hostname.replace(/^www\./, '');
             if (locHost === expectedHost || locHost === cleanDomain) {
               foundUrls.add(loc.replace(/\/$/, ""));
             }
           } catch(e) {}
        }
      });
      
      const subSitemaps: string[] = [];
      $('sitemap loc').each((i, el) => {
        subSitemaps.push($(el).text());
      });

      if (subSitemaps.length > 0) {
        await Promise.all(subSitemaps.map(s => fetchSitemap(s, depth + 1)));
      }
    } catch (e) {}
  };

  await Promise.all(sitemapPaths.map(url => fetchSitemap(url)));
  return Array.from(foundUrls);
}

export async function POST(req: NextRequest) {
  try {
    const { homepageUrl, maxUrls } = await req.json();
    const targetMaxUrls = resolveMaxUrls(maxUrls);

    if (!homepageUrl) {
      return NextResponse.json({ error: 'Missing homepageUrl' }, { status: 400 });
    }

    // Try Sitemap first as it's cleaner
    const sitemapLinks = await getLinksFromSitemap(homepageUrl);
    
    // If few links found via sitemap, crawl the homepage
    let finalLinks = sitemapLinks;
    if (finalLinks.length < 5) {
       const crawledLinks = await fetchInternalLinks(homepageUrl, targetMaxUrls);
       finalLinks = Array.from(new Set([...finalLinks, ...crawledLinks]));
    }

    // Sort to keep homepage at top
    finalLinks.sort((a, b) => a.length - b.length);

    return NextResponse.json({ 
       links: finalLinks.slice(0, targetMaxUrls),
       count: finalLinks.length 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Discovery failed' }, { status: 500 });
  }
}
