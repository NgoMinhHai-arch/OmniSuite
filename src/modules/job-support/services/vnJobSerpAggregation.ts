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

const MAX_SERP_QUERIES_PER_RUN = 10;
const ECO_DEFAULT_MAX_QUERIES = 4;
const ECO_GOAL_RESULTS = 24;
const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];

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
    if (link && title) rows.push({ title, link, snippet, source: sourceLabel, engine: 'google' });
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
    const gj = await serpApiSearch(input.serpApiKey, {
      query: gjQuery,
      engine: 'google_jobs',
      hl: 'vi',
      gl: 'vn',
      num: input.ecoMode === false ? 20 : 12,
      location: locQ ? `${locQ}, Vietnam` : 'Vietnam',
    });
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
  jobs.sort((a, b) => a.title.localeCompare(b.title));
  return { jobs, queriesUsed, stderrLines };
}
