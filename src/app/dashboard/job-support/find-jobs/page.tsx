'use client';

import { useEffect, useMemo, useState } from 'react';
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
type SortMode = 'relevance' | 'latest' | 'title';
type PanelTab = 'quick' | 'filters' | 'sources';
type ViewMode = 'cards' | 'table';
type CrawlMode = 'eco' | 'more' | 'full';

const MODE_CONFIG: Record<CrawlMode, { label: string; ecoMode: boolean; maxQueries: number; tip: string }> = {
  eco: { label: 'Tiết kiệm', ecoMode: true, maxQueries: 4, tip: 'Tiết kiệm (max là 4).' },
  more: { label: 'Nhiều hơn', ecoMode: false, maxQueries: 6, tip: 'Nhiều hơn (max là 6).' },
  full: { label: 'Đầy đủ', ecoMode: false, maxQueries: 10, tip: 'Đầy đủ (max là 10).' },
};

function detectSmartPreset(jobTitle: string): keyof typeof PRESET_SOURCES {
  const k = jobTitle.toLowerCase();
  if (/(dev|developer|engineer|frontend|backend|fullstack|data|ai|it|qa|tester)/.test(k)) return 'Tech';
  if (/(marketing|content|seo|brand|social|media|ads|growth|pr|copywriter)/.test(k)) return 'Marketing';
  return 'General';
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

export default function FindJobsDashboardPage() {
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [companyPortals, setCompanyPortals] = useState(DEFAULT_SOURCES);
  const [result, setResult] = useState<string>('');
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [queriesUsed, setQueriesUsed] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [errorCode, setErrorCode] = useState<string>('');
  const [hint, setHint] = useState<string>('');
  const [providerInfo, setProviderInfo] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [crawlMode, setCrawlMode] = useState<CrawlMode>('eco');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>('quick');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [focusDetail, setFocusDetail] = useState(false);
  const [boardExpanded, setBoardExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const [cursorTip, setCursorTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const currentMode = MODE_CONFIG[crawlMode];

  const serpHint = useMemo(
    () =>
      'Chọn chế độ chạy để cân bằng giữa tiết kiệm credit và độ phủ kết quả.',
    [],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const hasSerp = Boolean(parsed?.serpapi_key?.trim?.());
      const hasTavily = Boolean(parsed?.tavily_api_key?.trim?.());
      setProviderInfo(
        hasSerp || hasTavily
          ? `API khả dụng: ${[hasTavily ? 'Tavily' : '', hasSerp ? 'SerpApi' : ''].filter(Boolean).join(' + ')}.`
          : 'Chưa thấy Tavily/SerpApi trong Cài đặt — nhập ít nhất một key trong Settings hoặc env server.',
      );
    } catch {
      setProviderInfo('Không đọc được settings local để kiểm tra Tavily/SerpApi.');
    }
  }, []);

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

  // Persist Find Jobs session cache whenever data changes
  useEffect(() => {
    if (typeof window === 'undefined' || !cacheReady) return;
    try {
      sessionStorage.setItem(
        FIND_JOBS_CACHE_KEY,
        JSON.stringify({
          jobTitle,
          location,
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
        }),
      );
    } catch {
      /* ignore storage quota issues */
    }
  }, [
    cacheReady,
    jobTitle,
    location,
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
  ]);

  const run = async () => {
    setRunning(true);
    setResult('');
    setJobs([]);
    setQueriesUsed([]);
    setSelectedJob(null);
    setErrorCode('');
    setHint('');
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

      const res = await fetch('/api/job-support/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Hidden smart mode: auto-pick source preset based on job title
        // when user did not manually customize source list.
        // This keeps UI clean while improving relevance.
        body: JSON.stringify({
          workspace: 'find-jobs',
          mode: 'dry-run',
          jobTitle,
          location,
          companyPortals:
            companyPortals.trim() === DEFAULT_SOURCES.trim()
              ? PRESET_SOURCES[detectSmartPreset(jobTitle)]
              : companyPortals,
          serpapi_key: serpapi_key || undefined,
          tavily_api_key: tavily_api_key || undefined,
          ecoMode: currentMode.ecoMode,
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
      setHint(out?.hint || data.hint || '');
      const stderr = (out?.stderr || '').trim();
      setResult(stderr ? `${out?.stdout?.trim() || ''}\n\n--- stderr ---\n${stderr}` : out?.stdout?.trim() || 'Done.');
    } catch {
      setResult('Không gọi được API.');
    } finally {
      setRunning(false);
    }
  };

  const canRun = Boolean(jobTitle.trim() || location.trim());

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
  const companiesCount = useMemo(() => new Set(filteredJobs.map((j) => (j.company || '').trim()).filter(Boolean)).size, [filteredJobs]);
  const withSalaryCount = useMemo(() => filteredJobs.filter((j) => Boolean(j.salary?.trim())).length, [filteredJobs]);
  const isEmpty = dedupedJobs.length === 0 && !running;
  const noResults = !running && jobs.length > 0 && filteredJobs.length === 0;

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
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{currentMode.label}</span>
                </div>
                <div className="p-4 space-y-3">
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
                    </div>
                  )}
                </div>

                {/* Sticky action bar inside console */}
                <div className="p-4 border-t flex flex-col gap-2" style={{ borderColor: JOB_SUPPORT_ACCENT_BORDER, backgroundColor: 'var(--hover-bg)' }}>
                  <button
                    type="button"
                    onClick={run}
                    disabled={running || !canRun}
                    onMouseEnter={(e) => showTip(e, ['Chạy gom tin', 'Gọi SerpApi/Tavily và trả về danh sách job'])}
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
                  {!canRun && <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Nhập ít nhất từ khóa hoặc địa điểm để chạy.</p>}
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
                  </div>

                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill accent={JOB_SUPPORT_ACCENT} label={`${filteredJobs.length}/${dedupedJobs.length} jobs`} />
                    <Pill accent={JOB_SUPPORT_ACCENT} label={`${companiesCount} companies`} />
                    <Pill accent={JOB_SUPPORT_ACCENT} label={`${withSalaryCount} salary`} />
                    <Pill accent={JOB_SUPPORT_ACCENT} label={`${queriesUsed.length} queries`} />
                    <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{providerInfo}</span>
                  </div>
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

                <div className="px-8 md:px-10 py-8 flex-1">
                  <div className={`grid grid-cols-1 ${focusDetail ? '' : 'lg:grid-cols-2'} gap-6`}>
                    {!focusDetail && (
                      <div className="rounded-2xl overflow-hidden border border-[var(--border-color)]" style={{ backgroundColor: 'var(--card-bg)' }}>
                        <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
                          Job stream ({filteredJobs.length})
                        </div>
                        <div
                          className="overflow-auto p-3 space-y-2"
                          style={{ maxHeight: boardExpanded ? 'calc(100vh - 320px)' : '560px' }}
                        >
                          {viewMode === 'table' ? (
                            <table className="w-full text-left text-[11px]">
                              <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--card-bg)' }}>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                  <th className="p-3 w-[52%]">Tiêu đề</th>
                                  <th className="p-3 w-[20%]">Lương</th>
                                  <th className="p-3">Nguồn</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredJobs.map((j, idx) => {
                                  const active = currentJob?.link === j.link;
                                  return (
                                    <tr
                                      key={`${j.link}-${idx}`}
                                      onClick={() => setSelectedJob(j)}
                                      className="cursor-pointer"
                                      style={{
                                        borderBottom: '1px solid var(--border-color)',
                                        backgroundColor: active ? JOB_SUPPORT_ACCENT_SOFT : 'transparent',
                                      }}
                                    >
                                      <td className="p-3 align-top" style={{ color: 'var(--text-primary)' }}>
                                        <span className="font-bold">{j.title}</span>
                                        {(j.company || j.location) && (
                                          <div className="text-[10px] opacity-75 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                            {[j.company, j.location].filter(Boolean).join(' · ')}
                                          </div>
                                        )}
                                      </td>
                                      <td className="p-3 align-top" style={{ color: 'var(--text-secondary)' }}>{j.salary || '-'}</td>
                                      <td className="p-3 align-top" style={{ color: 'var(--text-secondary)' }}>
                                        {j.source}
                                        {j.engine && <span className="opacity-70"> ({j.engine})</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : (
                            filteredJobs.map((j, idx) => {
                              const active = currentJob?.link === j.link;
                              const hasSalary = Boolean(j.salary && j.salary !== '-');
                              return (
                                <button
                                  type="button"
                                  key={`${j.link}-${idx}`}
                                  onClick={() => setSelectedJob(j)}
                                  className="w-full text-left rounded-2xl border px-4 py-3 transition-all"
                                  style={{
                                    backgroundColor: active ? JOB_SUPPORT_ACCENT_SOFT : 'var(--hover-bg)',
                                    borderColor: active ? JOB_SUPPORT_ACCENT_BORDER : 'var(--border-color)',
                                    boxShadow: active ? `0 0 0 1px ${JOB_SUPPORT_ACCENT_BORDER}` : 'none',
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-black uppercase tracking-wide truncate" style={{ color: 'var(--text-primary)' }}>
                                        {j.title}
                                      </p>
                                      <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                                        {[j.company, j.location].filter(Boolean).join(' · ') || '—'}
                                      </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                      <span
                                        className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border"
                                        style={{
                                          borderColor: hasSalary ? JOB_SUPPORT_ACCENT_BORDER : 'var(--border-color)',
                                          color: hasSalary ? JOB_SUPPORT_ACCENT : 'var(--text-muted)',
                                          backgroundColor: hasSalary ? 'rgba(249,115,22,0.10)' : 'transparent',
                                        }}
                                      >
                                        {j.salary || '—'}
                                      </span>
                                      <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                                        {j.source}{j.engine ? ` · ${j.engine}` : ''}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

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
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <Field label="Mức lương" value={currentJob.salary || 'Chưa có'} />
                            <Field label="Nguồn" value={currentJob.source} />
                          </div>
                          <DetailBlock
                            title="Mô tả công việc"
                            content={currentJob.description || currentJob.snippet || 'Chưa có mô tả chi tiết từ nguồn index.'}
                          />
                          <ListBlock title="Yêu cầu ứng viên" items={currentJob.requirements} emptyText="Chưa tách được yêu cầu từ nguồn này." />
                          <ListBlock title="Phúc lợi" items={currentJob.benefits} emptyText="Chưa tách được phúc lợi từ nguồn này." />
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

function DetailBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</p>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{content}</p>
    </div>
  );
}

function ListBlock({ title, items, emptyText }: { title: string; items?: string[]; emptyText: string }) {
  const valid = Array.isArray(items) ? items.filter(Boolean).slice(0, 6) : [];
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</p>
      {valid.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{emptyText}</p>
      ) : (
        <ul className="text-xs space-y-1" style={{ color: 'var(--text-primary)' }}>
          {valid.map((item, idx) => (
            <li key={`${title}-${idx}`}>- {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
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
