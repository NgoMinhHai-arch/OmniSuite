'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BriefcaseBusiness, Copy, ExternalLink, LayoutGrid, List, Map, Maximize2, Minimize2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import Card from '@/shared/ui/Card';
import Typography from '@/shared/ui/Typography';
import type { JobListing } from '@/modules/job-support/domain/contracts';

const SETTINGS_KEY = 'omnisuite_settings';
const FIND_JOBS_CACHE_KEY = 'omnisuite_findjobs_cache_v1';
const DEFAULT_SOURCES = ['vietnamworks.com', 'topcv.vn', 'itviec.com', 'careerlink.vn', 'careerviet.vn', 'glints.com'].join('\n');
// Unique accent for Job Support (orange)
const JOB_SUPPORT_ACCENT = '#F97316'; // orange-500
const JOB_SUPPORT_ACCENT_SOFT = 'rgba(249, 115, 22, 0.14)';
const JOB_SUPPORT_ACCENT_BORDER = 'rgba(249, 115, 22, 0.35)';
const JOB_SUPPORT_ACCENT_GLOW = 'rgba(249, 115, 22, 0.55)';
const PRESET_SOURCES: Record<string, string> = {
  General: DEFAULT_SOURCES,
  Tech: ['itviec.com', 'topdev.vn', 'vietnamworks.com', 'glints.com', 'linkedin.com/jobs'].join('\n'),
  Marketing: ['vietnamworks.com', 'topcv.vn', 'careerlink.vn', 'glints.com', 'linkedin.com/jobs'].join('\n'),
};
const QUICK_KEYWORDS = ['Remote', 'Intern', 'Junior', 'Middle', 'Senior'];
const SHOW_EXTRA_BOARD_ACTIONS = false;
const SHOW_VIEW_MODE_TOGGLES = false;
type SortMode = 'relevance' | 'latest' | 'title';
type PanelTab = 'quick' | 'filters' | 'sources';
type ViewMode = 'cards' | 'table';
type CrawlMode = 'eco' | 'more' | 'full';
type DetailCostMode = 'free_only' | 'free_then_paid' | 'paid_priority';
type DetailStrategy = 'free_fetch' | 'tavily' | 'serpapi';
type BatchStatus = 'pending' | 'done' | 'failed' | 'cached';

const MODE_CONFIG: Record<CrawlMode, { label: string; ecoMode: boolean; maxQueries: number; tip: string }> = {
  eco: { label: 'Tiết kiệm', ecoMode: true, maxQueries: 6, tip: 'Tiết kiệm (max là 6).' },
  more: { label: 'Nhiều hơn', ecoMode: false, maxQueries: 12, tip: 'Nhiều hơn (max là 12).' },
  full: { label: 'Đầy đủ', ecoMode: false, maxQueries: 20, tip: 'Đầy đủ (max là 20).' },
};

function detectSmartPreset(jobTitle: string): keyof typeof PRESET_SOURCES {
  const k = jobTitle.toLowerCase();
  if (/(dev|developer|engineer|frontend|backend|fullstack|data|ai|it|qa|tester)/.test(k)) return 'Tech';
  if (/(marketing|content|seo|brand|social|media|ads|growth|pr|copywriter)/.test(k)) return 'Marketing';
  return 'General';
}

function buildDefaultCrawlSearchUrl(jobTitle: string, location: string): string {
  const keyword = encodeURIComponent(jobTitle.trim() || 'việc làm');
  const loc = location.trim();
  const locationPart = loc ? `&location=${encodeURIComponent(loc)}` : '';
  return `https://www.topcv.vn/tim-viec-lam?keyword=${keyword}${locationPart}`;
}

type FindRunPayload = {
  ok?: boolean;
  output?: {
    stdout?: string;
    hint?: string;
    stderr?: string;
    meta?: { jobs?: JobListing[]; queriesUsed?: string[] };
  };
  error?: string;
  errorCode?: string;
  hint?: string;
};

type JobDetailCacheItem = {
  description?: string;
  requirements?: string[];
  benefits?: string[];
  source?: string;
  updatedAt?: string;
};

type EnrichPayload = {
  ok?: boolean;
  detail?: JobDetailCacheItem;
  strategyUsed?: DetailStrategy;
  fallbackUsed?: boolean;
  creditsEstimate?: number;
  error?: string;
  errorCode?: string;
  hint?: string;
};

type BatchProgressSnapshot = {
  total: number;
  processed: number;
  done: number;
  failed: number;
  cached: number;
  credits: number;
  currentLink: string;
};

const DETAIL_MODE_CONFIG: Record<DetailCostMode, { label: string; tip: string }> = {
  free_only: { label: 'Miễn phí', tip: 'Chỉ fetch URL trực tiếp và dùng cache.' },
  free_then_paid: { label: 'Tiết kiệm + fallback', tip: 'Miễn phí trước, thiếu dữ liệu thì mới gọi API trả phí.' },
  paid_priority: { label: 'Ưu tiên đầy đủ', tip: 'Ưu tiên provider trả phí để lấy dữ liệu đầy hơn.' },
};

export default function FindJobsDashboardPage() {
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [useApiFastMode, setUseApiFastMode] = useState(false);
  const [companyPortals, setCompanyPortals] = useState(DEFAULT_SOURCES);
  const [result, setResult] = useState<string>('');
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [queriesUsed, setQueriesUsed] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [errorCode, setErrorCode] = useState<string>('');
  const [hint, setHint] = useState<string>('');
  const [providerInfo, setProviderInfo] = useState<string>('');
  const [apiCapabilityInfo, setApiCapabilityInfo] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [crawlMode, setCrawlMode] = useState<CrawlMode>('eco');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>('quick');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [focusDetail, setFocusDetail] = useState(false);
  const [boardExpanded, setBoardExpanded] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [pageIndex, setPageIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const [cursorTip, setCursorTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const [detailCostMode, setDetailCostMode] = useState<DetailCostMode>('free_only');
  const [detailCacheByLink, setDetailCacheByLink] = useState<Record<string, JobDetailCacheItem>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailStatus, setDetailStatus] = useState<string>('');
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchStatusByLink, setBatchStatusByLink] = useState<Record<string, BatchStatus>>({});
  const [batchProgress, setBatchProgress] = useState<BatchProgressSnapshot>({
    total: 0,
    processed: 0,
    done: 0,
    failed: 0,
    cached: 0,
    credits: 0,
    currentLink: '',
  });
  const cancelBatchRef = useRef(false);
  const currentMode = MODE_CONFIG[crawlMode];

  const serpHint = useMemo(
    () =>
      useApiFastMode
        ? 'Bật API để chạy nhanh hơn nhưng có thể ít kết quả và phụ thuộc quota.'
        : 'Tắt API để dùng Crawl4AI URL-in: có thể nhập URL hoặc để trống để tự tạo từ từ khóa và địa điểm.',
    [useApiFastMode],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const hasSerp = Boolean(parsed?.serpapi_key?.trim?.());
      const hasTavily = Boolean(parsed?.tavily_api_key?.trim?.());
      setApiCapabilityInfo(
        hasSerp || hasTavily
          ? `API khả dụng: ${[hasTavily ? 'Tavily' : '', hasSerp ? 'SerpApi' : ''].filter(Boolean).join(' + ')}.`
          : 'Chưa thấy Tavily/SerpApi trong Cài đặt — nhập ít nhất một key trong Settings hoặc env server.',
      );
    } catch {
      setApiCapabilityInfo('Không đọc được settings local để kiểm tra Tavily/SerpApi.');
    }
  }, []);

  useEffect(() => {
    setProviderInfo(
      useApiFastMode ? apiCapabilityInfo : 'Crawl4AI URL-in đang được bật mặc định.',
    );
  }, [useApiFastMode, apiCapabilityInfo]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Restore Find Jobs session cache (results + filters)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(FIND_JOBS_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed) {
        if (typeof parsed.jobTitle === 'string') setJobTitle(parsed.jobTitle);
        if (typeof parsed.location === 'string') setLocation(parsed.location);
        if (typeof parsed.crawlUrl === 'string') setCrawlUrl(parsed.crawlUrl);
        if (typeof parsed.useApiFastMode === 'boolean') setUseApiFastMode(parsed.useApiFastMode);
        if (typeof parsed.companyPortals === 'string' && parsed.companyPortals.trim()) setCompanyPortals(parsed.companyPortals);
        if (typeof parsed.result === 'string') setResult(parsed.result);
        if (Array.isArray(parsed.jobs)) setJobs(parsed.jobs as JobListing[]);
        if (Array.isArray(parsed.queriesUsed)) setQueriesUsed(parsed.queriesUsed as string[]);
        if (typeof parsed.errorCode === 'string') setErrorCode(parsed.errorCode);
        if (typeof parsed.hint === 'string') setHint(parsed.hint);
        if (parsed.sourceFilter === 'all' || typeof parsed.sourceFilter === 'string') setSourceFilter(parsed.sourceFilter || 'all');
        if (typeof parsed.keywordFilter === 'string') setKeywordFilter(parsed.keywordFilter);
        if (parsed.sortMode === 'relevance' || parsed.sortMode === 'latest' || parsed.sortMode === 'title') setSortMode(parsed.sortMode);
        if (typeof parsed.hideDuplicates === 'boolean') setHideDuplicates(parsed.hideDuplicates);
        if (parsed.crawlMode === 'eco' || parsed.crawlMode === 'more' || parsed.crawlMode === 'full') setCrawlMode(parsed.crawlMode);
        if (typeof parsed.showAdvanced === 'boolean') setShowAdvanced(parsed.showAdvanced);
        if (parsed.detailCostMode === 'free_only' || parsed.detailCostMode === 'free_then_paid' || parsed.detailCostMode === 'paid_priority') {
          setDetailCostMode(parsed.detailCostMode);
        }
        if (parsed.detailCacheByLink && typeof parsed.detailCacheByLink === 'object') {
          setDetailCacheByLink(parsed.detailCacheByLink as Record<string, JobDetailCacheItem>);
        }
        if (parsed.batchStatusByLink && typeof parsed.batchStatusByLink === 'object') {
          setBatchStatusByLink(parsed.batchStatusByLink as Record<string, BatchStatus>);
        }
        if (parsed.batchProgress && typeof parsed.batchProgress === 'object') {
          const p = parsed.batchProgress as Partial<BatchProgressSnapshot>;
          setBatchProgress((prev) => ({
            ...prev,
            total: Number.isFinite(p.total) ? Number(p.total) : prev.total,
            processed: Number.isFinite(p.processed) ? Number(p.processed) : prev.processed,
            done: Number.isFinite(p.done) ? Number(p.done) : prev.done,
            failed: Number.isFinite(p.failed) ? Number(p.failed) : prev.failed,
            cached: Number.isFinite(p.cached) ? Number(p.cached) : prev.cached,
            credits: Number.isFinite(p.credits) ? Number(p.credits) : prev.credits,
            currentLink: typeof p.currentLink === 'string' ? p.currentLink : prev.currentLink,
          }));
        }
        if (typeof parsed.selectedJobLink === 'string' && Array.isArray(parsed.jobs)) {
          const picked = (parsed.jobs as JobListing[]).find((j) => j.link === parsed.selectedJobLink) || null;
          setSelectedJob(picked);
        }
      }
    } catch {
      /* ignore broken cache */
    } finally {
      setCacheReady(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('omnisuite_findjobs_ui');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.viewMode === 'table' || parsed?.viewMode === 'cards') setViewMode(parsed.viewMode);
      if (typeof parsed?.focusDetail === 'boolean') setFocusDetail(parsed.focusDetail);
      if (parsed?.panelTab === 'quick' || parsed?.panelTab === 'filters' || parsed?.panelTab === 'sources') setPanelTab(parsed.panelTab);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('omnisuite_findjobs_ui', JSON.stringify({ viewMode, focusDetail, panelTab }));
    } catch {
      /* ignore */
    }
  }, [viewMode, focusDetail, panelTab]);

  useEffect(() => {
    setDetailStatus('');
  }, [selectedJob?.link]);

  // Persist Find Jobs session cache whenever data changes
  useEffect(() => {
    if (typeof window === 'undefined' || !cacheReady) return;
    try {
      sessionStorage.setItem(
        FIND_JOBS_CACHE_KEY,
        JSON.stringify({
          jobTitle,
          location,
          crawlUrl,
          useApiFastMode,
          companyPortals,
          result,
          jobs,
          queriesUsed,
          selectedJobLink: selectedJob?.link || '',
          errorCode,
          hint,
          sourceFilter,
          keywordFilter,
          sortMode,
          hideDuplicates,
          crawlMode,
          showAdvanced,
          detailCostMode,
          detailCacheByLink,
          batchStatusByLink,
          batchProgress,
        }),
      );
    } catch {
      /* ignore storage quota issues */
    }
  }, [
    cacheReady,
    jobTitle,
    location,
    crawlUrl,
    useApiFastMode,
    companyPortals,
    result,
    jobs,
    queriesUsed,
    selectedJob,
    errorCode,
    hint,
    sourceFilter,
    keywordFilter,
    sortMode,
    hideDuplicates,
    crawlMode,
    showAdvanced,
    detailCostMode,
    detailCacheByLink,
    batchStatusByLink,
    batchProgress,
  ]);

  const run = async () => {
    setRunning(true);
    setResult('');
    setJobs([]);
    setQueriesUsed([]);
    // Reset filters at the start of each run to avoid hiding fresh results
    // because of stale session filters from previous searches.
    setSourceFilter('all');
    setKeywordFilter('');
    setSortMode('relevance');
    setPageIndex(0);
    setSelectedJob(null);
    setErrorCode('');
    setHint('');
    setBatchStatusByLink({});
    setBatchProgress({
      total: 0,
      processed: 0,
      done: 0,
      failed: 0,
      cached: 0,
      credits: 0,
      currentLink: '',
    });
    try {
      let serpapi_key = '';
      let tavily_api_key = '';
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(SETTINGS_KEY) : null;
        const parsed = raw ? JSON.parse(raw) : null;
        serpapi_key = (parsed?.serpapi_key || '').trim();
        tavily_api_key = (parsed?.tavily_api_key || '').trim();
      } catch {
        /* ignore */
      }

      const hasAnyApiKey = Boolean(serpapi_key || tavily_api_key);
      const shouldUseApiFastMode = useApiFastMode && hasAnyApiKey;
      const effectiveSearchUrl =
        crawlUrl.trim() || buildDefaultCrawlSearchUrl(jobTitle, location);

      const res = await fetch('/api/job-support/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Hidden smart mode: auto-pick source preset based on job title
        // when user did not manually customize source list.
        // This keeps UI clean while improving relevance.
        body: JSON.stringify({
          workspace: 'find-jobs',
          mode: 'dry-run',
          // Keep title/location for all modes so backend fallback can
          // build more relevant queries when crawl URL is blocked.
          jobTitle: jobTitle.trim() || undefined,
          location: location.trim() || undefined,
          searchUrl: shouldUseApiFastMode ? undefined : effectiveSearchUrl,
          maxPages: shouldUseApiFastMode
            ? undefined
            : currentMode.maxQueries >= 20
              ? 3
              : currentMode.maxQueries >= 12
                ? 2
                : 1,
          companyPortals:
            shouldUseApiFastMode && companyPortals.trim() === DEFAULT_SOURCES.trim()
              ? PRESET_SOURCES[detectSmartPreset(jobTitle)]
              : shouldUseApiFastMode
                ? companyPortals
                : undefined,
          // Always forward keys when present so backend can use API fallback
          // even if UI is currently in Crawl4AI mode.
          serpapi_key: serpapi_key || undefined,
          tavily_api_key: tavily_api_key || undefined,
          ecoMode: shouldUseApiFastMode ? currentMode.ecoMode : undefined,
          maxQueries: currentMode.maxQueries,
        }),
      });
      const data = (await res.json()) as FindRunPayload;
      if (!res.ok || !data.ok) {
        setResult(data.error || 'Run failed.');
        setErrorCode(data.errorCode || '');
        setHint(data.hint || '');
        return;
      }

      const out = data.output;
      const metaJobs = Array.isArray(out?.meta?.jobs) ? out.meta.jobs : [];
      const metaQueries = Array.isArray(out?.meta?.queriesUsed) ? out.meta.queriesUsed : [];

      let parsedJobs: JobListing[] = metaJobs;
      let parsedQueries: string[] = metaQueries;

      if ((parsedJobs.length === 0 || parsedQueries.length === 0) && out?.stdout?.trim()) {
        try {
          const j = JSON.parse(out.stdout) as { jobs?: JobListing[]; queriesUsed?: string[] };
          if (parsedJobs.length === 0 && Array.isArray(j.jobs)) parsedJobs = j.jobs;
          if (parsedQueries.length === 0 && Array.isArray(j.queriesUsed)) parsedQueries = j.queriesUsed;
        } catch {
          /* ignore parse fallback */
        }
      }

      setJobs(parsedJobs);
      setQueriesUsed(parsedQueries);
      setSelectedJob(parsedJobs[0] || null);
      const fallbackEmptyHint =
        !shouldUseApiFastMode && parsedJobs.length === 0
          ? 'Đã chạy crawl nhưng chưa trích xuất được job nào. Thử URL TopCV dạng /tim-viec-lam?keyword=... hoặc đổi keyword cụ thể hơn.'
          : '';
      setHint(
        !shouldUseApiFastMode && useApiFastMode
          ? `Không thấy SerpApi/Tavily key, đã tự chuyển sang Crawl4AI URL-in: ${effectiveSearchUrl}`
          : out?.hint || data.hint || fallbackEmptyHint,
      );
      const stderr = (out?.stderr || '').trim();
      setResult(stderr ? `${out?.stdout?.trim() || ''}\n\n--- stderr ---\n${stderr}` : out?.stdout?.trim() || 'Done.');
    } catch {
      setResult('Không gọi được API.');
    } finally {
      setRunning(false);
    }
  };

  const canRun = useApiFastMode
    ? Boolean(jobTitle.trim() || location.trim())
    : Boolean(crawlUrl.trim() || jobTitle.trim() || location.trim());

  const sourceOptions = useMemo(() => {
    const uniq = [...new Set(jobs.map((j) => j.source))].filter(Boolean);
    return ['all', ...uniq];
  }, [jobs]);

  const dedupedJobs = useMemo(() => {
    if (!hideDuplicates) return jobs;
    const seen = new Set<string>();
    const resultList: JobListing[] = [];
    for (const job of jobs) {
      const key = `${(job.title || '').trim().toLowerCase()}|${(job.company || '').trim().toLowerCase()}|${(job.location || '').trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        resultList.push(job);
      }
    }
    return resultList;
  }, [jobs, hideDuplicates]);

  const filteredJobs = useMemo(() => {
    const list = dedupedJobs.filter((job) => {
      const sourceOk = sourceFilter === 'all' || job.source === sourceFilter;
      const kw = keywordFilter.trim().toLowerCase();
      const keywordOk =
        !kw ||
        job.title.toLowerCase().includes(kw) ||
        (job.company || '').toLowerCase().includes(kw) ||
        (job.location || '').toLowerCase().includes(kw) ||
        (job.description || '').toLowerCase().includes(kw);
      return sourceOk && keywordOk;
    });
    if (sortMode === 'title') {
      return [...list].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    if (sortMode === 'latest') {
      return [...list].sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''));
    }
    return list;
  }, [dedupedJobs, sourceFilter, keywordFilter, sortMode]);

  const currentJob = selectedJob && filteredJobs.find((j) => j.link === selectedJob.link) ? selectedJob : filteredJobs[0] || null;
  const currentDetail = currentJob ? detailCacheByLink[currentJob.link] : undefined;
  const batchTotal = batchProgress.total || filteredJobs.length;
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pagedJobs = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, safePageIndex, pageSize]);
  const companiesCount = useMemo(() => new Set(filteredJobs.map((j) => (j.company || '').trim()).filter(Boolean)).size, [filteredJobs]);
  const withSalaryCount = useMemo(() => filteredJobs.filter((j) => Boolean(j.salary?.trim())).length, [filteredJobs]);
  const isEmpty = dedupedJobs.length === 0 && !running;
  const noResults = !running && jobs.length > 0 && filteredJobs.length === 0;
  const emptyAfterRun = !running && jobs.length === 0 && Boolean(result || hint || errorCode);

  useEffect(() => {
    setPageIndex(0);
  }, [sourceFilter, keywordFilter, sortMode, hideDuplicates, jobs.length, pageSize]);

  const applyDetailToJobState = (jobLink: string, detail: JobDetailCacheItem, strategy?: DetailStrategy) => {
    setDetailCacheByLink((prev) => ({
      ...prev,
      [jobLink]: {
        ...detail,
        source: detail.source || strategy,
        updatedAt: detail.updatedAt || new Date().toISOString(),
      },
    }));
    setJobs((prev) =>
      prev.map((j) =>
        j.link === jobLink
          ? {
              ...j,
              description: detail.description || j.description,
              requirements: detail.requirements?.length ? detail.requirements : j.requirements,
              benefits: detail.benefits?.length ? detail.benefits : j.benefits,
            }
          : j,
      ),
    );
    setSelectedJob((prev) =>
      prev && prev.link === jobLink
        ? {
            ...prev,
            description: detail.description || prev.description,
            requirements: detail.requirements?.length ? detail.requirements : prev.requirements,
            benefits: detail.benefits?.length ? detail.benefits : prev.benefits,
          }
        : prev,
    );
  };

  const readProviderKeys = () => {
    let serpapi_key = '';
    let tavily_api_key = '';
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(SETTINGS_KEY) : null;
      const parsed = raw ? JSON.parse(raw) : null;
      serpapi_key = (parsed?.serpapi_key || '').trim();
      tavily_api_key = (parsed?.tavily_api_key || '').trim();
    } catch {
      /* ignore */
    }
    return { serpapi_key, tavily_api_key };
  };

  const enrichJobViaApi = async (job: JobListing): Promise<{ ok: boolean; detail?: JobDetailCacheItem; strategy?: DetailStrategy; credits?: number; error?: string }> => {
    const { serpapi_key, tavily_api_key } = readProviderKeys();
    const res = await fetch('/api/job-support/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        link: job.link,
        title: job.title,
        costMode: detailCostMode,
        serpapi_key: serpapi_key || undefined,
        tavily_api_key: tavily_api_key || undefined,
      }),
    });
    const data = (await res.json()) as EnrichPayload;
    if (!res.ok || !data.ok || !data.detail) {
      return { ok: false, error: data.hint || data.error || 'Không lấy được chi tiết cho job này.' };
    }
    return {
      ok: true,
      detail: data.detail,
      strategy: data.strategyUsed,
      credits: typeof data.creditsEstimate === 'number' ? data.creditsEstimate : 0,
    };
  };

  const enrichCurrentJob = async () => {
    if (!currentJob || detailLoading || isBatchRunning) return;
    setDetailLoading(true);
    setDetailStatus('');
    try {
      const result = await enrichJobViaApi(currentJob);
      if (!result.ok || !result.detail) {
        setDetailStatus(result.error || 'Không lấy được chi tiết cho job này.');
        return;
      }
      applyDetailToJobState(currentJob.link, result.detail, result.strategy);
      setBatchStatusByLink((prev) => ({ ...prev, [currentJob.link]: 'done' }));
      const strategyText = result.strategy ? `Nguồn: ${result.strategy}` : 'Đã cập nhật chi tiết.';
      const creditText = typeof result.credits === 'number' ? ` · Ước tính credit: ${result.credits}` : '';
      setDetailStatus(`${strategyText}${creditText}`);
    } catch {
      setDetailStatus('Không gọi được API lấy chi tiết.');
      setBatchStatusByLink((prev) => ({ ...prev, [currentJob.link]: 'failed' }));
    } finally {
      setDetailLoading(false);
    }
  };

  const enrichAllJobsSequential = async () => {
    if (isBatchRunning || filteredJobs.length === 0) return;
    cancelBatchRef.current = false;
    setIsBatchRunning(true);
    const queue = filteredJobs;
    let processed = 0;
    let done = 0;
    let failed = 0;
    let cached = 0;
    let credits = 0;
    setBatchProgress({
      total: queue.length,
      processed: 0,
      done: 0,
      failed: 0,
      cached: 0,
      credits: 0,
      currentLink: '',
    });
    setDetailStatus('');
    for (const job of queue) {
      if (cancelBatchRef.current) break;
      setBatchProgress((prev) => ({ ...prev, currentLink: job.link }));
      const hasCached = Boolean(detailCacheByLink[job.link]);
      if (hasCached) {
        cached += 1;
        processed += 1;
        setBatchStatusByLink((prev) => ({ ...prev, [job.link]: 'cached' }));
        setBatchProgress((prev) => ({ ...prev, processed, cached, currentLink: job.link }));
        continue;
      }
      try {
        const result = await enrichJobViaApi(job);
        if (result.ok && result.detail) {
          done += 1;
          credits += result.credits || 0;
          applyDetailToJobState(job.link, result.detail, result.strategy);
          setBatchStatusByLink((prev) => ({ ...prev, [job.link]: 'done' }));
        } else {
          failed += 1;
          setBatchStatusByLink((prev) => ({ ...prev, [job.link]: 'failed' }));
        }
      } catch {
        failed += 1;
        setBatchStatusByLink((prev) => ({ ...prev, [job.link]: 'failed' }));
      } finally {
        processed += 1;
        setBatchProgress((prev) => ({
          ...prev,
          processed,
          done,
          failed,
          cached,
          credits,
          currentLink: job.link,
        }));
      }
    }
    if (cancelBatchRef.current) {
      setDetailStatus('Đã dừng batch theo yêu cầu.');
    } else {
      setDetailStatus(`Batch hoàn tất: ${done} thành công, ${cached} cache, ${failed} lỗi.`);
    }
    setIsBatchRunning(false);
    cancelBatchRef.current = false;
  };

  const exportCurrentTableToExcel = async () => {
    const rows = filteredJobs.map((j, idx) => {
      const detail = detailCacheByLink[j.link];
      const requirements = detail?.requirements?.length ? detail.requirements : j.requirements;
      const benefits = detail?.benefits?.length ? detail.benefits : j.benefits;
      return {
        STT: idx + 1,
        Title: j.title || '',
        Company: j.company || '',
        Location: j.location || '',
        Salary: j.salary || '',
        Requirement: Array.isArray(requirements) ? requirements.join(' | ') : '',
        Benefits: Array.isArray(benefits) ? benefits.join(' | ') : '',
        Status: batchStatusByLink[j.link] || 'pending',
        Source: j.source || '',
        Link: j.link || '',
      };
    });
    if (!rows.length) {
      setDetailStatus('Không có dữ liệu để xuất Excel.');
      return;
    }
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'JobDetails');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      XLSX.writeFile(wb, `job-details-${stamp}.xlsx`);
      setDetailStatus(`Đã xuất Excel ${rows.length} dòng.`);
    } catch {
      setDetailStatus('Xuất Excel thất bại.');
    }
  };

  return (
    <div className="flex flex-col gap-10 min-h-screen font-inter">
      <header className="flex justify-between items-end pb-10" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-6">
            <div
              className="p-3.5 rounded-2xl border"
              style={{
                backgroundColor: 'rgba(249,115,22,0.10)',
                borderColor: JOB_SUPPORT_ACCENT_BORDER,
                boxShadow: `0 0 18px rgba(249,115,22,0.28)`,
              }}
            >
              <BriefcaseBusiness size={24} style={{ color: JOB_SUPPORT_ACCENT }} />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none" style={{ color: 'var(--text-primary)' }}>
              FIND JOBS (VN)
            </h1>
          </div>
          <div className="flex items-center gap-4 px-2">
            <div className="w-12 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80" style={{ color: JOB_SUPPORT_ACCENT }}>
              GOM TIN TUYỂN DỤNG ĐA NGUỒN · LỌC NHANH · CHỐNG TRÙNG
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-10 flex-1 px-6 md:px-8 pb-20">
        <div className="col-span-12 lg:col-span-4">
          <div className="sticky top-24 space-y-4">
            {/* Command Console (unique interaction frame) */}
            <div
              className="rounded-[28px] border p-5"
              style={{
                background: 'linear-gradient(180deg, var(--card-bg), var(--bg-primary))',
                borderColor: JOB_SUPPORT_ACCENT_BORDER,
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center border" style={{ borderColor: JOB_SUPPORT_ACCENT_BORDER, backgroundColor: 'rgba(249,115,22,0.16)' }}>
                    <Search size={16} style={{ color: JOB_SUPPORT_ACCENT }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: JOB_SUPPORT_ACCENT }}>JOB COMMAND</p>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Nhập nhanh → chạy → lọc</p>
                  </div>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                  Console
                </span>
              </div>

              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: JOB_SUPPORT_ACCENT_BORDER, backgroundColor: 'var(--card-bg)' }}>
                <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--hover-bg)' }}>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: JOB_SUPPORT_ACCENT }}>Query</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {useApiFastMode ? `API ${currentMode.label}` : 'Crawl4AI URL-in (mặc định)'}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <label className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)' }}>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Bật API (nhanh hơn nhưng ít hơn)</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        Tắt = dùng Crawl4AI URL-in, linh hoạt cho mọi website.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseApiFastMode((v) => !v)}
                      className="h-8 min-w-[76px] rounded-lg border px-3 text-[10px] font-black uppercase tracking-wider"
                      style={{
                        backgroundColor: useApiFastMode ? JOB_SUPPORT_ACCENT_SOFT : 'var(--card-bg)',
                        borderColor: useApiFastMode ? JOB_SUPPORT_ACCENT_BORDER : 'var(--border-color)',
                        color: useApiFastMode ? JOB_SUPPORT_ACCENT : 'var(--text-muted)',
                      }}
                    >
                      {useApiFastMode ? 'Bật' : 'Tắt'}
                    </button>
                  </label>

                  <input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && canRun && !running && run()}
                    placeholder="Từ khóa / vị trí…"
                    className="w-full h-12 rounded-xl px-4 outline-none"
                    style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && canRun && !running && run()}
                    placeholder="Địa điểm…"
                    className="w-full h-12 rounded-xl px-4 outline-none"
                    style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  {!useApiFastMode && (
                    <input
                      value={crawlUrl}
                      onChange={(e) => setCrawlUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && canRun && !running && run()}
                      placeholder="URL crawl (để trống sẽ tự tạo từ từ khóa + địa điểm)"
                      className="w-full h-12 rounded-xl px-4 outline-none"
                      style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  )}


                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    onMouseEnter={(e) => showTip(e, ['Nâng cao', 'Eco mode, max query và chỉnh nguồn domain'])}
                    onMouseMove={moveTip}
                    onMouseLeave={hideTip}
                    className="w-full mt-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border transition-all"
                    style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: showAdvanced ? JOB_SUPPORT_ACCENT : 'var(--text-muted)' }}
                  >
                    {showAdvanced ? 'Ẩn nâng cao' : 'Mở nâng cao'}
                  </button>

                  {showAdvanced && (
                    <div className="space-y-3 pt-1">
                      {useApiFastMode && (
                      <div className="p-4 rounded-2xl border" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center gap-3 mb-3">
                          <ShieldCheck size={16} style={{ color: JOB_SUPPORT_ACCENT }} />
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Chế độ chạy</p>
                            <p className="text-[9px] font-semibold mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>Chọn độ phủ kết quả theo nhu cầu.</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap no-scrollbar">
                          {(Object.keys(MODE_CONFIG) as CrawlMode[]).map((modeKey) => {
                            const mode = MODE_CONFIG[modeKey];
                            const active = crawlMode === modeKey;
                            return (
                              <button
                                key={modeKey}
                                type="button"
                                onClick={() => setCrawlMode(modeKey)}
                                onMouseEnter={(e) => showTip(e, ['Chế độ chạy', mode.tip])}
                                onMouseMove={moveTip}
                                onMouseLeave={hideTip}
                                className="px-2.5 py-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase leading-none transition-all border whitespace-nowrap"
                                style={
                                  active
                                    ? { backgroundColor: JOB_SUPPORT_ACCENT_SOFT, borderColor: JOB_SUPPORT_ACCENT_BORDER, color: JOB_SUPPORT_ACCENT }
                                    : { backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }
                                }
                              >
                                {mode.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      )}

                      {useApiFastMode && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Nguồn (site:)</p>
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border" style={{ borderColor: JOB_SUPPORT_ACCENT_BORDER, color: JOB_SUPPORT_ACCENT }}>
                            {companyPortals.split('\n').filter(Boolean).length} domains
                          </span>
                        </div>
                        <textarea
                          value={companyPortals}
                          onChange={(e) => setCompanyPortals(e.target.value)}
                          rows={4}
                          placeholder="Mỗi dòng một domain (vd: vietnamworks.com)"
                          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                          style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                        />
                      </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Sticky action bar inside console */}
                <div className="p-4 border-t flex flex-col gap-2" style={{ borderColor: JOB_SUPPORT_ACCENT_BORDER, backgroundColor: 'var(--hover-bg)' }}>
                  <button
                    type="button"
                    onClick={run}
                    disabled={running || !canRun}
                    onMouseEnter={(e) => showTip(e, ['Chạy gom tin', useApiFastMode ? 'Gọi SerpApi/Tavily và trả về danh sách job' : 'Gọi Crawl4AI URL-in để thu thập trực tiếp từ website'])}
                    onMouseMove={moveTip}
                    onMouseLeave={hideTip}
                    className="w-full h-14 text-sm font-black tracking-widest uppercase rounded-2xl border inline-flex items-center justify-center gap-3"
                    style={{
                      backgroundColor: JOB_SUPPORT_ACCENT,
                      borderColor: JOB_SUPPORT_ACCENT_BORDER,
                      color: 'var(--text-primary)',
                      boxShadow: `0 0 18px rgba(249,115,22,0.25)`,
                      opacity: running || !canRun ? 0.6 : 1,
                    }}
                  >
                    {running ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
                    {running ? 'ĐANG CHẠY...' : 'CHẠY'}
                  </button>
                  {!canRun && (
                    <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                      {useApiFastMode
                        ? 'Nhập ít nhất từ khóa hoặc địa điểm để chạy.'
                        : 'Nhập từ khóa/địa điểm hoặc URL tìm kiếm để chạy Crawl4AI.'}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSourceFilter('all');
                      setKeywordFilter('');
                      setSortMode('relevance');
                      setSelectedJob(null);
                    }}
                    onMouseEnter={(e) => showTip(e, ['Reset', 'Xóa filter hiện tại (source/keyword/sort/selection)'])}
                    onMouseMove={moveTip}
                    onMouseLeave={hideTip}
                    className="w-full py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all border"
                    style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                  >
                    Reset bộ lọc
                  </button>
                </div>
              </div>
            </div>

            <Card className="p-5 rounded-3xl" style={{ backgroundColor: 'var(--card-bg)', border: `1px solid ${JOB_SUPPORT_ACCENT_BORDER}` }}>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Provider</p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>{providerInfo}</p>
              <p className="text-[10px] mt-2 leading-relaxed opacity-90" style={{ color: 'var(--text-muted)' }}>{serpHint}</p>
            </Card>
          </div>
        </div>

        <div className={boardExpanded ? 'fixed inset-0 z-[120] p-4 md:p-8' : 'col-span-12 lg:col-span-8'}>
          <Card
            className={`h-full rounded-3xl relative flex flex-col ${boardExpanded ? 'min-h-[calc(100vh-2rem)] md:min-h-[calc(100vh-4rem)] overflow-y-auto' : 'min-h-[600px] overflow-hidden'}`}
            style={{ backgroundColor: 'var(--card-bg)', border: `1px solid ${JOB_SUPPORT_ACCENT_BORDER}` }}
          >
            {running ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 relative">
                <div className="p-6 rounded-[3rem] w-fit mx-auto border" style={{ backgroundColor: 'var(--card-bg)', borderColor: JOB_SUPPORT_ACCENT_BORDER }}>
                  <RefreshCw size={56} className="animate-spin" style={{ color: JOB_SUPPORT_ACCENT }} />
                </div>
                <div className="mt-8 text-center space-y-3">
                  <Typography variant="h3" className="font-black uppercase text-2xl tracking-widest mb-0" style={{ color: 'var(--text-primary)' }}>
                    ĐANG GOM DỮ LIỆU
                  </Typography>
                  <p className="text-xs font-black uppercase tracking-[0.35em] leading-loose" style={{ color: 'var(--text-muted)' }}>
                    Hệ thống đang chạy eco-first để tiết kiệm query. Vui lòng chờ…
                  </p>
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{providerInfo}</p>
                </div>
              </div>
            ) : filteredJobs.length > 0 ? (
              <>
                <div className="p-6 md:p-8 space-y-4" style={{ backgroundColor: 'var(--hover-bg)', borderBottom: `1px solid ${JOB_SUPPORT_ACCENT_BORDER}` }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <Typography variant="h3" className="mb-0 text-3xl font-bold uppercase" style={{ color: 'var(--text-primary)' }}>
                      RESULT BOARD
                    </Typography>

                    <div className="flex items-center justify-end gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setBoardExpanded((v) => !v)}
                      className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-2"
                      style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                    >
                      {boardExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      {boardExpanded ? 'Thu nhỏ' : 'Phóng to'}
                    </button>
                    {SHOW_VIEW_MODE_TOGGLES && (
                      <>
                        <IconToggle
                          active={viewMode === 'cards'}
                          onClick={() => setViewMode('cards')}
                          icon={<LayoutGrid size={16} />}
                          label="Cards"
                          accent={JOB_SUPPORT_ACCENT}
                        />
                        <IconToggle
                          active={viewMode === 'table'}
                          onClick={() => setViewMode('table')}
                          icon={<List size={16} />}
                          label="Table"
                          accent={JOB_SUPPORT_ACCENT}
                        />
                      </>
                    )}
                    {SHOW_EXTRA_BOARD_ACTIONS && (
                      <>
                        <IconToggle
                          active={focusDetail}
                          onClick={() => setFocusDetail((v) => !v)}
                          icon={<Map size={16} />}
                          label="Focus"
                          accent={JOB_SUPPORT_ACCENT}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const text = JSON.stringify({ jobTitle, location, sourceFilter, keywordFilter, sortMode }, null, 2);
                            try {
                              await navigator.clipboard.writeText(text);
                            } catch {
                              /* ignore */
                            }
                          }}
                          className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-2"
                          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                        >
                          <Copy size={14} />
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={exportCurrentTableToExcel}
                          className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-2"
                          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                        >
                          Export Excel
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={enrichAllJobsSequential}
                      disabled={isBatchRunning || filteredJobs.length === 0}
                      className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-2"
                      style={{
                        backgroundColor: JOB_SUPPORT_ACCENT_SOFT,
                        borderColor: JOB_SUPPORT_ACCENT_BORDER,
                        color: JOB_SUPPORT_ACCENT,
                        opacity: isBatchRunning || filteredJobs.length === 0 ? 0.6 : 1,
                      }}
                    >
                      {isBatchRunning ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                      Lấy chi tiết tất cả
                    </button>
                    {isBatchRunning && (
                      <button
                        type="button"
                        onClick={() => {
                          cancelBatchRef.current = true;
                        }}
                        className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-2"
                        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'rgba(244,63,94,0.35)', color: '#fb7185' }}
                      >
                        Dừng
                      </button>
                    )}
                  </div>

                  </div>
                  {false && (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Pill accent={JOB_SUPPORT_ACCENT} label={`${filteredJobs.length}/${dedupedJobs.length} jobs`} />
                        <Pill accent={JOB_SUPPORT_ACCENT} label={`${companiesCount} companies`} />
                        <Pill accent={JOB_SUPPORT_ACCENT} label={`${withSalaryCount} salary`} />
                        <Pill accent={JOB_SUPPORT_ACCENT} label={`${queriesUsed.length} queries`} />
                        <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{providerInfo}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-[10px]">
                        <Pill accent={JOB_SUPPORT_ACCENT} label={`Batch ${batchProgress.processed}/${batchTotal}`} />
                        <Pill accent={JOB_SUPPORT_ACCENT} label={`Done ${batchProgress.done}`} />
                        <Pill accent={JOB_SUPPORT_ACCENT} label={`Cache ${batchProgress.cached}`} />
                        <Pill accent={JOB_SUPPORT_ACCENT} label={`Fail ${batchProgress.failed}`} />
                        <Pill accent={JOB_SUPPORT_ACCENT} label={`Credit ~${batchProgress.credits}`} />
                        {batchProgress.currentLink && (
                          <span className="text-[10px] truncate max-w-[260px]" style={{ color: 'var(--text-muted)' }}>
                            {batchProgress.currentLink}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {(errorCode || hint) && (
                  <div className="px-8 md:px-10 pt-6 space-y-3">
                    {errorCode && (
                      <div className="rounded-2xl p-4 text-[11px]" style={{ backgroundColor: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', color: '#fb7185' }}>
                        <strong>Error code:</strong> {errorCode}
                      </div>
                    )}
                    {hint && (
                      <div className="rounded-2xl p-4 text-[11px]" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <strong>Gợi ý:</strong> {hint}
                      </div>
                    )}
                  </div>
                )}

                <div className="px-8 md:px-10 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="w-full h-11 rounded-xl px-3"
                      style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      {sourceOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt === 'all' ? 'Tất cả nguồn' : opt}
                        </option>
                      ))}
                    </select>
                    <select
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as SortMode)}
                      className="w-full h-11 rounded-xl px-3"
                      style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      <option value="relevance">Sắp xếp: Relevance</option>
                      <option value="latest">Sắp xếp: Mới nhất</option>
                      <option value="title">Sắp xếp: A-Z tiêu đề</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <input
                      value={keywordFilter}
                      onChange={(e) => setKeywordFilter(e.target.value)}
                      placeholder="Lọc theo tiêu đề/công ty/location/mô tả..."
                      className="w-full h-11 rounded-xl px-3"
                      style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    />
                    <label className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}>
                      <input type="checkbox" checked={hideDuplicates} onChange={(e) => setHideDuplicates(e.target.checked)} />
                      <span className="text-xs" style={{ color: 'var(--text-primary)' }}>Ẩn job trùng (title + company + location)</span>
                    </label>
                  </div>
                </div>

                {noResults && (
                  <div className="px-8 md:px-10 pt-6">
                    <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--hover-bg)', borderColor: JOB_SUPPORT_ACCENT_BORDER }}>
                      <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: JOB_SUPPORT_ACCENT }}>Không có kết quả phù hợp</p>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Thử đổi keyword, chọn “Tất cả nguồn”, hoặc tắt “Ẩn job trùng”.
                      </p>
                    </div>
                  </div>
                )}

                <div className="px-8 md:px-10 py-8 flex-1 space-y-6">
                  <div className="rounded-2xl overflow-hidden border border-[var(--border-color)]" style={{ backgroundColor: 'var(--card-bg)' }}>
                    <div
                      className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-muted)' }}
                    >
                      <span>Bảng kết quả ({filteredJobs.length} jobs)</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Rows</span>
                        <select
                          value={pageSize}
                          onChange={(e) => setPageSize(Number(e.target.value))}
                          className="h-8 rounded-lg px-2 text-[11px]"
                          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={30}>30</option>
                          <option value={50}>50</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setPageIndex((v) => Math.max(0, v - 1))}
                          disabled={safePageIndex <= 0}
                          className="h-8 px-2 rounded-lg border text-[10px] font-black"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)', opacity: safePageIndex <= 0 ? 0.45 : 1 }}
                        >
                          Prev
                        </button>
                        <span className="text-[10px] min-w-[64px] text-center" style={{ color: 'var(--text-secondary)' }}>
                          {safePageIndex + 1}/{totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPageIndex((v) => Math.min(totalPages - 1, v + 1))}
                          disabled={safePageIndex >= totalPages - 1}
                          className="h-8 px-2 rounded-lg border text-[10px] font-black"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)', opacity: safePageIndex >= totalPages - 1 ? 0.45 : 1 }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                    <div className="px-4 py-2 text-[10px]" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                      Hiển thị {pagedJobs.length} dòng trong trang hiện tại
                    </div>
                    <div className="overflow-auto" style={{ maxHeight: boardExpanded ? 'calc(100vh - 300px)' : '600px' }}>
                      <table className="w-full table-fixed text-left text-[12px]">
                        <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--card-bg)' }}>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                            <th className="p-3 w-[34%]">Vị trí</th>
                            <th className="p-3 w-[22%]">Công ty</th>
                            <th className="p-3 w-[14%]">Cấp bậc</th>
                            <th className="p-3 w-[16%]">Địa điểm</th>
                            <th className="p-3 w-[14%] text-right">Mức lương (VNĐ)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedJobs.map((j, idx) => {
                            const active = currentJob?.link === j.link;
                            return (
                              <tr
                                key={`${j.link}-${idx}`}
                                onClick={() => setSelectedJob(j)}
                                className="cursor-pointer"
                                style={{
                                  borderBottom: '1px solid var(--border-color)',
                                  backgroundColor: active ? 'rgba(249, 115, 22, 0.18)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.006)',
                                }}
                              >
                                <td className="p-3 align-middle h-14" style={{ color: 'var(--text-primary)' }}>
                                  <span className="font-semibold block truncate">{j.title || '—'}</span>
                                </td>
                                <td className="p-3 align-middle h-14 truncate" style={{ color: 'var(--text-secondary)' }}>{j.company || '—'}</td>
                                <td className="p-3 align-middle h-14 truncate" style={{ color: 'var(--text-secondary)' }}>{inferLevelForJob(j)}</td>
                                <td className="p-3 align-middle h-14 truncate" style={{ color: 'var(--text-secondary)' }}>{j.location || '—'}</td>
                                <td className="p-3 align-middle h-14 text-right truncate" style={{ color: 'var(--text-secondary)' }}>{inferSalaryForJob(j)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
                      {!currentJob ? (
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Chọn một dòng ở bảng để xem chi tiết việc làm.</p>
                      ) : (
                        <>
                          <div>
                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{currentJob.title}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                              {[currentJob.company, currentJob.location, currentJob.postedAt].filter(Boolean).join(' · ') || 'Thông tin cơ bản'}
                            </p>
                          </div>
                          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--border-color)' }}>
                            <table className="w-full text-left text-[12px]" style={{ backgroundColor: 'var(--card-bg)' }}>
                              <thead style={{ backgroundColor: 'var(--hover-bg)' }}>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                  <th className="p-3">Vị trí</th>
                                  <th className="p-3">Công ty</th>
                                  <th className="p-3">Cấp bậc</th>
                                  <th className="p-3">Địa điểm</th>
                                  <th className="p-3">Mức lương (VNĐ)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const fallbackText = [
                                    currentDetail?.description,
                                    currentJob.description,
                                    currentJob.snippet,
                                    currentJob.title,
                                  ]
                                    .filter(Boolean)
                                    .join(' \n ');
                                  const parsedCompany = inferCompanyFromText(fallbackText);
                                  const parsedLocation = inferLocationFromText(fallbackText);
                                  const parsedSalary = inferSalaryFromText(fallbackText);

                                  return (
                                    <tr style={{ color: 'var(--text-primary)' }}>
                                      <td className="p-3 align-top font-semibold">{currentJob.title || '—'}</td>
                                      <td className="p-3 align-top">{currentJob.company || parsedCompany || currentJob.source || '—'}</td>
                                      <td className="p-3 align-top">{inferLevelForJob(currentJob)}</td>
                                      <td className="p-3 align-top">{currentJob.location || parsedLocation || '—'}</td>
                                      <td className="p-3 align-top">{currentJob.salary || parsedSalary || inferSalaryForJob(currentJob) || '—'}</td>
                                    </tr>
                                  );
                                })()}
                              </tbody>
                            </table>
                          </div>
                          {currentDetail?.updatedAt && (
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              Chi tiết cập nhật: {new Date(currentDetail.updatedAt).toLocaleString()} {currentDetail.source ? `· ${currentDetail.source}` : ''}
                            </p>
                          )}
                          <a
                            href={currentJob.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold underline"
                            style={{ color: JOB_SUPPORT_ACCENT }}
                          >
                            Mở job gốc
                            <ExternalLink size={12} />
                          </a>
                        </>
                      )}
                  </div>

                  <pre className="rounded-2xl p-3 text-[11px] whitespace-pre-wrap max-h-[180px] overflow-auto mt-6" style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                    {result || 'Chưa có output raw.'}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-20 relative">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02]">
                  <Typography variant="h1" className="text-9xl font-black tracking-[0.5em] uppercase select-none">JOB NEXUS</Typography>
                </div>

                <div className="relative text-center space-y-8 max-w-md">
                  <div className="p-6 rounded-[3rem] w-fit mx-auto border border-dashed" style={{ backgroundColor: 'var(--card-bg)', borderColor: JOB_SUPPORT_ACCENT_BORDER }}>
                    <Map size={80} style={{ color: 'rgba(249,115,22,0.35)' }} />
                  </div>
                  <div className="space-y-4">
                    <Typography variant="h3" className="font-black uppercase text-2xl tracking-widest mb-0" style={{ color: 'var(--text-primary)' }}>
                      {running ? 'Đang chạy' : 'Sẵn sàng tìm việc'}
                    </Typography>
                    <p className="text-xs font-black uppercase tracking-[0.4em] leading-loose" style={{ color: 'var(--text-muted)' }}>
                      {running ? 'Hệ thống đang gom dữ liệu tuyển dụng. Vui lòng chờ…' : 'Nhập từ khóa và địa điểm để bắt đầu gom tin tuyển dụng.'}
                    </p>
                    {emptyAfterRun && (
                      <div className="rounded-2xl p-4 border text-left space-y-2" style={{ backgroundColor: 'var(--hover-bg)', borderColor: JOB_SUPPORT_ACCENT_BORDER }}>
                        <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: JOB_SUPPORT_ACCENT }}>
                          Đã chạy nhưng chưa lấy được job
                        </p>
                        {errorCode && (
                          <p className="text-[11px]" style={{ color: '#fb7185' }}>
                            <strong>Error:</strong> {errorCode}
                          </p>
                        )}
                        {hint && (
                          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            <strong>Gợi ý:</strong> {hint}
                          </p>
                        )}
                        {!hint && (
                          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            Thử URL TopCV dạng `https://www.topcv.vn/tim-viec-lam?keyword=seo` hoặc tắt API và để trống URL để hệ thống tự tạo.
                          </p>
                        )}
                      </div>
                    )}
                    {isEmpty && providerInfo && (
                      <p className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{providerInfo}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
      {mounted &&
        cursorTip &&
        typeof document !== 'undefined' &&
        createPortal(
          (() => {
            const pad = 10;
            const offset = 18;
            const maxW = 280;
            const lineH = 18;
            const estH = cursorTip.lines.length * lineH + 22;
            let left = cursorTip.x + offset;
            let top = cursorTip.y + offset;
            const vw = typeof window !== 'undefined' ? window.innerWidth : left + maxW;
            const vh = typeof window !== 'undefined' ? window.innerHeight : top + estH;
            left = Math.min(Math.max(pad, left), vw - maxW - pad);
            top = Math.min(Math.max(pad, top), vh - estH - pad);
            return (
              <div
                role="tooltip"
                className="pointer-events-none fixed z-[9999] max-w-[280px] rounded-xl border px-3 py-2 shadow-2xl backdrop-blur-md"
                style={{
                  left,
                  top,
                  backgroundColor: 'color-mix(in srgb, var(--card-bg) 88%, transparent)',
                  borderColor: JOB_SUPPORT_ACCENT_BORDER,
                }}
              >
                {cursorTip.lines.map((line, i) => (
                  <p
                    key={i}
                    className={`text-[10px] leading-snug ${i === 0 ? 'font-black uppercase tracking-widest' : 'font-semibold'} `}
                    style={{ color: i === 0 ? JOB_SUPPORT_ACCENT : 'var(--text-secondary)' }}
                  >
                    {line}
                  </p>
                ))}
              </div>
            );
          })(),
          document.body,
        )}
    </div>
  );

  function showTip(e: React.MouseEvent, lines: string[]) {
    setCursorTip({ x: e.clientX, y: e.clientY, lines });
  }
  function moveTip(e: React.MouseEvent) {
    setCursorTip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
  }
  function hideTip() {
    setCursorTip(null);
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
      <p className="text-[10px] uppercase font-black tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-2 border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
      <p className="text-[10px] uppercase font-black tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

function inferLevelFromTitle(title?: string): string {
  const text = (title || '').toLowerCase();
  if (/(intern|thực tập)/.test(text)) return 'Intern';
  if (/(fresher|junior|nhân viên)/.test(text)) return 'Junior';
  if (/(middle|mid[- ]level|chuyên viên)/.test(text)) return 'Middle';
  if (/(senior|sr\\.?|lead|trưởng|manager|giám đốc|head)/.test(text)) return 'Senior+';
  return '—';
}

function inferLevelForJob(job: JobListing): string {
  const fromTitle = inferLevelFromTitle(job.title);
  if (fromTitle !== '—') return fromTitle;
  const combined = [
    job.title,
    job.snippet,
    job.description,
    Array.isArray(job.requirements) ? job.requirements.join(' ') : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/(intern|thực tập|fresher)/.test(combined)) return 'Intern/Junior';
  if (/(junior|nhân viên|staff|associate)/.test(combined)) return 'Junior';
  if (/(middle|mid[- ]level|chuyên viên)/.test(combined)) return 'Middle';
  if (/(senior|sr\\.?|lead|trưởng|manager|giám đốc|head|director)/.test(combined)) return 'Senior+';
  return '—';
}

function inferCompanyFromText(text: string): string | null {
  const companyMatch =
    text.match(/(?:CÔNG TY|CTY)\s+[^|,\n]{4,120}/i) ||
    text.match(/(?:COMPANY)\s*[:\-]?\s*[^|,\n]{4,120}/i);
  return companyMatch?.[0]?.trim() || null;
}

function inferLocationFromText(text: string): string | null {
  const locationMatch = text.match(
    /(?:Hồ Chí Minh|TP\.?\s*HCM|Hà Nội|Đà Nẵng|Bình Dương|Cần Thơ|Hải Phòng|Nha Trang|Remote)/i,
  );
  return locationMatch?.[0]?.trim() || null;
}

function inferSalaryFromText(text: string): string | null {
  const salaryMatch = text.match(
    /\d{1,3}(?:[.,]\d{3})+(?:\s*-\s*\d{1,3}(?:[.,]\d{3})+)?\s*(?:VNĐ|VND)|\d{1,2}(?:[.,]\d+)?\s*(?:triệu|tr|m)(?:\s*-\s*\d{1,2}(?:[.,]\d+)?\s*(?:triệu|tr|m))?|USD\s*\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?/i,
  );
  return salaryMatch?.[0]?.trim() || null;
}

function inferSalaryForJob(job: JobListing): string {
  if (job.salary?.trim()) return job.salary.trim();
  const combined = [job.snippet, job.description, job.title].filter(Boolean).join(' ');
  return inferSalaryFromText(combined) || '—';
}

function oneLineSummary(items?: string[]): string {
  if (!Array.isArray(items) || items.length === 0) return '—';
  const first = items.find((x) => typeof x === 'string' && x.trim()) || '';
  const trimmed = first.trim();
  if (!trimmed) return '—';
  return trimmed.length > 56 ? `${trimmed.slice(0, 55)}…` : trimmed;
}

function statusStyle(status: BatchStatus | undefined): { label: string; style: React.CSSProperties } {
  if (status === 'done') {
    return { label: 'done', style: { color: '#22c55e', borderColor: 'rgba(34,197,94,0.35)', backgroundColor: 'rgba(34,197,94,0.12)' } };
  }
  if (status === 'cached') {
    return { label: 'cached', style: { color: JOB_SUPPORT_ACCENT, borderColor: JOB_SUPPORT_ACCENT_BORDER, backgroundColor: JOB_SUPPORT_ACCENT_SOFT } };
  }
  if (status === 'failed') {
    return { label: 'failed', style: { color: '#fb7185', borderColor: 'rgba(244,63,94,0.35)', backgroundColor: 'rgba(244,63,94,0.12)' } };
  }
  return { label: 'pending', style: { color: 'var(--text-muted)', borderColor: 'var(--border-color)', backgroundColor: 'transparent' } };
}

function Pill({ label, accent }: { label: string; accent: string }) {
  return (
    <span
      className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border"
      style={{ borderColor: JOB_SUPPORT_ACCENT_BORDER, color: accent, backgroundColor: JOB_SUPPORT_ACCENT_SOFT }}
    >
      {label}
    </span>
  );
}

function IconToggle({
  active,
  onClick,
  icon,
  label,
  accent,
  onTip,
  tipHandlers,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  accent: string;
  onTip?: string[];
  tipHandlers?: { showTip: (e: React.MouseEvent, lines: string[]) => void; moveTip: (e: React.MouseEvent) => void; hideTip: () => void };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => (onTip && tipHandlers ? tipHandlers.showTip(e, onTip) : undefined)}
      onMouseMove={(e) => (onTip && tipHandlers ? tipHandlers.moveTip(e) : undefined)}
      onMouseLeave={() => (onTip && tipHandlers ? tipHandlers.hideTip() : undefined)}
      className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-2 transition-all"
      style={
        active
          ? { backgroundColor: JOB_SUPPORT_ACCENT_SOFT, borderColor: JOB_SUPPORT_ACCENT_BORDER, color: accent }
          : { backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }
      }
    >
      {icon}
      {label}
    </button>
  );
}
