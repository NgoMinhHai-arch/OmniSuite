import type { JobListing } from '@/modules/job-support/domain/contracts';
import { serpApiSearch } from '@/lib/seo/serpapi';

export const DEFAULT_VN_JOB_DOMAINS = [
  'vietnamworks.com',
  'topcv.vn',
  'itviec.com',
  'careerlink.vn',
  'careerviet.vn',
  'glints.com',
] as const;

const MAX_SERP_QUERIES_PER_RUN = 20;
const ECO_DEFAULT_MAX_QUERIES = 6;
const ECO_GOAL_RESULTS = 40;
const DETAIL_ENRICH_LIMIT = 12;
const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
const NON_DETAIL_PATH_HINTS = ['/tim-viec', '/viec-lam', '/jobs', '/search', '/job-search', '/danh-sach', '/listing'];
const NON_DETAIL_QUERY_KEYS = ['q', 'query', 'keyword', 'page', 'sort'];

export function parseDomainList(raw: string | undefined, fallback: readonly string[]): string[] {
  if (!raw?.trim()) return [...fallback];
  const parts = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]?.trim())
    .filter(Boolean) as string[];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of parts) {
    const k = d.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(d);
    }
  }
  return out.length ? out : [...fallback];
}

export function normalizeJobLink(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    return u.toString();
  } catch {
    return null;
  }
}

function hostKey(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isLikelyJobDetailTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t) return false;
  const banned = ['hàng ngàn', 'hàng trăm', 'hàng nghìn', 'top công việc'];
  if (banned.some((w) => t.includes(w))) return false;
  return true;
}

function isLikelyJobDetailLink(url: string): boolean {
  const n = normalizeJobLink(url);
  if (!n) return false;
  try {
    const u = new URL(n);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.toLowerCase();
    if (host === 'topcv.vn') {
      // TopCV often uses /viec-lam/<slug> for job detail pages.
      // Reject only known listing/search roots, keep detail-like paths.
      if (/^\/tim-viec-lam\/?$/i.test(path) || /^\/viec-lam\/?$/i.test(path)) return false;
      if (/^\/viec-lam\/[^/]+/i.test(path) || /^\/tin-tuyen-dung\/[^/]+/i.test(path) || /-j\d+/i.test(path)) {
        return true;
      }
    }
    if (NON_DETAIL_PATH_HINTS.some((h) => path.includes(h))) {
      const allow = /-jv\b|\/job\/|\/jobs\/[^/]+-\d+/i.test(path);
      if (!allow) return false;
    }
    const hasSearchQuery = NON_DETAIL_QUERY_KEYS.some((k) => u.searchParams.has(k));
    if (hasSearchQuery && !/jobid|job_id|placement|id|url|redirect/i.test(u.search)) return false;
    return true;
  } catch {
    return false;
  }
}

function pushUnique(map: Map<string, JobListing>, listing: JobListing) {
  const norm = normalizeJobLink(listing.link);
  if (!norm) return;
  const key = `${hostKey(norm)}|${norm.split('?')[0].toLowerCase()}`;
  if (map.has(key)) return;
  map.set(key, { ...listing, link: norm });
}

function organicFromGoogle(data: Record<string, unknown>, sourceLabel: string): JobListing[] {
  const organic = data.organic_results;
  if (!Array.isArray(organic)) return [];
  const rows: JobListing[] = [];
  for (const r of organic as Array<Record<string, unknown>>) {
    const link = typeof r.link === 'string' ? r.link : '';
    const title = typeof r.title === 'string' ? r.title : '';
    const snippet = typeof r.snippet === 'string' ? r.snippet : undefined;
    if (!link || !title) continue;
    if (!isLikelyJobDetailLink(link) || !isLikelyJobDetailTitle(title)) continue;
    rows.push({ title, link, snippet, source: sourceLabel, engine: 'google' });
  }
  return rows;
}

async function tavilySearch(apiKey: string, query: string, maxResults: number): Promise<{ ok: boolean; rows: JobListing[]; error?: string }> {
  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        include_raw_content: false,
        max_results: maxResults,
      }),
      cache: 'no-store',
    });
    const json = (await resp.json().catch(() => null)) as { results?: Array<Record<string, unknown>>; error?: string } | null;
    if (!resp.ok || !json) {
      return { ok: false, rows: [], error: json?.error || `Tavily HTTP ${resp.status}` };
    }
    const results = Array.isArray(json.results) ? json.results : [];
    const rows: JobListing[] = [];
    for (const r of results) {
      const link = typeof r.url === 'string' ? r.url : '';
      const title = typeof r.title === 'string' ? r.title : '';
      const content = typeof r.content === 'string' ? r.content : '';
      if (!link || !title) continue;
      if (!isLikelyJobDetailLink(link) || !isLikelyJobDetailTitle(title)) continue;
      rows.push({
        title,
        link,
        snippet: content.slice(0, 260) || undefined,
        description: content.slice(0, 1200) || undefined,
        source: 'Tavily',
        engine: 'google',
      });
    }
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, rows: [], error: e instanceof Error ? e.message : 'Tavily error' };
  }
}

function jobsFromGoogleJobs(data: Record<string, unknown>): JobListing[] {
  const jobs = data.jobs_results;
  if (!Array.isArray(jobs)) return [];
  const rows: JobListing[] = [];
  for (const j of jobs as Array<Record<string, unknown>>) {
    const title = typeof j.title === 'string' ? j.title : '';
    const company = typeof j.company_name === 'string' ? j.company_name : '';
    const location = typeof j.location === 'string' ? j.location : '';
    const salary = typeof j.salary === 'string' ? j.salary : typeof j.detected_extensions === 'object' && j.detected_extensions ? String((j.detected_extensions as { salary?: string }).salary || '') : '';
    const postedAt =
      typeof j.detected_extensions === 'object' && j.detected_extensions
        ? String((j.detected_extensions as { posted_at?: string }).posted_at || '')
        : '';
    const description = typeof j.description === 'string' ? j.description : '';
    const requirements: string[] = [];
    const benefits: string[] = [];
    if (Array.isArray(j.job_highlights)) {
      for (const section of j.job_highlights as Array<{ title?: string; items?: string[] }>) {
        const title = (section.title || '').toLowerCase();
        const items = Array.isArray(section.items) ? section.items.filter(Boolean) : [];
        if (!items.length) continue;
        if (title.includes('qualification') || title.includes('requirement') || title.includes('yêu cầu')) {
          requirements.push(...items);
        } else if (title.includes('benefit') || title.includes('phúc lợi')) {
          benefits.push(...items);
        }
      }
    }
    let link = '';
    if (Array.isArray(j.apply_options)) {
      const opts = j.apply_options as Array<{ title?: string; link?: string }>;
      const direct = opts.find((o) => (o.link || '').length > 0);
      link = direct?.link || '';
    }
    const relLinks = j.related_links;
    if (!link && Array.isArray(relLinks) && relLinks[0] && typeof relLinks[0] === 'object') {
      const rl = relLinks[0] as { link?: string };
      link = rl.link || '';
    }
    if (!link && typeof j.share_link === 'string') link = j.share_link;
    if (!title || !link) continue;
    if (!isLikelyJobDetailLink(link) || !isLikelyJobDetailTitle(title)) continue;
    rows.push({
      title,
      link,
      snippet: [company, location].filter(Boolean).join(' · '),
      company: company || undefined,
      location: location || undefined,
      salary: salary || undefined,
      postedAt: postedAt || undefined,
      description: description || undefined,
      requirements: requirements.length ? requirements.slice(0, 8) : undefined,
      benefits: benefits.length ? benefits.slice(0, 8) : undefined,
      source: 'Google Jobs',
      engine: 'google_jobs',
    });
  }
  return rows;
}

function extractFirstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ?? match?.[0];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

function inferSalaryFromText(text: string): string | undefined {
  return extractFirstMatch(text, [
    /\d{1,3}(?:[.,]\d{3})+(?:\s*-\s*\d{1,3}(?:[.,]\d{3})+)?\s*(?:VNĐ|VND)/i,
  ]);
}

function inferLocationFromText(text: string): string | undefined {
  return extractFirstMatch(text, [
    /(Hồ Chí Minh|TP\.?\s*HCM|Hà Nội|Đà Nẵng|Bình Dương|Cần Thơ|Hải Phòng|Nha Trang|Remote)/i,
  ]);
}

function inferCompanyFromText(text: string): string | undefined {
  return extractFirstMatch(text, [
    /(?:CÔNG TY|CTY)\s+([^|,\n]{4,120})/i,
    /(?:COMPANY)\s*[:\-]?\s*([^|,\n]{4,120})/i,
  ]);
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function enrichListingFromDetailPage(listing: JobListing): Promise<JobListing> {
  if (listing.company && listing.location && listing.salary) return listing;
  try {
    const response = await fetch(listing.link, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) return listing;
    const html = await response.text();
    const text = stripHtmlTags(html).slice(0, 20000);

    const company =
      listing.company ||
      extractFirstMatch(html, [
        /"hiringOrganization"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i,
        /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
      ]) ||
      inferCompanyFromText(text);
    const location =
      listing.location ||
      extractFirstMatch(html, [
        /"jobLocation"\s*:\s*\{[^}]*"addressLocality"\s*:\s*"([^"]+)"/i,
        /"addressLocality"\s*:\s*"([^"]+)"/i,
      ]) ||
      inferLocationFromText(text);
    const salary =
      listing.salary ||
      extractFirstMatch(html, [
        /"baseSalary"[\s\S]{0,280}?"value"\s*:\s*\{[\s\S]{0,180}?"value"\s*:\s*"?([\d.,]+)"?/i,
      ]) ||
      inferSalaryFromText(text);

    return {
      ...listing,
      company: company || listing.company,
      location: location || listing.location,
      salary: salary || listing.salary,
    };
  } catch {
    return listing;
  }
}

export type VnAggregationInput = {
  serpApiKey?: string;
  tavilyApiKey?: string;
  jobTitle: string;
  location: string;
  /** Domains without site: prefix */
  domains: string[];
  ecoMode?: boolean;
  maxQueries?: number;
};

export async function aggregateVnJobListings(input: VnAggregationInput): Promise<{
  jobs: JobListing[];
  queriesUsed: string[];
  stderrLines: string[];
}> {
  const stderrLines: string[] = [];
  const queriesUsed: string[] = [];
  const byKey = new Map<string, JobListing>();

  const titleQ = input.jobTitle.trim();
  const locQ = input.location.trim();
  const core = [titleQ, locQ].filter(Boolean).join(' ').trim() || 'việc làm';
  const hardCap = Math.max(1, Math.min(MAX_SERP_QUERIES_PER_RUN, Number(input.maxQueries) || MAX_SERP_QUERIES_PER_RUN));
  const requestBudget = input.ecoMode === false ? hardCap : Math.min(hardCap, ECO_DEFAULT_MAX_QUERIES);
  let usedTotal = 0;

  const tavilyBudget = input.tavilyApiKey ? Math.max(1, Math.floor(requestBudget / 2)) : 0;
  const serpBudget = input.serpApiKey ? Math.max(0, requestBudget - tavilyBudget) : 0;

  let usedTavily = 0;
  if (input.tavilyApiKey && tavilyBudget > 0) {
    const tavilyDomains = input.domains.slice(0, tavilyBudget);
    for (const domain of tavilyDomains) {
      const q = `site:${domain} ${core} tuyển dụng`;
      queriesUsed.push(`[tavily] ${q}`);
      usedTavily += 1;
      usedTotal += 1;
      const t = await tavilySearch(input.tavilyApiKey, q, input.ecoMode === false ? 8 : 6);
      if (!t.ok) {
        stderrLines.push(`tavily:${domain}: ${t.error || 'failed'}`);
      } else {
        for (const row of t.rows) pushUnique(byKey, row);
      }
      if (input.ecoMode !== false && byKey.size >= ECO_GOAL_RESULTS) break;
      if (usedTavily >= tavilyBudget || usedTotal >= requestBudget) break;
    }
  }

  const remainingBudget = Math.max(0, requestBudget - usedTotal);
  if (remainingBudget === 0 || byKey.size >= ECO_GOAL_RESULTS) {
    const jobs = [...byKey.values()];
    jobs.sort((a, b) => a.title.localeCompare(b.title));
    return { jobs, queriesUsed, stderrLines };
  }

  if (input.serpApiKey && serpBudget > 0) {
    let usedSerp = 0;
    const gjQuery = `${core} vietnam`;
    queriesUsed.push(`[serpapi:google_jobs] ${gjQuery}`);
    usedSerp += 1;
    usedTotal += 1;
    let gj = await serpApiSearch(input.serpApiKey, {
      query: gjQuery,
      engine: 'google_jobs',
      hl: 'vi',
      gl: 'vn',
      num: input.ecoMode === false ? 30 : 16,
      location: locQ ? `${locQ}, Vietnam` : 'Vietnam',
    });
    if (!gj.ok && /unsupported .*location parameter/i.test(gj.error || '')) {
      // Some SerpApi accounts reject specific VN city spellings (e.g. diacritics).
      // Retry once without location parameter to avoid zero-result runs.
      stderrLines.push(`serpapi:google_jobs: retry_without_location (${gj.error || 'unsupported location'})`);
      gj = await serpApiSearch(input.serpApiKey, {
        query: gjQuery,
        engine: 'google_jobs',
        hl: 'vi',
        gl: 'vn',
        num: input.ecoMode === false ? 30 : 16,
      });
    }
    if (!gj.ok) {
      stderrLines.push(`serpapi:google_jobs: ${gj.error || 'failed'}`);
    } else if (gj.data) {
      for (const row of jobsFromGoogleJobs(gj.data)) pushUnique(byKey, row);
    }

    const serpRemaining = Math.max(0, Math.min(remainingBudget, serpBudget) - usedSerp);
    const needMore = Math.max(0, ECO_GOAL_RESULTS - byKey.size);
    const adaptiveSiteBudget = input.ecoMode === false ? serpRemaining : Math.min(serpRemaining, Math.max(1, Math.ceil(needMore / 10)));
    const domainsSlice = input.domains.slice(0, Math.max(0, adaptiveSiteBudget));
    for (const domain of domainsSlice) {
      const q = `site:${domain} ${core}`;
      queriesUsed.push(`[serpapi:google] ${q}`);
      usedSerp += 1;
      usedTotal += 1;
      const res = await serpApiSearch(input.serpApiKey, {
        query: q,
        engine: 'google',
        hl: 'vi',
        gl: 'vn',
        num: input.ecoMode === false ? 15 : 10,
        location: 'Vietnam',
      });
      if (!res.ok) {
        stderrLines.push(`serpapi:${domain}: ${res.error || 'failed'}`);
        continue;
      }
      if (res.data) {
        for (const row of organicFromGoogle(res.data, domain)) pushUnique(byKey, row);
      }
      if (input.ecoMode !== false && byKey.size >= ECO_GOAL_RESULTS) break;
      if (usedSerp >= serpBudget || usedTotal >= requestBudget) break;
    }
  }

  const jobs = [...byKey.values()];
  const missingCoreFields = jobs.filter((job) => !job.company || !job.location || !job.salary);
  const enrichTargets = missingCoreFields.slice(0, DETAIL_ENRICH_LIMIT);
  if (enrichTargets.length > 0) {
    const enriched = await Promise.all(enrichTargets.map((job) => enrichListingFromDetailPage(job)));
    for (const job of enriched) {
      const norm = normalizeJobLink(job.link);
      if (!norm) continue;
      const key = `${hostKey(norm)}|${norm.split('?')[0].toLowerCase()}`;
      const existing = byKey.get(key);
      if (!existing) continue;
      byKey.set(key, {
        ...existing,
        company: job.company || existing.company,
        location: job.location || existing.location,
        salary: job.salary || existing.salary,
      });
    }
  }

  const mergedJobs = [...byKey.values()];
  mergedJobs.sort((a, b) => a.title.localeCompare(b.title));
  return { jobs: mergedJobs, queriesUsed, stderrLines };
}
