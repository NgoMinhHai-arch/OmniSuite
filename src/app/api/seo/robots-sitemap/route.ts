import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const AI_BOT_NAMES = [
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'CCBot',
  'anthropic-ai',
  'PerplexityBot',
];

const CACHE_TTL_MS = 5 * 60 * 1000;
const SITEMAP_FETCH_LIMIT = 250 * 1024;
const SITEMAP_URL_SAMPLE = 50;
const SITEMAP_URL_HARD_CAP = 5000;

type RobotsBlock = {
  userAgents: string[];
  allow: string[];
  disallow: string[];
  crawlDelay: number | null;
};

type RobotsParsed = {
  blocks: RobotsBlock[];
  sitemapRefs: string[];
};

type RobotsSitemapPayload = {
  domain: string;
  robots: {
    exists: boolean;
    statusCode: number;
    sitemapRefs: string[];
    crawlDelay: number | null;
    blocksGooglebot: boolean;
    blocksAiBots: { name: string; blocked: boolean }[];
    raw: string;
  };
  sitemap: {
    found: boolean;
    url: string | null;
    statusCode: number;
    urlCount: number;
    domainMismatchCount: number;
    sampleUrls: string[];
    urls: string[];
  };
};

const cache = new Map<string, { expires: number; data: RobotsSitemapPayload }>();

function normalizeDomain(input: string): string | null {
  const candidate = input.trim();
  if (!candidate) return null;
  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
  try {
    const parsed = new URL(withProtocol);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

async function fetchText(url: string, maxBytes?: number): Promise<{ status: number; text: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OmniSuiteBot/1.0; +https://omnisuite.local)',
        Accept: 'text/plain, application/xml, text/xml, */*',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    const text = await res.text();
    if (maxBytes && text.length > maxBytes) {
      return { status: res.status, text: text.slice(0, maxBytes) };
    }
    return { status: res.status, text };
  } catch {
    return { status: 0, text: '' };
  }
}

function parseRobots(raw: string): RobotsParsed {
  const blocks: RobotsBlock[] = [];
  const sitemapRefs: string[] = [];

  let current: RobotsBlock | null = null;
  const lines = raw.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();
    if (!value && key !== 'user-agent') continue;

    if (key === 'sitemap') {
      sitemapRefs.push(value);
      continue;
    }

    if (key === 'user-agent') {
      if (!current || current.allow.length || current.disallow.length || current.crawlDelay !== null) {
        current = { userAgents: [value], allow: [], disallow: [], crawlDelay: null };
        blocks.push(current);
      } else {
        current.userAgents.push(value);
      }
      continue;
    }

    if (!current) {
      current = { userAgents: ['*'], allow: [], disallow: [], crawlDelay: null };
      blocks.push(current);
    }

    if (key === 'allow') current.allow.push(value);
    else if (key === 'disallow') current.disallow.push(value);
    else if (key === 'crawl-delay') {
      const num = Number(value);
      if (!Number.isNaN(num)) current.crawlDelay = num;
    }
  }

  return { blocks, sitemapRefs };
}

function rulesForUserAgent(parsed: RobotsParsed, ua: string): RobotsBlock {
  const lower = ua.toLowerCase();
  const exact = parsed.blocks.find((b) => b.userAgents.some((u) => u.toLowerCase() === lower));
  if (exact) return exact;
  const wildcard = parsed.blocks.find((b) => b.userAgents.some((u) => u === '*'));
  return wildcard || { userAgents: ['*'], allow: [], disallow: [], crawlDelay: null };
}

function isPathBlocked(parsed: RobotsParsed, ua: string, pathname: string): boolean {
  const block = rulesForUserAgent(parsed, ua);
  if (!block.disallow.length) return false;
  const matchesAllow = block.allow.some((p) => p && pathname.startsWith(p));
  if (matchesAllow) return false;
  return block.disallow.some((p) => p === '/' || (p && pathname.startsWith(p)));
}

function isUserAgentBlockedAtRoot(parsed: RobotsParsed, ua: string): boolean {
  const block = rulesForUserAgent(parsed, ua);
  if (block.disallow.includes('/')) return true;
  return false;
}

async function discoverSitemap(domain: string, robots: RobotsParsed): Promise<{ url: string | null; status: number; text: string }> {
  if (robots.sitemapRefs.length) {
    for (const ref of robots.sitemapRefs) {
      const r = await fetchText(ref, SITEMAP_FETCH_LIMIT);
      if (r.status === 200 && r.text) return { url: ref, status: r.status, text: r.text };
    }
  }
  const fallback = `${domain}/sitemap.xml`;
  const r = await fetchText(fallback, SITEMAP_FETCH_LIMIT);
  return { url: r.status === 200 ? fallback : null, status: r.status, text: r.text };
}

function extractLocs(xml: string): string[] {
  try {
    const $ = cheerio.load(xml, { xmlMode: true });
    const out: string[] = [];
    $('loc').each((_, el) => {
      const text = $(el).text().trim();
      if (text) out.push(text);
      if (out.length >= SITEMAP_URL_HARD_CAP) return false;
    });
    return out;
  } catch {
    return [];
  }
}

async function expandSitemapIndex(xml: string, baseDomainHost: string): Promise<string[]> {
  try {
    const $ = cheerio.load(xml, { xmlMode: true });
    if (!$('sitemapindex').length) return extractLocs(xml);
    const childSitemaps: string[] = [];
    $('sitemap > loc').each((_, el) => {
      const text = $(el).text().trim();
      if (text) childSitemaps.push(text);
    });
    const aggregated: string[] = [];
    for (const child of childSitemaps.slice(0, 10)) {
      try {
        const childHost = new URL(child).hostname;
        if (!childHost.endsWith(baseDomainHost)) continue;
      } catch {
        continue;
      }
      const r = await fetchText(child, SITEMAP_FETCH_LIMIT);
      if (r.status === 200 && r.text) {
        aggregated.push(...extractLocs(r.text));
        if (aggregated.length >= SITEMAP_URL_HARD_CAP) break;
      }
    }
    return aggregated;
  } catch {
    return [];
  }
}

async function buildPayload(domain: string): Promise<RobotsSitemapPayload> {
  const robotsRes = await fetchText(`${domain}/robots.txt`, SITEMAP_FETCH_LIMIT);
  const robotsExists = robotsRes.status === 200 && /user-agent|disallow|allow|sitemap/i.test(robotsRes.text);
  const parsed = parseRobots(robotsRes.text);

  const blocksAiBots = AI_BOT_NAMES.map((name) => ({
    name,
    blocked: isUserAgentBlockedAtRoot(parsed, name) || isPathBlocked(parsed, name, '/'),
  }));
  const blocksGooglebot = isUserAgentBlockedAtRoot(parsed, 'Googlebot');

  const wildcardBlock = parsed.blocks.find((b) => b.userAgents.includes('*')) || null;
  const crawlDelay = wildcardBlock?.crawlDelay ?? null;

  const baseHost = new URL(domain).hostname;
  const sitemapPick = robotsExists ? await discoverSitemap(domain, parsed) : { url: null, status: 0, text: '' };

  let allUrls: string[] = [];
  if (sitemapPick.text) {
    const expanded = await expandSitemapIndex(sitemapPick.text, baseHost);
    allUrls = expanded.length ? expanded : extractLocs(sitemapPick.text);
  }

  const domainMismatchCount = allUrls.reduce((acc, u) => {
    try {
      const h = new URL(u).hostname;
      return acc + (h.endsWith(baseHost) ? 0 : 1);
    } catch {
      return acc;
    }
  }, 0);

  return {
    domain,
    robots: {
      exists: robotsExists,
      statusCode: robotsRes.status,
      sitemapRefs: parsed.sitemapRefs,
      crawlDelay,
      blocksGooglebot,
      blocksAiBots,
      raw: robotsRes.text.slice(0, 5 * 1024),
    },
    sitemap: {
      found: !!sitemapPick.url,
      url: sitemapPick.url,
      statusCode: sitemapPick.status,
      urlCount: allUrls.length,
      domainMismatchCount,
      sampleUrls: allUrls.slice(0, SITEMAP_URL_SAMPLE),
      urls: allUrls,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const { domain: rawDomain } = (await req.json()) as { domain?: string };
    const domain = normalizeDomain(rawDomain || '');
    if (!domain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 });
    }

    const cached = cache.get(domain);
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json(cached.data);
    }

    const data = await buildPayload(domain);
    cache.set(domain, { expires: Date.now() + CACHE_TTL_MS, data });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'unexpected error' }, { status: 500 });
  }
}
