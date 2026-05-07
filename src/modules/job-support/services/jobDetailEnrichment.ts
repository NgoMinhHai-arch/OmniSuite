import { serpApiSearch } from '@/lib/seo/serpapi';
import type { JobDetailCostMode, JobDetailEnrichment, JobDetailStrategy } from '@/modules/job-support/domain/contracts';
import { normalizeJobLink } from '@/modules/job-support/services/vnJobSerpAggregation';

type EnrichInput = {
  link: string;
  title?: string;
  costMode: JobDetailCostMode;
  serpApiKey?: string;
  tavilyApiKey?: string;
};

type EnrichAttempt = {
  ok: boolean;
  detail?: Partial<JobDetailEnrichment>;
  strategy: JobDetailStrategy;
  error?: string;
  creditsUsed: number;
};

type EnrichOutput = {
  ok: boolean;
  detail?: JobDetailEnrichment;
  strategyUsed?: JobDetailStrategy;
  fallbackUsed?: boolean;
  creditsEstimate?: number;
  error?: string;
  hint?: string;
};

const MAX_HTML_CHARS = 60000;
const MAX_FIELD_CHARS = 2800;
const MAX_LIST_ITEMS = 10;

export async function enrichJobDetail(input: EnrichInput): Promise<EnrichOutput> {
  const normalized = normalizeJobLink(input.link);
  if (!normalized) {
    return { ok: false, error: 'Link job không hợp lệ.', hint: 'Kiểm tra URL trước khi lấy chi tiết.' };
  }

  const steps = strategyOrder(input.costMode);
  let totalCredits = 0;
  let firstError = '';
  let succeededStrategy: JobDetailStrategy | undefined;
  let usedFallback = false;

  for (let idx = 0; idx < steps.length; idx += 1) {
    const strategy = steps[idx];
    const attempt = await runStrategy(strategy, {
      ...input,
      link: normalized,
    });
    totalCredits += attempt.creditsUsed;
    if (!attempt.ok) {
      if (!firstError && attempt.error) firstError = attempt.error;
      continue;
    }
    const normalizedDetail = normalizeDetail(attempt.detail, strategy);
    if (hasUsefulDetail(normalizedDetail)) {
      succeededStrategy = strategy;
      usedFallback = idx > 0;
      return {
        ok: true,
        detail: normalizedDetail,
        strategyUsed: succeededStrategy,
        fallbackUsed: usedFallback,
        creditsEstimate: totalCredits,
      };
    }
  }

  return {
    ok: false,
    error: firstError || 'Không lấy được chi tiết từ nguồn hiện có.',
    hint: 'Thử đổi chế độ chi phí hoặc mở job gốc để xem đầy đủ nội dung.',
    creditsEstimate: totalCredits,
  };
}

function strategyOrder(mode: JobDetailCostMode): JobDetailStrategy[] {
  if (mode === 'paid_priority') return ['tavily', 'serpapi', 'free_fetch'];
  if (mode === 'free_then_paid') return ['free_fetch', 'tavily', 'serpapi'];
  return ['free_fetch'];
}

async function runStrategy(strategy: JobDetailStrategy, input: EnrichInput): Promise<EnrichAttempt> {
  if (strategy === 'free_fetch') return freeFetchStrategy(input.link);
  if (strategy === 'tavily') return tavilyStrategy(input);
  return serpStrategy(input);
}

async function freeFetchStrategy(url: string): Promise<EnrichAttempt> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OmniSuiteBot/1.0; +https://omnisuite.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!resp.ok) {
      return { ok: false, strategy: 'free_fetch', error: `Fetch job URL thất bại (${resp.status}).`, creditsUsed: 0 };
    }
    const html = await resp.text();
    const parsed = parseHtmlSignals(html);
    return {
      ok: true,
      strategy: 'free_fetch',
      detail: {
        description: parsed.description,
        requirements: parsed.requirements,
        benefits: parsed.benefits,
      },
      creditsUsed: 0,
    };
  } catch (error) {
    return {
      ok: false,
      strategy: 'free_fetch',
      error: error instanceof Error ? error.message : 'Fetch chi tiết thất bại.',
      creditsUsed: 0,
    };
  }
}

async function tavilyStrategy(input: EnrichInput): Promise<EnrichAttempt> {
  if (!input.tavilyApiKey) {
    return { ok: false, strategy: 'tavily', error: 'Thiếu Tavily key.', creditsUsed: 0 };
  }
  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: input.tavilyApiKey,
        query: `job detail ${input.title || ''} ${input.link}`.trim(),
        max_results: 3,
        include_raw_content: true,
        search_depth: 'basic',
      }),
      cache: 'no-store',
    });
    const json = (await resp.json().catch(() => null)) as { results?: Array<Record<string, unknown>>; error?: string } | null;
    if (!resp.ok || !json) {
      return { ok: false, strategy: 'tavily', error: json?.error || `Tavily HTTP ${resp.status}`, creditsUsed: 1 };
    }
    const rows = Array.isArray(json.results) ? json.results : [];
    const best = rows.find((r) => typeof r.url === 'string' && normalizeJobLink(String(r.url)) === input.link) || rows[0];
    if (!best) return { ok: false, strategy: 'tavily', error: 'Tavily không trả dữ liệu phù hợp.', creditsUsed: 1 };
    const raw = `${String(best.raw_content || '')}\n${String(best.content || '')}`;
    const parsed = parseTextSignals(raw);
    return {
      ok: true,
      strategy: 'tavily',
      detail: {
        description: parsed.description,
        requirements: parsed.requirements,
        benefits: parsed.benefits,
      },
      creditsUsed: 1,
    };
  } catch (error) {
    return {
      ok: false,
      strategy: 'tavily',
      error: error instanceof Error ? error.message : 'Tavily lỗi.',
      creditsUsed: 1,
    };
  }
}

async function serpStrategy(input: EnrichInput): Promise<EnrichAttempt> {
  if (!input.serpApiKey) {
    return { ok: false, strategy: 'serpapi', error: 'Thiếu SerpApi key.', creditsUsed: 0 };
  }
  const query = `${input.title || ''} ${input.link}`.trim();
  const res = await serpApiSearch(input.serpApiKey, { query, engine: 'google', hl: 'vi', gl: 'vn', num: 5 });
  if (!res.ok || !res.data) {
    return { ok: false, strategy: 'serpapi', error: res.error || 'SerpApi lỗi.', creditsUsed: 1 };
  }
  const snippets = collectSerpSnippets(res.data);
  const parsed = parseTextSignals(snippets.join('\n'));
  return {
    ok: true,
    strategy: 'serpapi',
    detail: {
      description: parsed.description,
      requirements: parsed.requirements,
      benefits: parsed.benefits,
    },
    creditsUsed: 1,
  };
}

function collectSerpSnippets(data: Record<string, unknown>): string[] {
  const out: string[] = [];
  const organic = data.organic_results;
  if (Array.isArray(organic)) {
    for (const row of organic as Array<Record<string, unknown>>) {
      const text = `${String(row.title || '')}\n${String(row.snippet || '')}`.trim();
      if (text) out.push(text);
    }
  }
  const answerBox = data.answer_box;
  if (answerBox && typeof answerBox === 'object') {
    const ab = answerBox as Record<string, unknown>;
    const text = `${String(ab.title || '')}\n${String(ab.snippet || '')}\n${String(ab.answer || '')}`.trim();
    if (text) out.push(text);
  }
  return out;
}

function parseHtmlSignals(html: string): { description?: string; requirements?: string[]; benefits?: string[] } {
  const structured = parseJobPostingFromHtml(html);
  if (structured.description || (structured.requirements && structured.requirements.length > 0) || (structured.benefits && structured.benefits.length > 0)) {
    return structured;
  }
  const text = stripHtml(html).slice(0, MAX_HTML_CHARS);
  return parseTextSignals(text);
}

function parseJobPostingFromHtml(html: string): { description?: string; requirements?: string[]; benefits?: string[] } {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (blocks.length === 0) return {};
  for (const block of blocks) {
    const raw = (block[1] || '').trim();
    if (!raw) continue;
    const parsed = safeJson(raw);
    const postings = collectJobPostingNodes(parsed);
    for (const node of postings) {
      const descriptionRaw = firstString(node, ['description', 'responsibilities']);
      const qualificationsRaw = firstString(node, ['qualifications', 'experienceRequirements', 'skills']);
      const benefitsRaw = firstString(node, ['jobBenefits', 'incentiveCompensation', 'benefits']);
      const description = normalizeWhitespace(stripHtml(descriptionRaw || '')).slice(0, MAX_FIELD_CHARS);
      const requirements = toList(qualificationsRaw);
      const benefits = toList(benefitsRaw);
      if (description || requirements.length || benefits.length) {
        return {
          description: description || undefined,
          requirements: requirements.length ? requirements : undefined,
          benefits: benefits.length ? benefits : undefined,
        };
      }
    }
  }
  return {};
}

function parseTextSignals(raw: string): { description?: string; requirements?: string[]; benefits?: string[] } {
  const compact = normalizeWhitespace(raw);
  if (!compact) return {};

  const requirements = extractSectionList(compact, ['yêu cầu', 'requirements', 'qualification', 'kỹ năng']);
  const benefits = extractSectionList(compact, ['phúc lợi', 'benefits', 'quyền lợi', 'đãi ngộ']);
  const description = compact.slice(0, MAX_FIELD_CHARS);

  return {
    description: description || undefined,
    requirements: requirements.length ? requirements : undefined,
    benefits: benefits.length ? benefits : undefined,
  };
}

function extractSectionList(text: string, keywords: string[]): string[] {
  const lowered = text.toLowerCase();
  const index = keywords.map((k) => lowered.indexOf(k)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (typeof index !== 'number') return [];
  const slice = text.slice(index, Math.min(text.length, index + 1600));
  const parts = slice
    .split(/[\n\r•·\-]+/g)
    .map((x) => x.trim())
    .filter((x) => x.length > 12 && x.length < 220);
  return dedupe(parts).slice(0, MAX_LIST_ITEMS);
}

function normalizeDetail(detail: Partial<JobDetailEnrichment> | undefined, strategy: JobDetailStrategy): JobDetailEnrichment {
  return {
    description: detail?.description ? truncate(detail.description, MAX_FIELD_CHARS) : undefined,
    requirements: Array.isArray(detail?.requirements) ? detail.requirements.map((x) => x.trim()).filter(Boolean).slice(0, MAX_LIST_ITEMS) : undefined,
    benefits: Array.isArray(detail?.benefits) ? detail.benefits.map((x) => x.trim()).filter(Boolean).slice(0, MAX_LIST_ITEMS) : undefined,
    source: strategy,
    updatedAt: new Date().toISOString(),
  };
}

function hasUsefulDetail(detail: JobDetailEnrichment): boolean {
  return Boolean(detail.description || (detail.requirements && detail.requirements.length > 0) || (detail.benefits && detail.benefits.length > 0));
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function collectJobPostingNodes(input: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    const t = obj['@type'];
    const types = Array.isArray(t) ? t.map((x) => String(x).toLowerCase()) : [String(t || '').toLowerCase()];
    if (types.includes('jobposting')) out.push(obj);
    if (obj['@graph']) walk(obj['@graph']);
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') walk(value);
    }
  };
  walk(input);
  return out;
}

function firstString(node: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = node[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function toList(raw?: string): string[] {
  if (!raw) return [];
  return dedupe(
    stripHtml(raw)
      .split(/[\n\r•·\-]+/g)
      .map((x) => normalizeWhitespace(x))
      .filter((x) => x.length >= 8 && x.length <= 220),
  ).slice(0, MAX_LIST_ITEMS);
}

function truncate(input: string, max: number): string {
  return input.length <= max ? input : `${input.slice(0, max - 1)}…`;
}
