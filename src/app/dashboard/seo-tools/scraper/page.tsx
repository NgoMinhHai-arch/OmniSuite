'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Stethoscope,
  Globe,
  Radar,
  FlaskConical,
  Download,
  X,
  Link2,
  LayoutList,
  Tags,
  AlertTriangle,
  Image as ImageIcon,
  Bot,
  Trash2,
  Search,
} from 'lucide-react';
import { useTasks } from '@/shared/lib/context/TaskContext';

type KeywordRow = { word: string; count: number; density: string };
type HeadingRow = { tag: string; text: string };
type HeadingNode = { tag: 'h1' | 'h2' | 'h3'; text: string; children?: HeadingNode[]; isSkippedLevel?: boolean };
type SeoIssue = { id: string; severity: 'error' | 'warning' | 'info'; category: string; message: string };
type ImageAuditRow = {
  src: string;
  alt: string;
  title: string;
  sizeKb: number | null;
  width: number | null;
  height: number | null;
};
type ImageAuditGroup = {
  groupId: string;
  pageUrl: string;
  total: number;
  missingAlt: number;
  missingTitle: number;
  images: ImageAuditRow[];
};
type LinkAuditRow = {
  source: string;
  target: string;
  anchor: string;
  rel: string;
  bucket: 'internal' | 'external';
};

type ScrapeResult = {
  url: string;
  statusCode?: number;
  title?: string;
  canonical?: string;
  robots?: string;
  h1?: string;
  wordCount?: number;
  keywordDensity?: string;
  imageStats?: { total?: number; missingAlt?: number; missingTitle?: number };
  images?: Array<{ src: string; alt: string; title: string; sizeKb?: number; width?: number; height?: number }>;
  headings?: HeadingRow[];
  headingTree?: HeadingNode[];
  headingCounts?: Record<string, number>;
  topKeywords?: KeywordRow[];
  linkStats?: {
    internal?: number;
    external?: number;
    nofollow?: number;
    dofollow?: number;
    anchor?: { internal?: number; external?: number; nofollow?: number; dofollow?: number };
    resource?: { internal?: number; external?: number; nofollow?: number; dofollow?: number };
  };
  collectedLinks?: {
    internal?: string[];
    external?: string[];
    anchorLinks?: { internal?: string[]; external?: string[] };
    resourceLinks?: { internal?: string[]; external?: string[] };
  };
  issues?: SeoIssue[];
};

const BRAND = {
  accent: 'text-violet-300',
  panel: 'border-violet-400/25 bg-violet-500/[0.06]',
  panelStrong: 'border-violet-400/35 bg-violet-500/[0.12]',
};

export default function WebsiteCheckupPage() {
  const { startTask, getTask } = useTasks();
  const [seedInput, setSeedInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [seedInputError, setSeedInputError] = useState('');
  const [status, setStatus] = useState('Sẵn sàng kiểm tra website');
  const [loading, setLoading] = useState(false);
  const HOMEPAGE_MAX_LINES = 5;
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [detail, setDetail] = useState<ScrapeResult | null>(null);
  const [tab, setTab] = useState<'keywords' | 'headings' | 'links' | 'issues'>('keywords');
  const [activeDashboard, setActiveDashboard] = useState<'structure' | 'images' | 'links' | 'googlebot'>('structure');
  const [imageQuery, setImageQuery] = useState('');
  const [imageFilter, setImageFilter] = useState<'all' | 'missing_alt' | 'missing_title'>('all');
  const [linkQuery, setLinkQuery] = useState('');
  const [linkFilter, setLinkFilter] = useState<'all' | 'internal' | 'external' | 'nofollow'>('all');
  const [imageDetailGroup, setImageDetailGroup] = useState<ImageAuditGroup | null>(null);
  const activeDashboardLabel =
    activeDashboard === 'images'
      ? 'Hình ảnh'
      : activeDashboard === 'links'
        ? 'Link'
        : activeDashboard === 'googlebot'
          ? 'Googlebot'
          : 'Cấu trúc';

  const SCRAPE_TASK_ID = 'website_checkup_scrape';
  const DISCOVERY_TASK_ID = 'website_checkup_discovery';

  const seedCount = useMemo(
    () => seedInput.split('\n').map((v) => v.trim()).filter(Boolean).length,
    [seedInput],
  );
  const normalizeHomepageUrl = (raw: string): string | null => {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(withProtocol);
      const isHomepagePath = parsed.pathname === '/' || parsed.pathname === '';
      if (!isHomepagePath || parsed.search || parsed.hash) return null;
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return null;
    }
  };
  const normalizeScrapeUrl = (raw: string): string | null => {
    const candidate = raw.trim();
    if (!candidate) return null;
    const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    try {
      const parsed = new URL(withProtocol);
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return null;
    }
  };
  const imageGroups = useMemo<ImageAuditGroup[]>(
    () =>
      results.map((row, rowIdx) => {
        const images = (row.images || []).map((img) => ({
          src: img.src,
          alt: img.alt || '',
          title: img.title || '',
          sizeKb: typeof img.sizeKb === 'number' ? img.sizeKb : null,
          width: typeof img.width === 'number' ? img.width : null,
          height: typeof img.height === 'number' ? img.height : null,
        }));
        return {
          groupId: `${row.url}-${rowIdx}`,
          pageUrl: row.url,
          total: images.length,
          missingAlt: images.filter((img) => !img.alt.trim()).length,
          missingTitle: images.filter((img) => !img.title.trim()).length,
          images,
        };
      }),
    [results],
  );
  const filteredImageGroups = useMemo(() => {
    return imageGroups.filter((group) => {
      const byFilter =
        imageFilter === 'all' ||
        (imageFilter === 'missing_alt' && group.missingAlt > 0) ||
        (imageFilter === 'missing_title' && group.missingTitle > 0);
      const byQuery =
        !imageQuery.trim() ||
        group.pageUrl.toLowerCase().includes(imageQuery.toLowerCase()) ||
        group.images.some(
          (img) =>
            img.src.toLowerCase().includes(imageQuery.toLowerCase()) ||
            img.alt.toLowerCase().includes(imageQuery.toLowerCase()) ||
            img.title.toLowerCase().includes(imageQuery.toLowerCase()),
        );
      return byFilter && byQuery;
    });
  }, [imageFilter, imageQuery, imageGroups]);
  const linkRows = useMemo<LinkAuditRow[]>(
    () =>
      results.flatMap((row) => {
        const internal = (row.collectedLinks?.internal || []).map((target) => ({
          source: row.url,
          target,
          anchor: '-',
          rel: 'unknown',
          bucket: 'internal' as const,
        }));
        const external = (row.collectedLinks?.external || []).map((target) => ({
          source: row.url,
          target,
          anchor: '-',
          rel: 'unknown',
          bucket: 'external' as const,
        }));
        return [...internal, ...external];
      }),
    [results],
  );
  const filteredLinkRows = useMemo(() => {
    return linkRows.filter((row) => {
      const byFilter =
        linkFilter === 'all' ||
        (linkFilter === 'internal' && row.bucket === 'internal') ||
        (linkFilter === 'external' && row.bucket === 'external') ||
        (linkFilter === 'nofollow' && row.rel.toLowerCase().includes('nofollow'));
      const query = linkQuery.trim().toLowerCase();
      const byQuery =
        !query ||
        row.source.toLowerCase().includes(query) ||
        row.target.toLowerCase().includes(query) ||
        row.anchor.toLowerCase().includes(query);
      return byFilter && byQuery;
    });
  }, [linkFilter, linkQuery, linkRows]);
  const googlebotRows = useMemo(
    () =>
      results.map((row) => {
        const robotsText = (row.robots || '').toLowerCase();
        const isNoindex = robotsText.includes('noindex');
        const statusCode = row.statusCode || 0;
        const status =
          statusCode >= 500 || isNoindex ? 'fail' : statusCode >= 400 || !row.canonical ? 'warn' : 'pass';
        return {
          url: row.url,
          statusCode,
          robots: row.robots || 'index, follow',
          canonical: row.canonical || '-',
          status,
          note:
            status === 'fail'
              ? 'URL lỗi hoặc bị noindex'
              : status === 'warn'
                ? 'Cần kiểm tra canonical/status'
                : 'Sẵn sàng cho crawl/index',
        };
      }),
    [results],
  );
  const googlebotSummary = useMemo(
    () => ({
      pass: googlebotRows.filter((r) => r.status === 'pass').length,
      warn: googlebotRows.filter((r) => r.status === 'warn').length,
      fail: googlebotRows.filter((r) => r.status === 'fail').length,
      total: googlebotRows.length,
    }),
    [googlebotRows],
  );

  useEffect(() => {
    const saved = sessionStorage.getItem('website_checkup_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          seedInput: string;
          urlInput: string;
          status: string;
          results: ScrapeResult[];
        };
        setSeedInput(parsed.seedInput || '');
        setUrlInput(parsed.urlInput || '');
        setStatus(parsed.status || 'Sẵn sàng kiểm tra website');
        setResults(parsed.results || []);
      } catch {
        // ignore invalid session state
      }
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(
      'website_checkup_state',
      JSON.stringify({ seedInput, urlInput, status, results }),
    );
  }, [seedInput, urlInput, status, results]);

  useEffect(() => {
    const scrapeTask = getTask(SCRAPE_TASK_ID);
    if (scrapeTask) {
      setLoading(scrapeTask.status === 'running');
      if (scrapeTask.progress) setStatus(scrapeTask.progress);
      if (Array.isArray(scrapeTask.results) && scrapeTask.results.length) {
        setResults(scrapeTask.results as ScrapeResult[]);
      }
    }

    const discoveryTask = getTask(DISCOVERY_TASK_ID);
    if (discoveryTask?.status === 'running') {
      setLoading(true);
      if (discoveryTask.progress) setStatus(discoveryTask.progress);
    }
  }, [getTask]);

  const runDiscovery = async () => {
    const rawLines = seedInput.split('\n').map((v) => v.trim()).filter(Boolean);
    if (!rawLines.length) {
      const msg = 'Vui lòng nhập ít nhất 1 URL trang chủ';
      setSeedInputError(msg);
      setStatus(msg);
      return;
    }

    if (rawLines.length > HOMEPAGE_MAX_LINES) {
      const msg = `Chỉ được nhập tối đa ${HOMEPAGE_MAX_LINES} trang chủ`;
      setSeedInputError(msg);
      setStatus(msg);
      return;
    }

    const normalizedSeeds = rawLines.map((raw) => normalizeHomepageUrl(raw));
    const invalidCount = normalizedSeeds.filter((v) => !v).length;
    if (invalidCount > 0) {
      const msg = `Có ${invalidCount} dòng không đúng định dạng URL trang chủ`;
      setSeedInputError(msg);
      setStatus(msg);
      return;
    }
    setSeedInputError('');

    setLoading(true);
    startTask(DISCOVERY_TASK_ID, async (update) => {
      update({ progress: 'Đang khám phá URL từ danh sách trang chủ...' });
      try {
        let discovered: string[] = [];
        for (const homepageUrl of normalizedSeeds as string[]) {
          const res = await fetch('/api/scrape/discovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ homepageUrl }),
          });
          if (res.ok) {
            const data = (await res.json()) as { links?: string[] };
            discovered = discovered.concat(data.links || []);
          }
        }

        const merged = Array.from(new Set([...urlInput.split('\n').map((v) => v.trim()).filter(Boolean), ...discovered]));
        setUrlInput(merged.slice(0, 500).join('\n'));
        const done = `Đã thêm ${discovered.length} URL vào danh sách quét`;
        setStatus(done);
        update({ progress: done });
      } catch {
        const err = 'Lỗi khi khám phá URL';
        setStatus(err);
        update({ progress: err });
      } finally {
        setLoading(false);
      }
    });
  };

  const runScrape = async () => {
    const normalizedUrls = urlInput
      .split('\n')
      .map((v) => normalizeScrapeUrl(v))
      .filter((v): v is string => Boolean(v));
    const urls = Array.from(new Set(normalizedUrls)).slice(0, 200);
    if (!urls.length) {
      setStatus('Danh sách URL không hợp lệ');
      return;
    }

    const existingScrapeTask = getTask(SCRAPE_TASK_ID);
    if (existingScrapeTask?.status === 'running') {
      setLoading(true);
      setStatus(existingScrapeTask.progress || 'Đang quét dữ liệu website...');
      return;
    }

    setLoading(true);
    setStatus(`Đang quét dữ liệu website... 0/${urls.length}`);
    startTask(SCRAPE_TASK_ID, async (update) => {
      const total = urls.length;
      const CLIENT_BATCH_SIZE = 10;
      let processed = 0;
      let collected: ScrapeResult[] = [];
      update({ progress: `Đang quét dữ liệu website... 0/${total}` });
      try {
        for (let i = 0; i < urls.length; i += CLIENT_BATCH_SIZE) {
          const chunk = urls.slice(i, i + CLIENT_BATCH_SIZE);
          const payload = { urls: chunk };
          const res = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error('Scrape failed');
          const data = (await res.json()) as ScrapeResult[];
          collected = [...collected, ...data];
          processed = Math.min(total, collected.length);
          setResults(collected);
          update({
            progress: `Đang quét dữ liệu website... ${processed}/${total}`,
            results: collected,
          });
        }

        const done = `Hoàn tất: ${collected.length}/${total} URL đã phân tích`;
        setStatus(done);
        update({ progress: done, results: collected });
      } catch {
        const err = 'Lỗi khi quét dữ liệu';
        setStatus(err);
        update({ progress: err, status: 'error' });
      } finally {
        setLoading(false);
      }
    });
  };

  const exportCsv = () => {
    if (!results.length) return;
    const headers = ['URL', 'Status', 'Title', 'H1', 'WordCount', 'KeywordDensity', 'Internal', 'External', 'NoFollow', 'DoFollow'];
    const rows = results.map((r) => [
      r.url,
      String(r.statusCode || 0),
      JSON.stringify(r.title || ''),
      JSON.stringify(r.h1 || ''),
      String(r.wordCount || 0),
      String(r.keywordDensity || '0%'),
      String(r.linkStats?.internal || 0),
      String(r.linkStats?.external || 0),
      String(r.linkStats?.nofollow || 0),
      String(r.linkStats?.dofollow || 0),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `website-checkup-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const renderTree = (nodes: HeadingNode[] = [], depth = 0) =>
    nodes.map((node, idx) => (
      <div key={`${node.tag}-${node.text}-${idx}`} style={{ marginLeft: depth * 16 }} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-200">{node.tag}</span>
          <span className="text-sm text-slate-200">{node.text}</span>
          {node.isSkippedLevel ? <span className="text-[10px] uppercase text-amber-300">skip-level</span> : null}
        </div>
        {node.children?.length ? <div className="mt-2 space-y-2">{renderTree(node.children, depth + 1)}</div> : null}
      </div>
    ));

  return (
    <div className="flex min-h-screen flex-col gap-8 p-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <header className="flex items-end justify-between pb-10" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-6">
            <div
              className="rounded-2xl border p-3.5 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
              style={{ backgroundColor: 'rgba(168,85,247,0.12)', borderColor: 'rgba(168,85,247,0.35)' }}
            >
              <Stethoscope className="text-violet-300" size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none" style={{ color: 'var(--text-primary)' }}>
              KIỂM TRA SỨC KHỎE WEBSITE
            </h1>
          </div>
          <div className="flex items-center gap-4 px-2">
            <div className="h-px w-12 bg-white/10" />
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-300/90">
              CHẨN ĐOÁN CẤU TRÚC - NỘI DUNG - LIÊN KẾT SEO
            </p>
          </div>
          <p className="px-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{status}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/[0.08] p-1">
          {[
            { id: 'structure', label: 'Cấu trúc', icon: Radar },
            { id: 'images', label: 'Hình ảnh', icon: ImageIcon },
            { id: 'links', label: 'Link', icon: Link2 },
            { id: 'googlebot', label: 'Googlebot', icon: Bot },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveDashboard(item.id as 'structure' | 'images' | 'links' | 'googlebot')}
              className={`rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                activeDashboard === item.id
                  ? 'border-violet-300/40 bg-violet-500/20 text-violet-100'
                  : 'border-transparent bg-transparent text-slate-300 hover:border-violet-300/20 hover:bg-violet-500/10'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <item.icon size={12} />
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </header>

      {activeDashboard === 'structure' ? (
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className={`rounded-3xl border p-6 lg:col-span-5 ${BRAND.panel}`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-10 w-1 rounded-full bg-violet-400/80 shadow-[0_0_10px_rgba(168,85,247,0.45)]" />
            <div className="flex items-center gap-2 text-slate-100">
              <Radar size={18} className={BRAND.accent} />
              <h2 className="text-base font-black uppercase tracking-wider">Nhập trang chủ</h2>
            </div>
          </div>
          <textarea
            value={seedInput}
            onChange={(e) => {
              const lines = e.target.value
                .split('\n')
                .map((line) => line.replace(/\r/g, ''));
              if (lines.length <= HOMEPAGE_MAX_LINES) {
                setSeedInput(lines.join('\n'));
                const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
                const invalidCount = nonEmpty.filter((line) => !normalizeHomepageUrl(line)).length;
                if (invalidCount > 0) {
                  setSeedInputError(`Có ${invalidCount} dòng không đúng định dạng URL trang chủ`);
                } else {
                  setSeedInputError('');
                }
                return;
              }
              setSeedInput(lines.slice(0, HOMEPAGE_MAX_LINES).join('\n'));
              setSeedInputError(`Chỉ được nhập tối đa ${HOMEPAGE_MAX_LINES} trang chủ`);
            }}
            disabled={loading}
            placeholder="Mỗi dòng 1 URL trang chủ (vd: https://example.com)"
            title={`Nhập URL trang chủ (tối đa ${HOMEPAGE_MAX_LINES} dòng): ${seedCount}/${HOMEPAGE_MAX_LINES}`}
            className="h-32 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200 outline-none focus:border-violet-400/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {seedInputError ? (
            <p className="mt-2 text-xs font-semibold text-rose-300">{seedInputError}</p>
          ) : null}
          <button
            onClick={runDiscovery}
            disabled={loading || !seedInput.trim() || Boolean(seedInputError)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-violet-300/30 bg-violet-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-violet-100 disabled:opacity-40"
          >
            <Globe size={14} />
            Khám phá URL
          </button>
        </div>

        <div className={`rounded-3xl border p-6 lg:col-span-7 ${BRAND.panel}`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-10 w-1 rounded-full bg-fuchsia-400/80 shadow-[0_0_10px_rgba(217,70,239,0.45)]" />
            <div className="flex items-center gap-2 text-slate-100">
              <FlaskConical size={18} className="text-fuchsia-300" />
              <h2 className="text-base font-black uppercase tracking-wider">Danh sách URL quét</h2>
            </div>
          </div>
          <textarea
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={loading}
            placeholder="Mỗi dòng một URL (có thể nhập/xóa thủ công)"
            className="h-32 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200 outline-none focus:border-violet-400/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={runScrape}
              disabled={loading || !urlInput.trim()}
              className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-300/30 bg-fuchsia-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-fuchsia-100 disabled:opacity-40"
            >
              <Stethoscope size={14} />
              Bắt đầu audit
            </button>
            <button
              onClick={exportCsv}
              disabled={loading || !results.length}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-100 disabled:opacity-40"
            >
              <Download size={14} />
              Xuất CSV
            </button>
          </div>
        </div>
      </section>
      ) : activeDashboard === 'images' ? (
      <section className={`rounded-3xl border p-6 ${BRAND.panel}`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-slate-100">Hình ảnh</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/80">
              image audit từ danh sách URL đã quét
            </p>
          </div>
          <div className="rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-violet-100">Live data</div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Tổng ảnh</p>
            <p className="mt-1 text-xl font-black text-violet-100">{imageGroups.reduce((sum, x) => sum + x.total, 0)}</p>
          </div>
          <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-rose-200">Thiếu ALT</p>
            <p className="mt-1 text-xl font-black text-rose-100">{imageGroups.reduce((sum, x) => sum + x.missingAlt, 0)}</p>
          </div>
          <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber-200">Thiếu TITLE</p>
            <p className="mt-1 text-xl font-black text-amber-100">{imageGroups.reduce((sum, x) => sum + x.missingTitle, 0)}</p>
          </div>
          <div className="rounded-xl border border-sky-300/20 bg-sky-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-sky-200">Tổng URL có ảnh</p>
            <p className="mt-1 text-xl font-black text-sky-100">{imageGroups.filter((x) => x.total > 0).length}</p>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={imageQuery}
              onChange={(e) => setImageQuery(e.target.value)}
              placeholder="Tìm theo URL trang..."
              className="w-full rounded-xl border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-violet-400/40"
            />
          </div>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'missing_alt', label: 'Thiếu alt' },
            { id: 'missing_title', label: 'Thiếu title' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setImageFilter(item.id as 'all' | 'missing_alt' | 'missing_title')}
              className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                imageFilter === item.id
                  ? 'border-violet-300/40 bg-violet-500/20 text-violet-100'
                  : 'border-white/10 bg-white/[0.03] text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto custom-scrollbar-indigo rounded-2xl border border-white/10">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-white/[0.03] uppercase text-slate-400">
              <tr>
                <th className="p-2">Page URL</th>
                <th className="p-2">Tổng ảnh</th>
                <th className="p-2">Thiếu Alt</th>
                <th className="p-2">Thiếu Title</th>
                <th className="p-2">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {filteredImageGroups.map((group) => (
                <tr key={group.groupId} className="border-t border-white/5">
                  <td className="p-2 text-slate-300">{group.pageUrl}</td>
                  <td className="p-2 text-slate-200">{group.total}</td>
                  <td className="p-2 text-slate-200">{group.missingAlt}</td>
                  <td className="p-2 text-slate-200">{group.missingTitle}</td>
                  <td className="p-2">
                    <button
                      onClick={() => setImageDetailGroup(group)}
                      disabled={!group.total}
                      className="rounded-lg border border-violet-300/30 bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-100 disabled:opacity-40"
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      ) : activeDashboard === 'links' ? (
      <section className={`rounded-3xl border p-6 ${BRAND.panel}`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-slate-100">Link</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/80">
              link explorer từ URL đã quét
            </p>
          </div>
          <div className="rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-violet-100">Live data</div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Tổng links</p>
            <p className="mt-1 text-xl font-black text-violet-100">{linkRows.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-emerald-200">Internal</p>
            <p className="mt-1 text-xl font-black text-emerald-100">{linkRows.filter((x) => x.bucket === 'internal').length}</p>
          </div>
          <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber-200">External</p>
            <p className="mt-1 text-xl font-black text-amber-100">{linkRows.filter((x) => x.bucket === 'external').length}</p>
          </div>
          <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-rose-200">Nofollow</p>
            <p className="mt-1 text-xl font-black text-rose-100">
              {results.reduce((sum, row) => sum + (row.linkStats?.nofollow || 0), 0)}
            </p>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={linkQuery}
              onChange={(e) => setLinkQuery(e.target.value)}
              placeholder="Tìm source/target/anchor..."
              className="w-full rounded-xl border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-violet-400/40"
            />
          </div>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'internal', label: 'Internal' },
            { id: 'external', label: 'External' },
            { id: 'nofollow', label: 'Nofollow' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setLinkFilter(item.id as 'all' | 'internal' | 'external' | 'nofollow')}
              className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                linkFilter === item.id
                  ? 'border-violet-300/40 bg-violet-500/20 text-violet-100'
                  : 'border-white/10 bg-white/[0.03] text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto custom-scrollbar-indigo rounded-2xl border border-white/10">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="bg-white/[0.03] uppercase text-slate-400">
              <tr>
                <th className="p-2">Source</th>
                <th className="p-2">Target</th>
                <th className="p-2">Anchor</th>
                <th className="p-2">Rel</th>
                <th className="p-2">Bucket</th>
              </tr>
            </thead>
            <tbody>
              {filteredLinkRows.map((row, idx) => (
                <tr key={`${row.source}-${row.target}-${idx}`} className="border-t border-white/5">
                  <td className="p-2 text-slate-300">{row.source}</td>
                  <td className="p-2 text-slate-300">{row.target}</td>
                  <td className="p-2 text-slate-200">{row.anchor}</td>
                  <td className="p-2 text-slate-200">{row.rel}</td>
                  <td className="p-2">
                    <span className={`rounded px-2 py-0.5 font-bold ${row.bucket === 'internal' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'}`}>
                      {row.bucket}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      ) : (
      <section className={`rounded-3xl border p-6 ${BRAND.panel}`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-slate-100">Googlebot</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/80">
              crawlability từ URL đã quét
            </p>
          </div>
          <div className="rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-violet-100">Live data</div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Tổng URL</p>
            <p className="mt-1 truncate text-sm font-black text-violet-100">{googlebotSummary.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-emerald-200">PASS</p>
            <p className="mt-1 truncate text-sm font-black text-emerald-100">{googlebotSummary.pass}</p>
          </div>
          <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber-200">WARN</p>
            <p className="mt-1 truncate text-sm font-black text-amber-100">{googlebotSummary.warn}</p>
          </div>
          <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-rose-200">FAIL</p>
            <p className="mt-1 truncate text-sm font-black text-rose-100">{googlebotSummary.fail}</p>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar-indigo rounded-2xl border border-white/10">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-white/[0.03] uppercase text-slate-400">
              <tr>
                <th className="p-2">URL</th>
                <th className="p-2">HTTP</th>
                <th className="p-2">Meta Robots</th>
                <th className="p-2">Canonical</th>
                <th className="p-2">Verdict</th>
                <th className="p-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {googlebotRows.map((row) => (
                <tr key={row.url} className="border-t border-white/5">
                  <td className="p-2 text-slate-300">{row.url}</td>
                  <td className="p-2 text-slate-200">{row.statusCode || '--'}</td>
                  <td className="p-2 text-slate-200">{row.robots}</td>
                  <td className="p-2 text-slate-200">{row.canonical}</td>
                  <td className="p-2">
                    <span className={`rounded px-2 py-0.5 font-bold ${row.status === 'pass' ? 'bg-emerald-500/20 text-emerald-200' : row.status === 'warn' ? 'bg-amber-500/20 text-amber-200' : 'bg-rose-500/20 text-rose-200'}`}>
                      {row.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2 text-slate-300">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeDashboard === 'structure' ? (
      <section className="rounded-3xl border border-violet-500/20 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">Kết quả kiểm tra ({results.length})</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/80">Thu thập dữ liệu tự động</p>
          </div>
          <button
            onClick={() => {
              setResults([]);
              setDetail(null);
              setStatus('Đã xóa kết quả kiểm tra');
            }}
            disabled={loading || !results.length}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-300/20 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-200 disabled:opacity-40"
          >
            <Trash2 size={12} /> Xóa kết quả
          </button>
        </div>
        {results.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar-indigo">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="p-2">URL</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">H1</th>
                  <th className="p-2">Density</th>
                  <th className="p-2">Issues</th>
                  <th className="p-2">Links</th>
                  <th className="p-2">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.url} className="border-t border-white/5 transition-colors hover:bg-violet-600/[0.03]">
                    <td className="p-2 text-slate-300">{r.url}</td>
                    <td className="p-2 text-slate-200">{r.statusCode || 0}</td>
                    <td className="p-2 text-slate-300">{r.h1 || 'N/A'}</td>
                    <td className="p-2 text-violet-200">{r.keywordDensity || '0.00%'}</td>
                    <td className="p-2">
                      {(() => {
                        const issues = r.issues || [];
                        const errors = issues.filter((i) => i.severity === 'error').length;
                        const warnings = issues.filter((i) => i.severity === 'warning').length;
                        const infos = issues.filter((i) => i.severity === 'info').length;
                        return (
                          <div className="flex items-center gap-1 text-[10px] font-bold">
                            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-200">E:{errors}</span>
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200">W:{warnings}</span>
                            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-sky-200">I:{infos}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-2 text-slate-300">{(r.linkStats?.internal || 0) + (r.linkStats?.external || 0)}</td>
                    <td className="p-2">
                      <button
                        onClick={() => setDetail(r)}
                        className="rounded-lg border border-violet-300/30 bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-100"
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-violet-500/20 bg-violet-500/[0.03] text-center">
            <div className="rounded-[2rem] border border-violet-500/20 bg-violet-500/10 p-5">
              <Stethoscope size={56} className="text-violet-300/50" />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-black uppercase tracking-widest text-slate-100">Sẵn sàng kiểm tra</p>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">
                Nhập URL trang chủ để bắt đầu audit
              </p>
            </div>
          </div>
        )}
      </section>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-[90] bg-black/70 p-6 backdrop-blur-sm">
          <div className="mx-auto h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-violet-400/30 bg-slate-950">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div>
                <p className="text-sm font-bold text-slate-100">{detail.title || detail.url}</p>
                <p className="text-xs text-slate-400">{detail.url}</p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-full p-2 text-slate-300 hover:bg-white/10">
                <X size={18} />
              </button>
            </div>
            <div className="flex gap-2 border-b border-white/10 p-3">
              {[
                { id: 'keywords', label: 'Keywords', icon: Tags },
                { id: 'headings', label: 'Heading Tree', icon: LayoutList },
                { id: 'links', label: 'Links', icon: Link2 },
                { id: 'issues', label: 'Issues', icon: AlertTriangle },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as 'keywords' | 'headings' | 'links' | 'issues')}
                  className={`rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                    tab === t.id ? 'bg-violet-500/20 text-violet-100 border border-violet-300/30' : 'text-slate-400'
                  }`}
                >
                  <span className="inline-flex items-center gap-2"><t.icon size={13} /> {t.label}</span>
                </button>
              ))}
            </div>
            <div className="h-[calc(90vh-130px)] overflow-auto custom-scrollbar-indigo p-4">
              {tab === 'keywords' ? (
                <div className="space-y-2">
                  {(detail.topKeywords || []).map((k) => (
                    <div key={`${k.word}-${k.count}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <span className="text-slate-200">{k.word}</span>
                      <span className="text-slate-300">{k.count} · {k.density}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {tab === 'headings' ? (
                <div className="space-y-2">
                  {detail.headingTree?.length
                    ? renderTree(detail.headingTree)
                    : (detail.headings || []).map((h, idx) => (
                        <div key={`${h.tag}-${h.text}-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-slate-200">
                          <span className="mr-2 rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-200">{h.tag}</span>
                          {h.text}
                        </div>
                      ))}
                </div>
              ) : null}

              {tab === 'links' ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-violet-200">Anchor Links</p>
                    <p className="text-xs text-slate-300">Internal: {detail.linkStats?.anchor?.internal || 0}</p>
                    <p className="text-xs text-slate-300">External: {detail.linkStats?.anchor?.external || 0}</p>
                    <p className="text-xs text-slate-300">Nofollow: {detail.linkStats?.anchor?.nofollow || 0}</p>
                    <p className="text-xs text-slate-300">Dofollow: {detail.linkStats?.anchor?.dofollow || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-violet-200">Resource Links</p>
                    <p className="text-xs text-slate-300">Internal: {detail.linkStats?.resource?.internal || 0}</p>
                    <p className="text-xs text-slate-300">External: {detail.linkStats?.resource?.external || 0}</p>
                    <p className="text-xs text-slate-300">Nofollow: {detail.linkStats?.resource?.nofollow || 0}</p>
                    <p className="text-xs text-slate-300">Dofollow: {detail.linkStats?.resource?.dofollow || 0}</p>
                  </div>
                </div>
              ) : null}

              {tab === 'issues' ? (
                <div className="space-y-2">
                  {(detail.issues || []).length ? (
                    (detail.issues || []).map((issue) => {
                      const tone =
                        issue.severity === 'error'
                          ? 'border-rose-400/30 bg-rose-500/[0.08] text-rose-100'
                          : issue.severity === 'warning'
                            ? 'border-amber-300/30 bg-amber-500/[0.08] text-amber-100'
                            : 'border-sky-300/30 bg-sky-500/[0.08] text-sky-100';
                      return (
                        <div key={issue.id} className={`rounded-xl border p-3 ${tone}`}>
                          <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                            <span>{issue.severity}</span>
                            <span className="opacity-60">•</span>
                            <span>{issue.category}</span>
                          </div>
                          <p className="text-sm">{issue.message}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] p-3 text-emerald-100">
                      Không phát hiện issue nghiêm trọng trên URL này.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {imageDetailGroup ? (
        <div className="fixed inset-0 z-[95] bg-black/70 p-6 backdrop-blur-sm">
          <div className="mx-auto h-[85vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-violet-400/30 bg-slate-950">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div>
                <p className="text-sm font-bold text-slate-100">Chi tiết hình ảnh theo URL</p>
                <p className="text-xs text-slate-400">{imageDetailGroup.pageUrl}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/80">{imageDetailGroup.images.length} ảnh</p>
              </div>
              <button onClick={() => setImageDetailGroup(null)} className="rounded-full p-2 text-slate-300 hover:bg-white/10">
                <X size={18} />
              </button>
            </div>
            <div className="h-[calc(85vh-72px)] overflow-auto custom-scrollbar-indigo p-4">
              <div className="overflow-x-auto custom-scrollbar-indigo rounded-2xl border border-white/10">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-white/[0.03] uppercase text-slate-400">
                    <tr>
                      <th className="p-2">Ảnh nhỏ</th>
                      <th className="p-2">Image URL</th>
                      <th className="p-2">Alt</th>
                      <th className="p-2">Title</th>
                      <th className="p-2">Size (KB)</th>
                      <th className="p-2">Width</th>
                      <th className="p-2">Height</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imageDetailGroup.images.map((img, idx) => (
                      <tr key={`${img.src}-${idx}`} className="border-t border-white/5">
                        <td className="p-2">
                          <a href={img.src} target="_blank" rel="noreferrer" className="block w-fit">
                            <img src={img.src} alt={img.alt || 'image'} loading="lazy" className="h-12 w-20 rounded border border-white/10 object-cover" />
                          </a>
                        </td>
                        <td className="p-2 text-slate-300">{img.src}</td>
                        <td className="p-2 text-slate-200">{img.alt || <span className="text-rose-300">Missing</span>}</td>
                        <td className="p-2 text-slate-200">{img.title || <span className="text-amber-300">Missing</span>}</td>
                        <td className="p-2 text-slate-300">{img.sizeKb ?? '--'}</td>
                        <td className="p-2 text-slate-300">{img.width ? `${img.width}px` : '--'}</td>
                        <td className="p-2 text-slate-300">{img.height ? `${img.height}px` : '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

