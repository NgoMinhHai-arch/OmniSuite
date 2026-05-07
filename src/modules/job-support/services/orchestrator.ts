import path from 'node:path';
import { promises as fs } from 'node:fs';
import type {
  JobListing,
  JobSupportApiResponse,
  JobSupportErrorCode,
  JobSupportRequest,
  JobSupportRunResult,
  JobWorkspace,
} from '@/modules/job-support/domain/contracts';
import type { JobSupportAdapter } from '@/modules/job-support/services/adapters/baseAdapter';
import { AiResumeTailorAdapter } from '@/modules/job-support/services/adapters/aiResumeTailorAdapter';
import { ManualApplyAdapter, parseApplyJobUrls } from '@/modules/job-support/services/adapters/manualApplyAdapter';
import { VnJobsSerpAdapter, resolveSerpApiKey, resolveTavilyKey } from '@/modules/job-support/services/adapters/vnJobsSerpAdapter';
import { integrationPath } from '@/modules/job-support/services/adapters/fsUtils';
import { mergeConfig } from '@/shared/lib/config';

type ApplyRateState = { day: string; count: number };

const TMP_DIR = path.join(process.cwd(), '.tmp', 'job-support-bridge');
const LAST_RUN_FILE = path.join(TMP_DIR, 'last-run.json');
const RATE_FILE = path.join(TMP_DIR, 'apply-rate-limit.json');
const MAX_APPLY_PER_DAY = 20;
const DEFAULT_JOBOPS_BASE_URL = 'http://127.0.0.1:3001';
const LOCAL_CRAWL_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readRateState(): Promise<ApplyRateState> {
  try {
    const raw = await fs.readFile(RATE_FILE, 'utf-8');
    return JSON.parse(raw) as ApplyRateState;
  } catch {
    return { day: todayKey(), count: 0 };
  }
}

async function writeRateState(state: ApplyRateState): Promise<void> {
  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.writeFile(RATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function adapterFor(workspace: JobWorkspace): JobSupportAdapter {
  if (workspace === 'tailor-cv') return new AiResumeTailorAdapter();
  if (workspace === 'find-jobs') return new VnJobsSerpAdapter();
  return new ManualApplyAdapter();
}

function validateInput(req: JobSupportRequest): { ok: true } | { ok: false; code: JobSupportErrorCode; error: string; hint: string } {
  if (req.workspace === 'find-jobs' && !(req.jobTitle || req.location || req.searchUrl || req.jobUrl)) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Thiếu tiêu chí tìm việc',
      hint: 'Nhập ít nhất Vị trí mục tiêu hoặc Địa điểm trước khi chạy để tránh tốn credit SerpApi vô ích.',
    };
  }
  if (req.workspace === 'tailor-cv' && !(req.jdText || req.jobUrl)) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Thiếu JD để tailor CV',
      hint: 'Cần JD text hoặc Job URL trước khi chạy Tailor CV.',
    };
  }
  if (req.workspace === 'auto-apply') {
    const urls = parseApplyJobUrls(req);
    if (urls.length === 0) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        error: 'Chưa có link ứng tuyển',
        hint: 'Dán ít nhất một URL vào ô “Link ứng tuyển” (hoặc mỗi dòng một link).',
      };
    }
  }
  if (req.workspace === 'auto-apply' && req.mode === 'live' && !req.approved) {
    return {
      ok: false,
      code: 'MISSING_APPROVAL',
      error: 'Live batch chưa được duyệt',
      hint: 'Bật xác nhận (approved=true). Server không mở trình duyệt — bạn vẫn mở link và nộp tay trên máy.',
    };
  }
  return { ok: true };
}

async function enforceApplyRateLimit(req: JobSupportRequest): Promise<{ ok: true } | { ok: false; error: string; code: JobSupportErrorCode; hint: string }> {
  if (req.workspace !== 'auto-apply' || req.mode !== 'live') return { ok: true };
  const state = await readRateState();
  const day = todayKey();
  const normalized = state.day === day ? state : { day, count: 0 };
  if (normalized.count >= MAX_APPLY_PER_DAY) {
    return {
      ok: false,
      code: 'RATE_LIMITED',
      error: 'Đã chạm giới hạn xác nhận batch trong ngày',
      hint: `Giới hạn hiện tại là ${MAX_APPLY_PER_DAY} lần live batch/ngày. Thử lại ngày mai hoặc dùng dry-run.`,
    };
  }
  await writeRateState({ day, count: normalized.count + 1 });
  return { ok: true };
}

async function saveLastRun(output: JobSupportRunResult): Promise<void> {
  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.writeFile(LAST_RUN_FILE, JSON.stringify(output, null, 2), 'utf-8');
}

function parsePositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeCandidateUrl(rawHref: string, baseUrl: string): string | null {
  try {
    const absolute = new URL(rawHref, baseUrl);
    if (!/^https?:$/i.test(absolute.protocol)) return null;
    return absolute.toString();
  } catch {
    return null;
  }
}

function isLikelyJobDetailUrl(url: string): boolean {
  return /\/(viec-lam|jobs?|job)\//i.test(url) || /-j\d+|jobid=|job_id=|\/jv\//i.test(url);
}

function isTopcvHost(hostname: string): boolean {
  return hostname.replace(/^www\./i, '').toLowerCase() === 'topcv.vn';
}

function isLikelyTopcvJobDetailUrl(url: URL): boolean {
  if (!isTopcvHost(url.hostname)) return false;
  const pathname = url.pathname.toLowerCase();
  if (/^\/tim-viec-lam\/?$/i.test(pathname) || /^\/viec-lam\/?$/i.test(pathname)) return false;
  return (
    /^\/viec-lam\/.+/i.test(pathname) ||
    /^\/tin-tuyen-dung\/.+/i.test(pathname) ||
    /\/(chi-tiet|detail)-?viec/i.test(pathname) ||
    /-j\d+/i.test(pathname)
  );
}

function deriveListingTitleFromUrl(url: URL): string {
  const slug = url.pathname.split('/').filter(Boolean).pop() || '';
  if (!slug) return 'Tin tuyển dụng';
  const cleaned = slug
    .replace(/\.(html|htm)$/i, '')
    .replace(/-j\d+$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (!cleaned) return 'Tin tuyển dụng';
  return cleaned
    .split(' ')
    .filter(Boolean)
    .slice(0, 16)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function collectJsonLdListings(args: { html: string; pageUrl: string }): JobListing[] {
  const results: JobListing[] = [];
  const seen = new Set<string>();
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  const enqueue = (rawUrl: string | undefined, title: string | undefined, company: string | undefined) => {
    if (!rawUrl) return;
    const link = normalizeCandidateUrl(rawUrl, args.pageUrl);
    if (!link || seen.has(link)) return;
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      return;
    }
    if (!isLikelyJobDetailUrl(link) && !isLikelyTopcvJobDetailUrl(parsed)) return;
    seen.add(link);
    results.push({
      title: (title || '').trim() || deriveListingTitleFromUrl(parsed),
      link,
      source: parsed.hostname.replace(/^www\./i, ''),
      company: (company || '').trim() || undefined,
    });
  };

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const entry of node) walk(entry);
      return;
    }
    const record = node as Record<string, unknown>;
    const type = String(record['@type'] || '').toLowerCase();
    if (type.includes('jobposting')) {
      const hiringOrg = record.hiringOrganization as Record<string, unknown> | undefined;
      const company = typeof hiringOrg?.name === 'string' ? hiringOrg.name : undefined;
      enqueue(
        typeof record.url === 'string' ? record.url : undefined,
        typeof record.title === 'string' ? record.title : undefined,
        company,
      );
    }
    for (const value of Object.values(record)) walk(value);
  };

  while ((match = scriptRegex.exec(args.html)) !== null) {
    const rawJson = (match[1] || '').trim();
    if (!rawJson) continue;
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      walk(parsed);
    } catch {
      // ignore malformed blocks
    }
  }
  return results.slice(0, 120);
}

function detectLikelyBlockedPage(html: string): string | null {
  const lowered = html.toLowerCase();
  if (lowered.includes('access denied') || lowered.includes('forbidden')) {
    return 'Website từ chối truy cập (Access Denied/Forbidden).';
  }
  if (lowered.includes('captcha') || lowered.includes('verify you are human') || lowered.includes('cloudflare')) {
    return 'Website đang bật bot-check/CAPTCHA.';
  }
  if (lowered.includes('opps! 404 not found!') && lowered.includes('__cf$cv$params')) {
    return 'Website trả về trang 404 ngụy trang anti-bot (Cloudflare challenge).';
  }
  return null;
}

function extractSearchTermsFromUrl(url: string): { keyword: string; location: string } {
  try {
    const parsed = new URL(url);
    const keyword =
      (parsed.searchParams.get('keyword') || parsed.searchParams.get('q') || parsed.searchParams.get('query') || '').trim();
    const location =
      (parsed.searchParams.get('location') || parsed.searchParams.get('loc') || parsed.searchParams.get('city') || '').trim();
    return { keyword, location };
  } catch {
    return { keyword: '', location: '' };
  }
}

async function runBrowserAssistedCrawl(args: {
  searchUrl: string;
  maxPages: number;
}): Promise<{ jobs: JobListing[]; pageDiagnostics: Array<Record<string, unknown>>; blockedReason: string | null }> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: LOCAL_CRAWL_USER_AGENT,
    locale: 'vi-VN',
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();
  const jobs: JobListing[] = [];
  const seen = new Set<string>();
  const pageDiagnostics: Array<Record<string, unknown>> = [];
  let blockedReason: string | null = null;

  try {
    const rootUrl = new URL(args.searchUrl);
    for (let pageNumber = 1; pageNumber <= args.maxPages; pageNumber += 1) {
      const pageUrl = new URL(rootUrl.toString());
      if (pageNumber > 1) pageUrl.searchParams.set('page', String(pageNumber));
      const response = await page.goto(pageUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2500);
      const html = await page.content();
      const blocked = detectLikelyBlockedPage(html);
      if (blocked && !blockedReason) blockedReason = blocked;
      const extracted = extractListingsFromHtml({ html, pageUrl: pageUrl.toString() });
      pageDiagnostics.push({
        page: pageNumber,
        url: pageUrl.toString(),
        mode: 'browser',
        status: response?.status() ?? 0,
        extracted: extracted.length,
        blocked: Boolean(blocked),
      });
      for (const job of extracted) {
        if (seen.has(job.link)) continue;
        seen.add(job.link);
        jobs.push(job);
      }
      if (jobs.length >= 120) break;
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return { jobs, pageDiagnostics, blockedReason };
}

async function runApiAggregationFallback(req: JobSupportRequest, reason: string): Promise<JobSupportRunResult | null> {
  const serpApiKey = resolveSerpApiKey(req);
  const tavilyApiKey = resolveTavilyKey(req);
  if (!serpApiKey && !tavilyApiKey) return null;
  const preferTavilyBypass = Boolean(tavilyApiKey);

  const normalizedSearchUrl = resolveNormalizedSearchUrl(req);
  const terms = extractSearchTermsFromUrl(normalizedSearchUrl);
  let emergencyDomain = '';
  try {
    emergencyDomain = new URL(normalizedSearchUrl).hostname.replace(/^www\./i, '');
  } catch {
    emergencyDomain = '';
  }
  const adapterReq: JobSupportRequest = {
    ...req,
    workspace: 'find-jobs',
    jobTitle: (req.jobTitle || terms.keyword || '').trim(),
    location: (req.location || terms.location || '').trim(),
    searchUrl: undefined,
    // For anti-bot bypass, prefer Tavily when available to avoid
    // google_jobs location constraints from SerpApi.
    serpapi_key: preferTavilyBypass ? undefined : serpApiKey || undefined,
    tavily_api_key: tavilyApiKey || undefined,
    // Minimal API budget: only enough to bypass anti-bot blocked crawls.
    ecoMode: true,
    maxQueries: 4,
    companyPortals: (req.companyPortals || '').trim() || emergencyDomain || undefined,
  };

  const adapter = new VnJobsSerpAdapter();
  const preflight = await adapter.preflight({ request: adapterReq });
  if (!preflight.ok) return null;

  // In crawl mode, users often keep UI in eco by default. For anti-bot bypass,
  // enforce a healthier floor so results are not too sparse.
  const requestedBudget = Math.max(12, Math.min(20, parsePositiveInt(req.maxQueries, 12)));
  const budgetCap = Math.max(4, requestedBudget);
  const tiers = [4, 8, 12]
    .map((value) => Math.min(value, budgetCap))
    .filter((value, index, arr) => value >= 1 && arr.indexOf(value) === index);
  const targetJobs = Math.max(8, Math.min(40, budgetCap * 3));

  let bestOutput: JobSupportRunResult | null = null;
  let bestCount = -1;
  const triedBudgets: number[] = [];

  for (const tierBudget of tiers) {
    triedBudgets.push(tierBudget);
    const tierReq: JobSupportRequest = {
      ...adapterReq,
      maxQueries: tierBudget,
    };
    const tierOutput = await adapter.execute({
      request: tierReq,
      workspace: 'find-jobs',
      startedAt: new Date(),
      runId: `${Date.now()}-find-jobs-api-fallback-${tierBudget}`,
    });
    if (!tierOutput.ok) continue;
    const tierCount = Array.isArray(tierOutput.meta?.jobs) ? tierOutput.meta.jobs.length : 0;
    if (tierCount >= bestCount) {
      bestCount = tierCount;
      bestOutput = tierOutput;
    }
    if (tierCount >= targetJobs) break;
  }
  if (!bestOutput) return null;
  const usedBudget = triedBudgets[triedBudgets.length - 1] || budgetCap;
  const boosted = triedBudgets.length > 1;

  return {
    ...bestOutput,
    provider: 'crawl4ai-url',
    summary: `${bestOutput.summary} (API bypass mở rộng từ Crawl4AI URL-in)`,
    hint: boosted
      ? `${reason} Đã dùng ${preferTavilyBypass ? 'Tavily' : 'API'} bypass nhiều tầng (eco + maxQueries=${triedBudgets.join(' -> ')}) để tăng độ phủ, vẫn không chạy full API mode.`
      : `${reason} Đã dùng ${preferTavilyBypass ? 'Tavily' : 'API'} bypass (eco + maxQueries=${usedBudget}) để vượt chặn, không chạy full API mode.`,
    meta: {
      ...(bestOutput.meta || {}),
      fallbackReason: reason,
      fallbackType: 'api-minimal-bypass',
      bypassBudget: { ecoMode: true, maxQueries: usedBudget, boosted, triedBudgets, targetJobs },
      bypassDomain: emergencyDomain || undefined,
      bypassProvider: preferTavilyBypass ? 'tavily' : 'serpapi',
    },
  };
}

function withApiFallbackUnavailableHint(output: JobSupportRunResult): JobSupportRunResult {
  const fallbackHint =
    'Không thể tự fallback sang API vì chưa có SerpApi/Tavily key trong request/env.';
  const baseHint = (output.hint || '').trim();
  return {
    ...output,
    hint: baseHint ? `${baseHint} ${fallbackHint}` : fallbackHint,
    meta: {
      ...(output.meta || {}),
      apiFallbackAvailable: false,
    },
  };
}

function shouldUseMinimalApiBypass(output: JobSupportRunResult): boolean {
  const text = `${output.stderr || ''}\n${output.hint || ''}`.toLowerCase();
  if (
    text.includes('anti-bot') ||
    text.includes('captcha') ||
    text.includes('cloudflare') ||
    text.includes('forbidden') ||
    text.includes('http 403') ||
    text.includes('http 429')
  ) {
    return true;
  }
  const diagnostics = output.meta?.pageDiagnostics;
  if (!Array.isArray(diagnostics)) return false;
  return diagnostics.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const record = entry as Record<string, unknown>;
    if (record.blocked === true) return true;
    const reason = String(record.reason || '').toLowerCase();
    return reason === 'http_401' || reason === 'http_403' || reason === 'http_429';
  });
}

function extractListingsFromHtml(args: { html: string; pageUrl: string }): JobListing[] {
  const listings: JobListing[] = [];
  const seen = new Set<string>();
  let pageHost = '';
  try {
    pageHost = new URL(args.pageUrl).hostname;
  } catch {
    pageHost = '';
  }
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(args.html)) !== null) {
    const href = match[1];
    const title = stripHtml(match[2] || '');
    if (!href || title.length < 8) continue;
    const link = normalizeCandidateUrl(href, args.pageUrl);
    if (!link || seen.has(link)) continue;
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      continue;
    }
    const allowed = isLikelyJobDetailUrl(link) || (isTopcvHost(pageHost) && isLikelyTopcvJobDetailUrl(parsed));
    if (!allowed) continue;
    seen.add(link);
    let source = 'crawl4ai-local';
    try {
      source = new URL(link).hostname.replace(/^www\./i, '');
    } catch {
      // ignore
    }
    listings.push({ title, link, source });
  }
  const jsonLdListings = collectJsonLdListings(args);
  for (const listing of jsonLdListings) {
    if (seen.has(listing.link)) continue;
    seen.add(listing.link);
    listings.push(listing);
  }
  return listings.slice(0, 120);
}

async function runLocalCrawlFallback(req: JobSupportRequest): Promise<JobSupportRunResult> {
  const startedAt = new Date();
  const runId = `${Date.now()}-find-jobs-local-crawl`;
  const maxPages = Math.min(parsePositiveInt(req.maxPages, 2), 4);
  const searchUrl = resolveNormalizedSearchUrl(req);

  try {
    const rootUrl = new URL(searchUrl);
    const jobs: JobListing[] = [];
    const seen = new Set<string>();
    const pageDiagnostics: Array<Record<string, unknown>> = [];
    let blockedReason: string | null = null;
    let hitProtectedStatus = false;
    let normalizationHint: string | undefined;
    const rawInputUrl = (req.searchUrl || req.jobUrl || '').trim();
    if (rawInputUrl && rawInputUrl !== searchUrl) {
      normalizationHint = `URL đã được chuẩn hoá thành: ${searchUrl}`;
    }

    for (let page = 1; page <= maxPages; page += 1) {
      const pageUrl = new URL(rootUrl.toString());
      if (page > 1) {
        pageUrl.searchParams.set('page', String(page));
      }

      const response = await fetch(pageUrl.toString(), {
        method: 'GET',
        cache: 'no-store',
        headers: { 'User-Agent': LOCAL_CRAWL_USER_AGENT },
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403 || response.status === 429) {
          hitProtectedStatus = true;
          if (!blockedReason) {
            blockedReason = `Website trả về HTTP ${response.status} (khả năng cao bị anti-bot).`;
          }
        }
        pageDiagnostics.push({
          page,
          url: pageUrl.toString(),
          status: response.status,
          reason: `http_${response.status}`,
        });
        if (page === 1) {
          break;
        }
        continue;
      }
      const html = await response.text();
      const blocked = detectLikelyBlockedPage(html);
      if (blocked && !blockedReason) blockedReason = blocked;
      const extracted = extractListingsFromHtml({ html, pageUrl: pageUrl.toString() });
      pageDiagnostics.push({
        page,
        url: pageUrl.toString(),
        mode: 'http',
        status: response.status,
        extracted: extracted.length,
        blocked: Boolean(blocked),
      });
      if (extracted.length === 0) {
        const shouldTryNextPage = page === 1 && maxPages > 1;
        if (shouldTryNextPage) continue;
        break;
      }
      for (const job of extracted) {
        if (seen.has(job.link)) continue;
        seen.add(job.link);
        jobs.push(job);
      }
      if (jobs.length >= 120) break;
    }

    if (jobs.length === 0 && (blockedReason || hitProtectedStatus)) {
      try {
        const browserResult = await runBrowserAssistedCrawl({ searchUrl, maxPages });
        for (const job of browserResult.jobs) {
          if (seen.has(job.link)) continue;
          seen.add(job.link);
          jobs.push(job);
        }
        pageDiagnostics.push(...browserResult.pageDiagnostics);
        if (!blockedReason && browserResult.blockedReason) blockedReason = browserResult.blockedReason;
      } catch (browserError) {
        pageDiagnostics.push({
          mode: 'browser',
          error: browserError instanceof Error ? browserError.message : 'browser_crawl_failed',
        });
        if (!blockedReason) {
          blockedReason = 'Browser-assisted crawl thất bại khi vượt anti-bot.';
        }
      }
    }

    const endedAt = new Date();
    const ok = jobs.length > 0;
    return {
      id: runId,
      workspace: 'find-jobs',
      provider: 'crawl4ai-url',
      mode: req.mode || 'dry-run',
      command: `local-crawl ${searchUrl}`,
      cwd: process.cwd(),
      ok,
      exitCode: ok ? 0 : 1,
      durationMs: endedAt.getTime() - startedAt.getTime(),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      stdout: JSON.stringify({ count: jobs.length, jobs, pageDiagnostics }, null, 2),
      stderr: ok ? '' : blockedReason || 'No listings extracted from provided URL',
      summary: ok
        ? `Local crawl extracted ${jobs.length} jobs`
        : 'Local crawl completed but found no job listing',
      errorCode: ok ? undefined : 'COMMAND_FAILED',
      hint: ok
        ? normalizationHint || 'Đã chạy fallback cục bộ (không cần Job Ops / SerpApi).'
        : blockedReason
          ? `${blockedReason} Thử đổi URL khác hoặc chạy bằng API mode.`
          : `${normalizationHint ? `${normalizationHint}. ` : ''}Không trích xuất được job. Thử URL search cụ thể hơn (TopCV /tim-viec-lam?keyword=...).`,
      meta: { jobs, queriesUsed: [`[crawl4ai-local] ${searchUrl}`], pageDiagnostics, normalizedSearchUrl: searchUrl },
    };
  } catch (error) {
    const endedAt = new Date();
    const message = error instanceof Error ? error.message : 'local crawl failed';
    return {
      id: runId,
      workspace: 'find-jobs',
      provider: 'crawl4ai-url',
      mode: req.mode || 'dry-run',
      command: `local-crawl ${searchUrl}`,
      cwd: process.cwd(),
      ok: false,
      exitCode: 1,
      durationMs: endedAt.getTime() - startedAt.getTime(),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      stdout: '',
      stderr: message,
      summary: 'Fallback crawl cục bộ thất bại',
      errorCode: 'COMMAND_FAILED',
      hint: 'Kiểm tra URL đầu vào và kết nối mạng.',
    };
  }
}

function buildDefaultCrawlSearchUrl(req: JobSupportRequest): string {
  const keyword = encodeURIComponent((req.jobTitle || '').trim() || 'việc làm');
  const location = (req.location || '').trim();
  const locationPart = location ? `&location=${encodeURIComponent(location)}` : '';
  return `https://www.topcv.vn/tim-viec-lam?keyword=${keyword}${locationPart}`;
}

function resolveNormalizedSearchUrl(req: JobSupportRequest): string {
  const raw = (req.searchUrl || req.jobUrl || '').trim();
  if (!raw) return buildDefaultCrawlSearchUrl(req);

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    const requestKeyword = (req.jobTitle || '').trim();
    const requestLocation = (req.location || '').trim();

    if (host === 'topcv.vn') {
      // TopCV root/listing URLs are weak for extraction; normalize to search page.
      const isRoot = /^\/?$/.test(url.pathname);
      const isListingRoot = /^\/viec-lam\/?$/i.test(url.pathname);
      const isSearchPage = /^\/tim-viec-lam\/?$/i.test(url.pathname);

      if (isRoot || isListingRoot) {
        return buildDefaultCrawlSearchUrl(req);
      }

      if (isSearchPage) {
        if (!url.searchParams.get('keyword') && requestKeyword) {
          url.searchParams.set('keyword', requestKeyword);
        }
        if (!url.searchParams.get('location') && requestLocation) {
          url.searchParams.set('location', requestLocation);
        }
      }
    } else if (!url.searchParams.get('keyword') && requestKeyword) {
      // Generic fallback for other sites that support keyword query parameters.
      url.searchParams.set('keyword', requestKeyword);
    }

    return url.toString();
  } catch {
    return buildDefaultCrawlSearchUrl(req);
  }
}

async function runCrawl4aiUrlBridge(req: JobSupportRequest): Promise<JobSupportRunResult> {
  const startedAt = new Date();
  const runId = `${Date.now()}-find-jobs-url`;
  const baseUrl = (process.env.JOBOPS_ORCHESTRATOR_URL || DEFAULT_JOBOPS_BASE_URL).replace(/\/$/, '');
  const maxPages = Math.min(parsePositiveInt(req.maxPages, 2), 10);
  const searchUrl = resolveNormalizedSearchUrl(req);
  const endpoint = `${baseUrl}/api/pipeline/run-url`;

  const payload = {
    searchUrl,
    maxPages,
    topN: 20,
    minSuitabilityScore: 0,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const raw = await response.text();
    if (!response.ok) {
      const localOutput = await runLocalCrawlFallback(req);
      if (localOutput.ok) return localOutput;
      if (shouldUseMinimalApiBypass(localOutput)) {
        const apiFallback = await runApiAggregationFallback(
          req,
          `Bridge Job Ops trả về HTTP ${response.status}; local crawl bị chặn anti-bot.`,
        );
        if (apiFallback) return apiFallback;
      }
      return withApiFallbackUnavailableHint(localOutput);
    }
    const endedAt = new Date();
    const ok = response.ok;

    return {
      id: runId,
      workspace: 'find-jobs',
      provider: 'crawl4ai-url',
      mode: req.mode || 'dry-run',
      command: `POST ${endpoint}`,
      cwd: process.cwd(),
      ok,
      exitCode: ok ? 0 : 1,
      durationMs: endedAt.getTime() - startedAt.getTime(),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      stdout: raw,
      stderr: ok ? '' : raw,
      summary: ok
        ? `URL crawl started via Job Ops for ${searchUrl}`
        : `Job Ops URL crawl failed (${response.status})`,
      errorCode: ok ? undefined : 'COMMAND_FAILED',
      hint: ok
        ? 'Theo dõi tiến trình ở Job Ops pipeline progress.'
        : `Đảm bảo Job Ops đang chạy tại ${baseUrl} và endpoint /api/pipeline/run-url có sẵn.`,
      meta: {
        endpoint,
        searchUrl,
        maxPages,
        status: response.status,
      },
    };
  } catch {
    const localOutput = await runLocalCrawlFallback(req);
    if (localOutput.ok) return localOutput;
    if (shouldUseMinimalApiBypass(localOutput)) {
      const apiFallback = await runApiAggregationFallback(
        req,
        'Bridge Job Ops không kết nối được; local crawl bị chặn anti-bot.',
      );
      if (apiFallback) return apiFallback;
    }
    return withApiFallbackUnavailableHint(localOutput);
  }
}

export async function runWorkspace(req: JobSupportRequest): Promise<JobSupportApiResponse> {
  const validation = validateInput(req);
  if (!validation.ok) {
    return { ok: false, error: validation.error, errorCode: validation.code, hint: validation.hint };
  }

  const limiter = await enforceApplyRateLimit(req);
  if (!limiter.ok) {
    return { ok: false, error: limiter.error, errorCode: limiter.code, hint: limiter.hint };
  }

  const searchUrl = (req.searchUrl || req.jobUrl || '').trim();
  if (req.workspace === 'find-jobs' && /^https?:\/\//i.test(searchUrl)) {
    const output = await runCrawl4aiUrlBridge(req);
    await saveLastRun(output);
    return {
      ok: output.ok,
      output,
      error: output.ok ? undefined : 'Lệnh chạy thất bại',
      errorCode: output.errorCode,
      hint: output.hint,
    };
  }

  const adapter = adapterFor(req.workspace);
  const preflight = await adapter.preflight({ request: req });
  if (!preflight.ok) {
    return { ok: false, error: 'Provider chưa sẵn sàng', errorCode: 'PROVIDER_NOT_READY', hint: preflight.hint };
  }

  const startedAt = new Date();
  const runId = `${Date.now()}-${req.workspace}`;
  const output = await adapter.execute({
    request: req,
    workspace: req.workspace,
    startedAt,
    runId,
  });
  await saveLastRun(output);
  return {
    ok: output.ok,
    output,
    error: output.ok ? undefined : 'Lệnh chạy thất bại',
    errorCode: output.errorCode,
    hint: output.hint,
  };
}

export async function readLastWorkspaceRun(): Promise<JobSupportRunResult | null> {
  try {
    const raw = await fs.readFile(LAST_RUN_FILE, 'utf-8');
    return JSON.parse(raw) as JobSupportRunResult;
  } catch {
    return null;
  }
}

export type JobSupportProviderRow = {
  provider: 'vn-job-feed' | 'manual-apply' | 'ai-resume-tailor' | 'crawl4ai-url';
  ready: boolean;
  cwd: string;
  setupHint: string[];
};

export async function getModernProviderStatuses(): Promise<JobSupportProviderRow[]> {
  const merged = mergeConfig({});
  const hasSerp =
    Boolean((merged.serpapi_key || '').trim()) || Boolean(process.env.SERPAPI_KEY?.trim?.());

  const rows: JobSupportProviderRow[] = [
    {
      provider: 'crawl4ai-url',
      ready: true,
      cwd: path.join(process.cwd(), 'integrations', 'benchmarks', 'job-ops'),
      setupHint: [
        'Dán search URL (vd TopCV) để chạy URL-in crawl.',
        'Nếu dùng bridge nội bộ, đặt JOBOPS_ORCHESTRATOR_URL trỏ vào Job Ops server.',
      ],
    },
    {
      provider: 'vn-job-feed',
      /** Client có thể gửi key trong body; có env thì báo ready chắc chắn */
      ready: true,
      cwd: path.join(process.cwd(), 'src', 'modules', 'job-support'),
      setupHint: hasSerp
        ? ['SerpApi: đã phát hiện key trong môi trường (hoặc cấu hình server).']
        : ['Mở Cài đặt → nhập SerpApi Key, hoặc đặt SERPAPI_KEY trong .env của Next.js.', 'Credit SerpApi: tối đa ~8 query mỗi lần chạy Find Jobs VN.'],
    },
    {
      provider: 'manual-apply',
      ready: true,
      cwd: path.join(process.cwd(), 'src', 'modules', 'job-support'),
      setupHint: ['Chế độ thủ công: không cần cài thêm CLI; chỉ dán danh sách URL.'],
    },
    {
      provider: 'ai-resume-tailor',
      ready: false,
      cwd: integrationPath('ai-resume-tailor'),
      setupHint: ['cd integrations/benchmarks/ai-resume-tailor', 'npm install', 'npm run dev'],
    },
  ];

  for (const row of rows) {
    if (row.provider !== 'ai-resume-tailor') continue;
    try {
      await fs.access(row.cwd);
      row.ready = true;
    } catch {
      row.ready = false;
    }
  }
  return rows;
}
