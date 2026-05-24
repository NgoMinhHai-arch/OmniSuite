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
  Eye,
  Gauge,
  ShieldAlert,
  FileSearch,
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
  follow: 'nofollow' | 'dofollow' | 'unknown';
  linkType?: 'anchor' | 'resource';
};

type ScrapeResult = {
  url: string;
  statusCode?: number;
  title?: string;
  description?: string;
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
  linkRows?: Array<{
    source: string;
    target: string;
    anchor: string;
    rel: string;
    bucket: 'internal' | 'external';
    follow: 'nofollow' | 'dofollow' | 'unknown';
    linkType: 'anchor' | 'resource';
  }>;
  indexability?: {
    xRobotsTag?: string;
    noindexInMeta?: boolean;
    noindexInHeader?: boolean;
    metaRobots?: string;
    canonicalSelf?: boolean;
    jsRenderedDiff?: {
      titleChanged: boolean;
      h1Changed: boolean;
      canonicalChanged: boolean;
      noindexChanged: boolean;
    };
  };
  og?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    siteName?: string;
  };
  twitter?: {
    card?: string;
    title?: string;
    description?: string;
  };
  issues?: SeoIssue[];
};

type RobotsSitemapData = {
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

type CwvRecord = {
  url: string;
  ok: boolean;
  error?: string;
  LCP: number | null;
  CLS: number | null;
  FCP: number | null;
  TTFB: number | null;
  scoreLCP: 'good' | 'needs-improvement' | 'poor' | null;
  scoreCLS: 'good' | 'needs-improvement' | 'poor' | null;
  scoreFCP: 'good' | 'needs-improvement' | 'poor' | null;
  scoreTTFB: 'good' | 'needs-improvement' | 'poor' | null;
  overall: 'good' | 'needs-improvement' | 'poor' | 'unknown';
};

type FullAuditRuleResult = {
  ruleId: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  message: string;
  score?: number;
};

type FullAuditCategory = {
  categoryId: string;
  score: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  results: FullAuditRuleResult[];
};

type FullAuditResult = {
  url: string;
  overallScore: number;
  categoryResults: FullAuditCategory[];
};

const BRAND = {
  accent: 'text-[color:var(--tool-violet-heading)]',
  panel: 'border-[color:var(--tool-panel-border)] bg-[color:var(--tool-panel-bg)]',
  panelStrong: 'border-[color:var(--tool-panel-border)] bg-[color:var(--tool-panel-bg-strong)]',
};

const TOOL_TEXTAREA_CLASS =
  'h-32 w-full rounded-2xl border p-4 text-sm outline-none focus:border-violet-400/40 disabled:cursor-not-allowed disabled:opacity-60 bg-[color:var(--tool-input-bg)] border-[color:var(--tool-input-border)] text-[color:var(--tool-input-text)] placeholder:text-[color:var(--tool-placeholder)]';

const TOOL_INPUT_SM_CLASS =
  'w-full rounded-xl border py-2 pl-9 pr-3 text-xs outline-none focus:border-violet-400/40 bg-[color:var(--tool-input-bg)] border-[color:var(--tool-input-border)] text-[color:var(--tool-input-text)] placeholder:text-[color:var(--tool-placeholder)]';

const TOOL_SURFACE_CARD =
  'rounded-xl border bg-[color:var(--tool-input-bg)] border-[color:var(--tool-input-border)]';

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
  const [linkFilter, setLinkFilter] = useState<'all' | 'internal' | 'external' | 'nofollow' | 'dofollow'>('all');
  const [imageDetailGroup, setImageDetailGroup] = useState<ImageAuditGroup | null>(null);
  const [robotsSitemapByDomain, setRobotsSitemapByDomain] = useState<Record<string, RobotsSitemapData>>({});
  const [robotsLoadingDomains, setRobotsLoadingDomains] = useState<Record<string, boolean>>({});
  const [robotsRawModal, setRobotsRawModal] = useState<RobotsSitemapData | null>(null);
  const [cwvByUrl, setCwvByUrl] = useState<Record<string, CwvRecord>>({});
  const [cwvRunning, setCwvRunning] = useState(false);
  const [cwvProgress, setCwvProgress] = useState({ done: 0, total: 0 });
  const [cwvAutoOn, setCwvAutoOn] = useState(false);
  const [fullAuditRunning, setFullAuditRunning] = useState(false);
  const [fullAuditIncludeCwv, setFullAuditIncludeCwv] = useState(false);
  const [fullAuditResult, setFullAuditResult] = useState<FullAuditResult | null>(null);
  const [fullAuditError, setFullAuditError] = useState('');
  const [fullAuditExporting, setFullAuditExporting] = useState(false);
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
      results.flatMap((row): LinkAuditRow[] => {
        if (Array.isArray(row.linkRows) && row.linkRows.length > 0) {
          return row.linkRows
            .filter((r) => r.linkType === 'anchor')
            .map((r) => ({
              source: r.source,
              target: r.target,
              anchor: r.anchor || '-',
              rel: r.rel || '',
              bucket: r.bucket,
              follow: r.follow,
              linkType: r.linkType,
            }));
        }
        const internal: LinkAuditRow[] = (row.collectedLinks?.internal || []).map((target) => ({
          source: row.url,
          target,
          anchor: '-',
          rel: '',
          bucket: 'internal' as const,
          follow: 'unknown' as const,
          linkType: 'anchor' as const,
        }));
        const external: LinkAuditRow[] = (row.collectedLinks?.external || []).map((target) => ({
          source: row.url,
          target,
          anchor: '-',
          rel: '',
          bucket: 'external' as const,
          follow: 'unknown' as const,
          linkType: 'anchor' as const,
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
        (linkFilter === 'nofollow' && row.follow === 'nofollow') ||
        (linkFilter === 'dofollow' && row.follow === 'dofollow');
      const query = linkQuery.trim().toLowerCase();
      const byQuery =
        !query ||
        row.source.toLowerCase().includes(query) ||
        row.target.toLowerCase().includes(query) ||
        row.anchor.toLowerCase().includes(query);
      return byFilter && byQuery;
    });
  }, [linkFilter, linkQuery, linkRows]);
  const getOriginFromUrl = (raw: string): string | null => {
    try {
      const u = new URL(raw);
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  };

  const getRobotsPathVerdict = (
    robotsRaw: string,
    targetUrl: string,
  ): { blocked: boolean; matchedRule: string | null } => {
    if (!robotsRaw.trim()) return { blocked: false, matchedRule: null };
    let pathname = '/';
    try {
      pathname = new URL(targetUrl).pathname || '/';
    } catch {
      // keep default
    }
    const lines = robotsRaw.split(/\r?\n/);
    const blocks: Array<{ userAgents: string[]; allow: string[]; disallow: string[] }> = [];
    let current: { userAgents: string[]; allow: string[]; disallow: string[] } | null = null;

    for (const rawLine of lines) {
      const line = rawLine.replace(/#.*$/, '').trim();
      if (!line) continue;
      const idx = line.indexOf(':');
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (key === 'user-agent') {
        const ua = value.toLowerCase();
        if (!current || current.allow.length > 0 || current.disallow.length > 0) {
          current = { userAgents: [ua], allow: [], disallow: [] };
          blocks.push(current);
        } else {
          current.userAgents.push(ua);
        }
        continue;
      }
      if (!current) continue;
      if (key === 'allow') current.allow.push(value);
      if (key === 'disallow') current.disallow.push(value);
    }

    const selected =
      blocks.find((b) => b.userAgents.includes('googlebot')) ||
      blocks.find((b) => b.userAgents.includes('*')) ||
      null;
    if (!selected) return { blocked: false, matchedRule: null };

    const matches = (rule: string) => {
      if (!rule) return false;
      if (rule === '/') return true;
      const clean = rule.replace(/\*$/g, '');
      return pathname.startsWith(clean);
    };

    const matchedAllow = selected.allow
      .filter(matches)
      .sort((a, b) => b.length - a.length)[0];
    const matchedDisallow = selected.disallow
      .filter(matches)
      .sort((a, b) => b.length - a.length)[0];

    if (matchedDisallow && (!matchedAllow || matchedDisallow.length > matchedAllow.length)) {
      return { blocked: true, matchedRule: matchedDisallow };
    }
    if (matchedAllow) return { blocked: false, matchedRule: matchedAllow };
    return { blocked: false, matchedRule: null };
  };

  const computeIndexability = (input: {
    statusCode: number;
    noindexInMeta: boolean;
    noindexInHeader: boolean;
    canonical: string;
    canonicalSelf: boolean;
    inSitemap: boolean | null;
    robotsPathVerdict: { blocked: boolean; matchedRule: string | null };
    jsStable: boolean | null;
  }): { verdict: 'CAN_INDEX' | 'WARN' | 'BLOCKED'; reasons: string[] } => {
    const {
      statusCode,
      noindexInMeta,
      noindexInHeader,
      canonical,
      canonicalSelf,
      inSitemap,
      robotsPathVerdict,
      jsStable,
    } = input;

    const reasons: string[] = [];
    let verdict: 'CAN_INDEX' | 'WARN' | 'BLOCKED' = 'CAN_INDEX';

    if (statusCode >= 500) {
      verdict = 'BLOCKED';
      reasons.push(`HTTP ${statusCode}`);
      return { verdict, reasons };
    }
    if (statusCode === 404 || statusCode === 410) {
      verdict = 'BLOCKED';
      reasons.push(`HTTP ${statusCode}`);
      return { verdict, reasons };
    }
    if (noindexInMeta || noindexInHeader) {
      verdict = 'BLOCKED';
      if (noindexInMeta) reasons.push('meta robots noindex');
      if (noindexInHeader) reasons.push('X-Robots-Tag noindex');
      return { verdict, reasons };
    }
    if (robotsPathVerdict.blocked) {
      verdict = 'BLOCKED';
      reasons.push(
        robotsPathVerdict.matchedRule
          ? `robots.txt disallow (${robotsPathVerdict.matchedRule})`
          : 'robots.txt disallow',
      );
      return { verdict, reasons };
    }

    if (canonical && !canonicalSelf) {
      verdict = 'WARN';
      reasons.push('canonical points elsewhere');
    }
    if (inSitemap === false) {
      if (verdict === 'CAN_INDEX') verdict = 'WARN';
      reasons.push('not in sitemap');
    }
    if (jsStable === false) {
      if (verdict === 'CAN_INDEX') verdict = 'WARN';
      reasons.push('JS rendered drift');
    }
    if (statusCode >= 300 && statusCode < 400) {
      if (verdict === 'CAN_INDEX') verdict = 'WARN';
      reasons.push(`HTTP ${statusCode} redirect`);
    }
    return { verdict, reasons };
  };

  const indexabilityRows = useMemo(() => {
    return results.map((row) => {
      const statusCode = row.statusCode || 0;
      const indexability = row.indexability || {};
      const metaRobots = (indexability.metaRobots ?? row.robots ?? '').trim() || '-';
      const xRobots = (indexability.xRobotsTag ?? '').trim();
      const canonical = (row.canonical || '').trim();
      const origin = getOriginFromUrl(row.url);
      const robotsData = origin ? robotsSitemapByDomain[origin] : undefined;
      const sitemapUrls = robotsData?.sitemap?.urls || [];
      const inSitemap = sitemapUrls.length > 0 ? sitemapUrls.includes(row.url) : null;
      const robotsPathVerdict = robotsData
        ? getRobotsPathVerdict(robotsData.robots.raw || '', row.url)
        : { blocked: false, matchedRule: null as string | null };
      const aiBots = robotsData?.robots?.blocksAiBots || [];
      const aiBlocked = aiBots.filter((b) => b.blocked).map((b) => b.name);
      const noindexInMeta = !!indexability.noindexInMeta;
      const noindexInHeader = !!indexability.noindexInHeader;
      const canonicalSelf = !!indexability.canonicalSelf;
      const jsDiff = indexability.jsRenderedDiff;
      const jsStable = jsDiff
        ? !(jsDiff.titleChanged || jsDiff.h1Changed || jsDiff.canonicalChanged || jsDiff.noindexChanged)
        : null;

      const { verdict, reasons } = computeIndexability({
        statusCode,
        noindexInMeta,
        noindexInHeader,
        canonical,
        canonicalSelf,
        inSitemap,
        robotsPathVerdict,
        jsStable,
      });

      return {
        url: row.url,
        statusCode,
        metaRobots,
        xRobots,
        canonical: canonical || '-',
        canonicalSelf,
        inSitemap,
        robotsPathVerdict,
        aiBlocked,
        jsStable,
        jsDiff,
        verdict,
        reasons,
      };
    });
  }, [results, robotsSitemapByDomain]);

  const indexabilitySummary = useMemo(
    () => ({
      total: indexabilityRows.length,
      canIndex: indexabilityRows.filter((r) => r.verdict === 'CAN_INDEX').length,
      warn: indexabilityRows.filter((r) => r.verdict === 'WARN').length,
      blocked: indexabilityRows.filter((r) => r.verdict === 'BLOCKED').length,
    }),
    [indexabilityRows],
  );

  const uniqueDomains = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => {
      const origin = getOriginFromUrl(r.url);
      if (origin) set.add(origin);
    });
    return Array.from(set);
  }, [results]);

  const metaTagRows = useMemo(() => {
    const SOCIAL_HOSTS: Array<{ host: string; label: string }> = [
      { host: 'facebook.com', label: 'facebook' },
      { host: 'fb.com', label: 'facebook' },
      { host: 'm.facebook.com', label: 'facebook' },
      { host: 'zalo.me', label: 'zalo' },
      { host: 'zaloapp.com', label: 'zalo' },
      { host: 'tiktok.com', label: 'tiktok' },
      { host: 'instagram.com', label: 'instagram' },
      { host: 'youtube.com', label: 'youtube' },
      { host: 'youtu.be', label: 'youtube' },
      { host: 'linkedin.com', label: 'linkedin' },
      { host: 'twitter.com', label: 'twitter' },
      { host: 'x.com', label: 'x' },
      { host: 'pinterest.com', label: 'pinterest' },
      { host: 'threads.net', label: 'threads' },
      { host: 'telegram.me', label: 'telegram' },
      { host: 't.me', label: 'telegram' },
    ];

    return results.map((row) => {
      let siteName = (row.og?.siteName || '').trim();
      if (!siteName) {
        try {
          const hostname = new URL(row.url).hostname.replace(/^www\./i, '');
          const parts = hostname.split('.');
          siteName = parts[0] || hostname || '-';
        } catch {
          siteName = '-';
        }
      }

      const socialLinkMap = new Map<string, string>();
      (row.linkRows || []).forEach((lr) => {
        if (!lr?.target) return;
        try {
          const host = new URL(lr.target).hostname.toLowerCase();
          const matched = SOCIAL_HOSTS.find((s) => host === s.host || host.endsWith(`.${s.host}`));
          if (matched && !socialLinkMap.has(matched.label)) {
            socialLinkMap.set(matched.label, lr.target);
          }
        } catch {
          // ignore non-http links
        }
      });

      return {
        sourceUrl: row.url,
        title: row.og?.title || row.title || '-',
        description: row.og?.description || row.description || '-',
        image: row.og?.image || '-',
        url: row.og?.url || row.canonical || row.url || '-',
        type: row.og?.type || '-',
        siteName,
        cardLinks: Array.from(socialLinkMap.entries()).map(([platform, link]) => ({
          platform,
          link,
        })),
      };
    });
  }, [results]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('googlebot_eye_cwv_auto');
      if (stored === '1') setCwvAutoOn(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('googlebot_eye_cwv_auto', cwvAutoOn ? '1' : '0');
    } catch {}
  }, [cwvAutoOn]);

  useEffect(() => {
    if (activeDashboard !== 'googlebot') return;
    const pending = uniqueDomains.filter((d) => !robotsSitemapByDomain[d] && !robotsLoadingDomains[d]);
    if (!pending.length) return;
    pending.forEach(async (domain) => {
      setRobotsLoadingDomains((prev) => ({ ...prev, [domain]: true }));
      try {
        const res = await fetch('/api/seo/robots-sitemap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain }),
        });
        if (res.ok) {
          const data = (await res.json()) as RobotsSitemapData;
          setRobotsSitemapByDomain((prev) => ({ ...prev, [domain]: data }));
        }
      } catch {
        // ignore
      } finally {
        setRobotsLoadingDomains((prev) => {
          const next = { ...prev };
          delete next[domain];
          return next;
        });
      }
    });
  }, [activeDashboard, uniqueDomains, robotsSitemapByDomain, robotsLoadingDomains]);

  const runCwvForUrls = async (urls: string[]) => {
    if (!urls.length || cwvRunning) return;
    setCwvRunning(true);
    setCwvProgress({ done: 0, total: urls.length });
    const concurrency = 2;
    let cursor = 0;
    let done = 0;
    const next = async (): Promise<void> => {
      const idx = cursor;
      cursor += 1;
      if (idx >= urls.length) return;
      const url = urls[idx];
      try {
        const res = await fetch('/api/seo/cwv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (res.ok) {
          const data = (await res.json()) as CwvRecord;
          setCwvByUrl((prev) => ({ ...prev, [url]: data }));
        }
      } catch {
        // ignore
      } finally {
        done += 1;
        setCwvProgress({ done, total: urls.length });
        await next();
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => next()));
    setCwvRunning(false);
  };

  const runFullAudit = async (targetUrl: string) => {
    if (!targetUrl || fullAuditRunning) return;
    setFullAuditRunning(true);
    setFullAuditError('');
    try {
      const res = await fetch('/api/seo/full-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          includeCwv: fullAuditIncludeCwv,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Full audit failed');
      setFullAuditResult((data?.data || data) as FullAuditResult);
    } catch (err: any) {
      setFullAuditError(err?.message || 'Full audit failed');
    } finally {
      setFullAuditRunning(false);
    }
  };

  const exportFullAudit = async (format: 'json' | 'html' | 'markdown' | 'llm') => {
    const targetUrl = results[0]?.url || '';
    if (!targetUrl || fullAuditExporting) return;
    setFullAuditExporting(true);
    setFullAuditError('');
    try {
      const res = await fetch('/api/seo/full-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          includeCwv: fullAuditIncludeCwv,
          format,
          exportFile: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Export ${format} failed`);
      const content = String(data?.content || '');
      const fileName =
        data?.fileName ||
        `full-audit.${format === 'markdown' ? 'md' : format === 'llm' ? 'txt' : format}`;
      const mime =
        format === 'html'
          ? 'text/html'
          : format === 'json'
            ? 'application/json'
            : 'text/plain';
      const blob = new Blob([content], { type: mime });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err: any) {
      setFullAuditError(err?.message || `Export ${format} failed`);
    } finally {
      setFullAuditExporting(false);
    }
  };

  useEffect(() => {
    if (!cwvAutoOn) return;
    if (activeDashboard !== 'googlebot') return;
    if (!results.length) return;
    const todo = results.map((r) => r.url).filter((u) => !cwvByUrl[u]);
    if (!todo.length) return;
    runCwvForUrls(todo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwvAutoOn, activeDashboard, results]);

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
      <div key={`${node.tag}-${node.text}-${idx}`} style={{ marginLeft: depth * 16 }} className={`${TOOL_SURFACE_CARD} p-3`}>
        <div className="flex items-center gap-2">
          <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-[color:var(--tool-violet-body)]">{node.tag}</span>
          <span className="text-sm text-[color:var(--body-text)]">{node.text}</span>
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
              <Stethoscope className={BRAND.accent} size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none" style={{ color: 'var(--text-primary)' }}>
              KIỂM TRA SỨC KHỎE WEBSITE
            </h1>
          </div>
          <div className="flex items-center gap-4 px-2">
            <div className="h-px w-12 bg-[color:var(--tool-surface-border)]" />
            <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--tool-violet-muted)]">
              CHẨN ĐOÁN CẤU TRÚC - NỘI DUNG - LIÊN KẾT SEO
            </p>
          </div>
          <p className="px-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">{status}</p>
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
                  ? 'border-[color:var(--tool-panel-border)] bg-[color:var(--tool-panel-bg-strong)] text-[color:var(--tool-violet-body)]'
                  : 'border-transparent bg-transparent text-[color:var(--tool-chip-inactive-text)] hover:border-[color:var(--tool-panel-border)] hover:bg-[color:var(--tool-chip-inactive-bg)]'
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
            <div className="flex items-center gap-2 text-[color:var(--text-primary)]">
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
            className={TOOL_TEXTAREA_CLASS}
          />
          {seedInputError ? (
            <p className="mt-2 text-xs font-semibold text-rose-300">{seedInputError}</p>
          ) : null}
          <button
            onClick={runDiscovery}
            disabled={loading || !seedInput.trim() || Boolean(seedInputError)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-violet-300/30 bg-violet-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[color:var(--tool-violet-body)] disabled:opacity-40"
          >
            <Globe size={14} />
            Khám phá URL
          </button>
        </div>

        <div className={`rounded-3xl border p-6 lg:col-span-7 ${BRAND.panel}`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-10 w-1 rounded-full bg-fuchsia-400/80 shadow-[0_0_10px_rgba(217,70,239,0.45)]" />
            <div className="flex items-center gap-2 text-[color:var(--text-primary)]">
              <FlaskConical size={18} className="text-fuchsia-300" />
              <h2 className="text-base font-black uppercase tracking-wider">Danh sách URL quét</h2>
            </div>
          </div>
          <textarea
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={loading}
            placeholder="Mỗi dòng một URL (có thể nhập/xóa thủ công)"
            className={TOOL_TEXTAREA_CLASS}
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={runScrape}
              disabled={loading || !urlInput.trim()}
              className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-300/30 bg-fuchsia-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-40 text-[color:var(--tool-on-fuchsia-tint)]"
            >
              <Stethoscope size={14} />
              Bắt đầu audit
            </button>
            <button
              onClick={exportCsv}
              disabled={loading || !results.length}
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--tool-surface-border)] bg-[color:var(--tool-surface-subtle)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[color:var(--text-primary)] disabled:opacity-40"
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
            <h2 className="text-base font-black uppercase tracking-wider text-[color:var(--text-primary)]">Hình ảnh</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--tool-violet-muted)]">
              image audit từ danh sách URL đã quét
            </p>
          </div>
          <div className="rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[color:var(--tool-violet-body)]">Live data</div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">Tổng ảnh</p>
            <p className="mt-1 text-xl font-black text-[color:var(--tool-violet-body)]">{imageGroups.reduce((sum, x) => sum + x.total, 0)}</p>
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
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              value={imageQuery}
              onChange={(e) => setImageQuery(e.target.value)}
              placeholder="Tìm theo URL trang..."
              className={TOOL_INPUT_SM_CLASS}
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
                  ? 'border-violet-300/40 bg-violet-500/20 text-[color:var(--tool-violet-body)]'
                  : 'border-[color:var(--tool-surface-border)] bg-[color:var(--tool-surface-subtle)] text-[color:var(--text-secondary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto custom-scrollbar-indigo rounded-2xl border border-[color:var(--tool-surface-border)]">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-[color:var(--tool-surface-subtle)] uppercase text-[color:var(--text-muted)]">
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
                <tr key={group.groupId} className="border-t border-[color:var(--border-color)]">
                  <td className="p-2 text-[color:var(--text-secondary)]">{group.pageUrl}</td>
                  <td className="p-2 text-[color:var(--body-text)]">{group.total}</td>
                  <td className="p-2 text-[color:var(--body-text)]">{group.missingAlt}</td>
                  <td className="p-2 text-[color:var(--body-text)]">{group.missingTitle}</td>
                  <td className="p-2">
                    <button
                      onClick={() => setImageDetailGroup(group)}
                      disabled={!group.total}
                      className="rounded-lg border border-violet-300/30 bg-violet-500/20 px-3 py-1 text-xs font-bold text-[color:var(--tool-violet-body)] disabled:opacity-40"
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
            <h2 className="text-base font-black uppercase tracking-wider text-[color:var(--text-primary)]">Link</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--tool-violet-muted)]">
              link explorer từ URL đã quét
            </p>
          </div>
          <div className="rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[color:var(--tool-violet-body)]">Live data</div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-xl border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">Tổng links</p>
            <p className="mt-1 text-xl font-black text-[color:var(--tool-violet-body)]">{linkRows.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-emerald-200">Internal</p>
            <p className="mt-1 text-xl font-black text-emerald-100">{linkRows.filter((x) => x.bucket === 'internal').length}</p>
          </div>
          <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber-200">External</p>
            <p className="mt-1 text-xl font-black text-amber-100">{linkRows.filter((x) => x.bucket === 'external').length}</p>
          </div>
          <div className="rounded-xl border border-sky-300/20 bg-sky-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-sky-200">Dofollow</p>
            <p className="mt-1 text-xl font-black text-sky-100">
              {linkRows.filter((x) => x.follow === 'dofollow').length}
            </p>
          </div>
          <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-rose-200">Nofollow</p>
            <p className="mt-1 text-xl font-black text-rose-100">
              {linkRows.filter((x) => x.follow === 'nofollow').length}
            </p>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              value={linkQuery}
              onChange={(e) => setLinkQuery(e.target.value)}
              placeholder="Tìm source/target/anchor..."
              className={TOOL_INPUT_SM_CLASS}
            />
          </div>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'internal', label: 'Internal' },
            { id: 'external', label: 'External' },
            { id: 'dofollow', label: 'Dofollow' },
            { id: 'nofollow', label: 'Nofollow' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setLinkFilter(item.id as 'all' | 'internal' | 'external' | 'nofollow' | 'dofollow')}
              className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                linkFilter === item.id
                  ? 'border-violet-300/40 bg-violet-500/20 text-[color:var(--tool-violet-body)]'
                  : 'border-[color:var(--tool-surface-border)] bg-[color:var(--tool-surface-subtle)] text-[color:var(--text-secondary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto custom-scrollbar-indigo rounded-2xl border border-[color:var(--tool-surface-border)]">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-[color:var(--tool-surface-subtle)] uppercase text-[color:var(--text-muted)]">
              <tr>
                <th className="p-2">Source</th>
                <th className="p-2">Target</th>
                <th className="p-2">Anchor</th>
                <th className="p-2">Rel</th>
                <th className="p-2">Follow</th>
                <th className="p-2">Bucket</th>
              </tr>
            </thead>
            <tbody>
              {filteredLinkRows.map((row, idx) => {
                const followClass =
                  row.follow === 'dofollow'
                    ? 'bg-sky-500/20 text-sky-200'
                    : row.follow === 'nofollow'
                      ? 'bg-rose-500/20 text-rose-200'
                      : 'bg-[color:var(--tool-chip-inactive-bg)] text-[color:var(--text-secondary)]';
                return (
                  <tr key={`${row.source}-${row.target}-${idx}`} className="border-t border-[color:var(--border-color)]">
                    <td className="p-2 text-[color:var(--text-secondary)]">{row.source}</td>
                    <td className="p-2 text-[color:var(--text-secondary)]">{row.target}</td>
                    <td className="p-2 text-[color:var(--body-text)]">{row.anchor || '-'}</td>
                    <td className="p-2 text-[color:var(--body-text)]">{row.rel || '-'}</td>
                    <td className="p-2">
                      <span className={`rounded px-2 py-0.5 font-bold ${followClass}`}>
                        {row.follow}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className={`rounded px-2 py-0.5 font-bold ${row.bucket === 'internal' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'}`}>
                        {row.bucket}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredLinkRows.length === 0 && (
                <tr className="border-t border-[color:var(--border-color)]">
                  <td colSpan={6} className="p-4 text-center text-[color:var(--text-muted)]">
                    Không có link nào khớp bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      ) : (
      <div className="space-y-6">
        <section className={`rounded-3xl border p-6 ${BRAND.panel}`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-[color:var(--text-primary)] flex items-center gap-2">
                <Eye size={16} className="text-[color:var(--tool-violet-heading)]" />
                Googlebot's Eye
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--tool-violet-muted)]">
                Indexability + Robots/Sitemap + AI Bot Access + CWV
              </p>
            </div>
            <div className="rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[color:var(--tool-violet-body)]">Live data</div>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">Tổng URL</p>
              <p className="mt-1 truncate text-sm font-black text-[color:var(--tool-violet-body)]">{indexabilitySummary.total}</p>
            </div>
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">
              <p className="text-[10px] uppercase tracking-wider text-emerald-200">CAN INDEX</p>
              <p className="mt-1 truncate text-sm font-black text-emerald-100">{indexabilitySummary.canIndex}</p>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3">
              <p className="text-[10px] uppercase tracking-wider text-amber-200">WARN</p>
              <p className="mt-1 truncate text-sm font-black text-amber-100">{indexabilitySummary.warn}</p>
            </div>
            <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-3">
              <p className="text-[10px] uppercase tracking-wider text-rose-200">BLOCKED</p>
              <p className="mt-1 truncate text-sm font-black text-rose-100">{indexabilitySummary.blocked}</p>
            </div>
          </div>
        </section>

        {(uniqueDomains.length > 0 || metaTagRows.length > 0) && (
          <div className="grid gap-4 lg:grid-cols-2">
            {uniqueDomains.length > 0 && (
              <section className={`rounded-3xl border p-6 ${BRAND.panel}`}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--text-primary)] flex items-center gap-2">
                      <ShieldAlert size={14} className="text-[color:var(--tool-violet-heading)]" />
                      Robots.txt &amp; Sitemap
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--tool-violet-muted)]">
                      Phân tích theo domain ({uniqueDomains.length})
                    </p>
                  </div>
                </div>
                <div className="grid gap-4">
                  {uniqueDomains.map((domain) => {
                    const data = robotsSitemapByDomain[domain];
                    const loading = !!robotsLoadingDomains[domain];
                    if (!data) {
                      return (
                        <div key={domain} className="rounded-2xl border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] p-4">
                          <p className="truncate text-xs font-bold text-[color:var(--body-text)]">{domain}</p>
                          <p className="mt-2 text-[11px] text-[color:var(--text-muted)]">
                            {loading ? 'Đang phân tích robots.txt + sitemap…' : 'Chưa có dữ liệu'}
                          </p>
                        </div>
                      );
                    }
                    const robotsOk = data.robots.exists && data.robots.statusCode === 200;
                    const blockedAi = data.robots.blocksAiBots.filter((b) => b.blocked);
                    return (
                      <div key={domain} className="space-y-3 rounded-2xl border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-xs font-bold text-[color:var(--body-text)]" title={domain}>
                            {domain}
                          </p>
                          <button
                            onClick={() => setRobotsRawModal(data)}
                            className="inline-flex items-center gap-1 rounded-lg border border-violet-300/20 bg-violet-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--tool-violet-body)]"
                          >
                            <FileSearch size={11} /> Xem chi tiết
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] p-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--text-muted)]">robots.txt</p>
                            <p className="mt-1 text-xs font-black text-[color:var(--text-primary)]">
                              {robotsOk ? `HTTP ${data.robots.statusCode}` : data.robots.statusCode ? `HTTP ${data.robots.statusCode}` : 'Không có'}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold">
                              <span className={`rounded px-1.5 py-0.5 ${data.robots.blocksGooglebot ? 'bg-rose-500/20 text-rose-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                                {data.robots.blocksGooglebot ? 'BLOCK Googlebot' : 'Allow Googlebot'}
                              </span>
                              {data.robots.crawlDelay !== null && (
                                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200">
                                  crawl-delay: {data.robots.crawlDelay}s
                                </span>
                              )}
                              {data.robots.sitemapRefs.length > 0 && (
                                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-sky-200">
                                  sitemap ref: {data.robots.sitemapRefs.length}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold">
                              {blockedAi.length > 0 ? (
                                blockedAi.map((b) => (
                                  <span key={b.name} className="rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-200">
                                    BLOCK {b.name}
                                  </span>
                                ))
                              ) : (
                                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-200">
                                  Allow AI bots
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="rounded-xl border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] p-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--text-muted)]">sitemap</p>
                            <p className="mt-1 text-xs font-black text-[color:var(--text-primary)]">
                              {data.sitemap.found ? `${data.sitemap.urlCount} URL` : 'Không tìm thấy'}
                            </p>
                            {data.sitemap.url && (
                              <p className="mt-1 truncate text-[10px] text-[color:var(--text-muted)]" title={data.sitemap.url}>
                                {data.sitemap.url}
                              </p>
                            )}
                            {data.sitemap.domainMismatchCount > 0 && (
                              <p className="mt-1 text-[10px] font-bold text-amber-200">
                                ⚠ Domain mismatch: {data.sitemap.domainMismatchCount}
                              </p>
                            )}
                            {data.sitemap.sampleUrls.length > 0 && (
                              <ul className="mt-2 space-y-0.5 text-[10px] text-[color:var(--text-muted)]">
                                {data.sitemap.sampleUrls.slice(0, 5).map((u) => (
                                  <li key={u} className="truncate" title={u}>
                                    · {u}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            <section className={`rounded-3xl border p-6 ${BRAND.panel}`}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--text-primary)]">
                    Meta Tags
                  </h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--tool-violet-muted)]">
                    title · description · image · url · type · site_name · card
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto custom-scrollbar-indigo rounded-2xl border border-[color:var(--tool-surface-border)]">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-[color:var(--tool-surface-subtle)] uppercase text-[color:var(--text-muted)]">
                    <tr>
                      <th className="p-2">URL</th>
                      <th className="p-2">title</th>
                      <th className="p-2">description</th>
                      <th className="p-2">image</th>
                      <th className="p-2">url</th>
                      <th className="p-2">type</th>
                      <th className="p-2">site_name</th>
                      <th className="p-2">card</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metaTagRows.map((row) => (
                      <tr key={row.sourceUrl} className="border-t border-[color:var(--border-color)]">
                        <td className="p-2 text-[color:var(--text-secondary)] max-w-[180px] truncate" title={row.sourceUrl}>{row.sourceUrl}</td>
                        <td className="p-2 text-[color:var(--body-text)] max-w-[160px] truncate" title={row.title}>{row.title}</td>
                        <td className="p-2 text-[color:var(--body-text)] max-w-[220px] truncate" title={row.description}>{row.description}</td>
                        <td className="p-2 text-[color:var(--text-secondary)] max-w-[180px] truncate" title={row.image}>{row.image}</td>
                        <td className="p-2 text-[color:var(--text-secondary)] max-w-[180px] truncate" title={row.url}>{row.url}</td>
                        <td className="p-2 text-[color:var(--text-secondary)]">{row.type}</td>
                        <td className="p-2 text-[color:var(--text-secondary)]">{row.siteName}</td>
                        <td className="p-2 text-[color:var(--text-secondary)]">
                          {row.cardLinks.length > 0 ? (
                            <div className="space-y-1">
                              {row.cardLinks.map((item) => (
                                <a
                                  key={`${row.sourceUrl}-${item.platform}-${item.link}`}
                                  href={item.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block truncate text-[11px] text-sky-300 hover:text-sky-200 hover:underline"
                                  title={`${item.platform}: ${item.link}`}
                                >
                                  {item.platform}: {item.link}
                                </a>
                              ))}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                    {metaTagRows.length === 0 && (
                      <tr className="border-t border-[color:var(--border-color)]">
                        <td colSpan={8} className="p-4 text-center text-[color:var(--text-muted)]">
                          Chưa có dữ liệu meta tags.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        <section className={`rounded-3xl border p-6 ${BRAND.panel}`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--text-primary)] flex items-center gap-2">
                <Bot size={14} className="text-[color:var(--tool-violet-heading)]" />
                Indexability per URL
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--tool-violet-muted)]">
                HTTP · Meta Robots · X-Robots-Tag · Canonical · Sitemap · AI Bot · JS Rendered
              </p>
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar-indigo rounded-2xl border border-[color:var(--tool-surface-border)]">
            <table className="w-full min-w-[1400px] text-left text-xs">
              <thead className="bg-[color:var(--tool-surface-subtle)] uppercase text-[color:var(--text-muted)]">
                <tr>
                  <th className="p-2">URL</th>
                  <th className="p-2">HTTP</th>
                  <th className="p-2">Meta Robots</th>
                  <th className="p-2">X-Robots-Tag</th>
                  <th className="p-2">Canonical</th>
                  <th className="p-2">In Sitemap</th>
                  <th className="p-2">Robots.txt</th>
                  <th className="p-2">AI Bot</th>
                  <th className="p-2">JS Rendered</th>
                  <th className="p-2">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {indexabilityRows.map((row) => {
                  const httpClass =
                    row.statusCode >= 200 && row.statusCode < 300
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : row.statusCode >= 300 && row.statusCode < 400
                        ? 'bg-sky-500/20 text-sky-200'
                        : row.statusCode >= 400
                          ? 'bg-rose-500/20 text-rose-200'
                          : 'bg-[color:var(--tool-chip-inactive-bg)] text-[color:var(--text-secondary)]';
                  const verdictClass =
                    row.verdict === 'CAN_INDEX'
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : row.verdict === 'WARN'
                        ? 'bg-amber-500/20 text-amber-200'
                        : 'bg-rose-500/20 text-rose-200';
                  const tooltip = row.reasons.length ? row.reasons.join(' • ') : 'OK';
                  return (
                    <tr key={row.url} className="border-t border-[color:var(--border-color)]">
                      <td className="p-2 text-[color:var(--text-secondary)] max-w-[260px] truncate" title={row.url}>{row.url}</td>
                      <td className="p-2">
                        <span className={`rounded px-2 py-0.5 font-bold ${httpClass}`}>
                          {row.statusCode || '--'}
                        </span>
                      </td>
                      <td className="p-2 text-[color:var(--body-text)] max-w-[160px] truncate" title={row.metaRobots}>{row.metaRobots}</td>
                      <td className="p-2 text-[color:var(--body-text)] max-w-[140px] truncate" title={row.xRobots || '-'}>
                        {row.xRobots || <span className="text-[color:var(--text-muted)]">-</span>}
                      </td>
                      <td className="p-2 text-[color:var(--body-text)] max-w-[200px]">
                        <div className="flex items-center gap-1">
                          {row.canonicalSelf ? (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">self</span>
                          ) : row.canonical && row.canonical !== '-' ? (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">other</span>
                          ) : (
                            <span className="rounded bg-[color:var(--tool-chip-inactive-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--text-secondary)]">-</span>
                          )}
                          <span className="truncate text-[10px] text-[color:var(--text-muted)]" title={row.canonical}>{row.canonical}</span>
                        </div>
                      </td>
                      <td className="p-2">
                        {row.inSitemap === null ? (
                          <span className="text-[color:var(--text-muted)]">--</span>
                        ) : row.inSitemap ? (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">✓</span>
                        ) : (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">✗</span>
                        )}
                      </td>
                      <td className="p-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${row.robotsPathVerdict.blocked ? 'bg-rose-500/20 text-rose-200' : 'bg-emerald-500/20 text-emerald-200'}`}
                          title={row.robotsPathVerdict.matchedRule || undefined}
                        >
                          {row.robotsPathVerdict.blocked
                            ? `disallow ${row.robotsPathVerdict.matchedRule || ''}`.trim()
                            : row.robotsPathVerdict.matchedRule
                              ? `allow ${row.robotsPathVerdict.matchedRule}`
                              : 'allow'}
                        </span>
                      </td>
                      <td className="p-2">
                        {row.aiBlocked.length === 0 ? (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">open</span>
                        ) : (
                          <span
                            className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-200"
                            title={row.aiBlocked.join(', ')}
                          >
                            {row.aiBlocked.length} blocked
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        {row.jsStable === null ? (
                          <span className="text-[color:var(--text-muted)]">--</span>
                        ) : row.jsStable ? (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">STABLE</span>
                        ) : (
                          <span
                            className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200"
                            title={
                              row.jsDiff
                                ? [
                                    row.jsDiff.titleChanged && 'title',
                                    row.jsDiff.h1Changed && 'h1',
                                    row.jsDiff.canonicalChanged && 'canonical',
                                    row.jsDiff.noindexChanged && 'noindex',
                                  ]
                                    .filter(Boolean)
                                    .join(', ')
                                : ''
                            }
                          >
                            DRIFT
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        <span className={`rounded px-2 py-0.5 font-bold ${verdictClass}`} title={tooltip}>
                          {row.verdict.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {indexabilityRows.length === 0 && (
                  <tr className="border-t border-[color:var(--border-color)]">
                    <td colSpan={10} className="p-4 text-center text-[color:var(--text-muted)]">
                      Chưa có URL nào được phân tích.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`rounded-3xl border p-6 ${BRAND.panel}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--text-primary)] flex items-center gap-2">
                <Gauge size={14} className="text-[color:var(--tool-violet-heading)]" />
                Core Web Vitals (Lighthouse-lite)
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--tool-violet-muted)]">
                LCP / CLS / FCP / TTFB · mặc định tắt vì chậm
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--body-text)]">
                <input
                  type="checkbox"
                  checked={cwvAutoOn}
                  onChange={(e) => setCwvAutoOn(e.target.checked)}
                  className="accent-violet-400"
                />
                Auto run on next scan
              </label>
              <button
                onClick={() => runCwvForUrls(results.map((r) => r.url).filter((u) => !cwvByUrl[u]))}
                disabled={cwvRunning || results.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-violet-300/30 bg-violet-500/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-[color:var(--tool-violet-body)] disabled:opacity-40"
              >
                <Gauge size={12} /> {cwvRunning ? `Running ${cwvProgress.done}/${cwvProgress.total}` : 'Run CWV (slow)'}
              </button>
              {Object.keys(cwvByUrl).length > 0 && !cwvRunning && (
                <button
                  onClick={() => setCwvByUrl({})}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-300/20 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-200"
                >
                  <Trash2 size={11} /> Clear
                </button>
              )}
            </div>
          </div>
          {cwvRunning && (
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--tool-surface-subtle)]">
              <div
                className="h-full bg-violet-400 transition-all"
                style={{
                  width: cwvProgress.total ? `${(cwvProgress.done / cwvProgress.total) * 100}%` : '0%',
                }}
              />
            </div>
          )}
          <div className="overflow-x-auto custom-scrollbar-indigo rounded-2xl border border-[color:var(--tool-surface-border)]">
            <table className="w-full min-w-[1000px] text-left text-xs">
              <thead className="bg-[color:var(--tool-surface-subtle)] uppercase text-[color:var(--text-muted)]">
                <tr>
                  <th className="p-2">URL</th>
                  <th className="p-2">LCP (ms)</th>
                  <th className="p-2">CLS</th>
                  <th className="p-2">FCP (ms)</th>
                  <th className="p-2">TTFB (ms)</th>
                  <th className="p-2">Overall</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const cwv = cwvByUrl[r.url];
                  const cls = (s: 'good' | 'needs-improvement' | 'poor' | null) =>
                    s === 'good'
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : s === 'needs-improvement'
                        ? 'bg-amber-500/20 text-amber-200'
                        : s === 'poor'
                          ? 'bg-rose-500/20 text-rose-200'
                          : 'bg-[color:var(--tool-chip-inactive-bg)] text-[color:var(--text-muted)]';
                  return (
                    <tr key={r.url} className="border-t border-[color:var(--border-color)]">
                      <td className="p-2 text-[color:var(--text-secondary)] max-w-[280px] truncate" title={r.url}>{r.url}</td>
                      <td className="p-2">
                        {cwv ? (
                          <span className={`rounded px-2 py-0.5 font-bold ${cls(cwv.scoreLCP)}`}>
                            {cwv.LCP ?? '--'}
                          </span>
                        ) : (
                          <span className="text-[color:var(--text-muted)]">--</span>
                        )}
                      </td>
                      <td className="p-2">
                        {cwv ? (
                          <span className={`rounded px-2 py-0.5 font-bold ${cls(cwv.scoreCLS)}`}>
                            {cwv.CLS ?? '--'}
                          </span>
                        ) : (
                          <span className="text-[color:var(--text-muted)]">--</span>
                        )}
                      </td>
                      <td className="p-2">
                        {cwv ? (
                          <span className={`rounded px-2 py-0.5 font-bold ${cls(cwv.scoreFCP)}`}>
                            {cwv.FCP ?? '--'}
                          </span>
                        ) : (
                          <span className="text-[color:var(--text-muted)]">--</span>
                        )}
                      </td>
                      <td className="p-2">
                        {cwv ? (
                          <span className={`rounded px-2 py-0.5 font-bold ${cls(cwv.scoreTTFB)}`}>
                            {cwv.TTFB ?? '--'}
                          </span>
                        ) : (
                          <span className="text-[color:var(--text-muted)]">--</span>
                        )}
                      </td>
                      <td className="p-2">
                        {cwv ? (
                          <span
                            className={`rounded px-2 py-0.5 font-bold ${
                              cwv.overall === 'good'
                                ? 'bg-emerald-500/20 text-emerald-200'
                                : cwv.overall === 'needs-improvement'
                                  ? 'bg-amber-500/20 text-amber-200'
                                  : cwv.overall === 'poor'
                                    ? 'bg-rose-500/20 text-rose-200'
                                    : 'bg-[color:var(--tool-chip-inactive-bg)] text-[color:var(--text-secondary)]'
                            }`}
                          >
                            {cwv.overall === 'unknown'
                              ? cwv.error || 'unknown'
                              : cwv.overall.replace('-', ' ')}
                          </span>
                        ) : (
                          <span className="text-[color:var(--text-muted)]">{cwvRunning ? '…' : 'not run'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {results.length === 0 && (
                  <tr className="border-t border-[color:var(--border-color)]">
                    <td colSpan={6} className="p-4 text-center text-[color:var(--text-muted)]">
                      Chưa có URL nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`rounded-3xl border p-6 ${BRAND.panel}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--text-primary)]">
                Full SEO Audit (1:1 SEOmator - 251 rules)
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--tool-violet-muted)]">
                Core · Performance · Security · Crawlability · Schema · JS Render · Accessibility · v.v.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--body-text)]">
                <input
                  type="checkbox"
                  checked={fullAuditIncludeCwv}
                  onChange={(e) => setFullAuditIncludeCwv(e.target.checked)}
                  className="accent-violet-400"
                />
                Include CWV/INP
              </label>
              <button
                onClick={() => runFullAudit(results[0]?.url || '')}
                disabled={fullAuditRunning || results.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-violet-300/30 bg-violet-500/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-[color:var(--tool-violet-body)] disabled:opacity-40"
              >
                {fullAuditRunning ? 'Running full audit…' : 'Run 1:1 full audit'}
              </button>
              <button
                onClick={() => exportFullAudit('json')}
                disabled={fullAuditRunning || fullAuditExporting || results.length === 0}
                className="rounded-lg border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--body-text)] disabled:opacity-40"
              >
                JSON
              </button>
              <button
                onClick={() => exportFullAudit('html')}
                disabled={fullAuditRunning || fullAuditExporting || results.length === 0}
                className="rounded-lg border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--body-text)] disabled:opacity-40"
              >
                HTML
              </button>
              <button
                onClick={() => exportFullAudit('markdown')}
                disabled={fullAuditRunning || fullAuditExporting || results.length === 0}
                className="rounded-lg border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--body-text)] disabled:opacity-40"
              >
                Markdown
              </button>
              <button
                onClick={() => exportFullAudit('llm')}
                disabled={fullAuditRunning || fullAuditExporting || results.length === 0}
                className="rounded-lg border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--body-text)] disabled:opacity-40"
              >
                LLM
              </button>
            </div>
          </div>
          {fullAuditError ? (
            <div className="mb-3 rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {fullAuditError}
            </div>
          ) : null}
          {fullAuditResult ? (
            <>
              <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">Overall score</p>
                  <p className="mt-1 text-xl font-black text-[color:var(--tool-violet-body)]">{fullAuditResult.overallScore}</p>
                </div>
                <div className="rounded-xl border border-[color:var(--tool-input-border)] bg-[color:var(--tool-input-bg)] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">Categories</p>
                  <p className="mt-1 text-xl font-black text-[color:var(--tool-violet-body)]">{fullAuditResult.categoryResults.length}</p>
                </div>
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-200">Total pass</p>
                  <p className="mt-1 text-xl font-black text-emerald-100">
                    {fullAuditResult.categoryResults.reduce((sum, c) => sum + c.passCount, 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-rose-200">Total fail</p>
                  <p className="mt-1 text-xl font-black text-rose-100">
                    {fullAuditResult.categoryResults.reduce((sum, c) => sum + c.failCount, 0)}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto custom-scrollbar-indigo rounded-2xl border border-[color:var(--tool-surface-border)]">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-[color:var(--tool-surface-subtle)] uppercase text-[color:var(--text-muted)]">
                    <tr>
                      <th className="p-2">Category</th>
                      <th className="p-2">Score</th>
                      <th className="p-2">Pass</th>
                      <th className="p-2">Warn</th>
                      <th className="p-2">Fail</th>
                      <th className="p-2">Top fail rules</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullAuditResult.categoryResults.map((cat) => {
                      const topFails = cat.results.filter((r) => r.status === 'fail').slice(0, 3);
                      return (
                        <tr key={cat.categoryId} className="border-t border-[color:var(--border-color)]">
                          <td className="p-2 text-[color:var(--text-secondary)]">{cat.categoryId}</td>
                          <td className="p-2 text-[color:var(--body-text)]">{cat.score}</td>
                          <td className="p-2 text-emerald-200">{cat.passCount}</td>
                          <td className="p-2 text-amber-200">{cat.warnCount}</td>
                          <td className="p-2 text-rose-200">{cat.failCount}</td>
                          <td className="p-2 text-[color:var(--text-secondary)]">
                            {topFails.length
                              ? topFails.map((f) => `${f.ruleId}: ${f.message}`).join(' | ')
                              : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-xs text-[color:var(--text-muted)]">
              Chưa chạy full audit. Nhấn “Run 1:1 full audit” để chạy toàn bộ rule engine từ
              seo-audit-skill.
            </p>
          )}
        </section>
      </div>
      )}

      {activeDashboard === 'structure' ? (
      <section className={`rounded-3xl border p-4 ${BRAND.panel}`}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--text-primary)]">Kết quả kiểm tra ({results.length})</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--tool-violet-muted)]">Thu thập dữ liệu tự động</p>
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
              <thead className="text-xs uppercase text-[color:var(--text-muted)]">
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
                  <tr key={r.url} className="border-t border-[color:var(--border-color)] transition-colors hover:bg-violet-600/[0.03]">
                    <td className="p-2 text-[color:var(--text-secondary)]">{r.url}</td>
                    <td className="p-2 text-[color:var(--body-text)]">{r.statusCode || 0}</td>
                    <td className="p-2 text-[color:var(--text-secondary)]">{r.h1 || 'N/A'}</td>
                    <td className="p-2 text-[color:var(--tool-violet-body)]">{r.keywordDensity || '0.00%'}</td>
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
                    <td className="p-2 text-[color:var(--text-secondary)]">{(r.linkStats?.internal || 0) + (r.linkStats?.external || 0)}</td>
                    <td className="p-2">
                      <button
                        onClick={() => setDetail(r)}
                        className="rounded-lg border border-violet-300/30 bg-violet-500/20 px-3 py-1 text-xs font-bold text-[color:var(--tool-violet-body)]"
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
              <Stethoscope size={56} className="text-[color:var(--tool-empty-icon)]" />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-black uppercase tracking-widest text-[color:var(--text-primary)]">Sẵn sàng kiểm tra</p>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[color:var(--text-muted)]">
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
            <div className="flex items-center justify-between border-b border-[color:var(--tool-surface-border)] p-4">
              <div>
                <p className="text-sm font-bold text-[color:var(--text-primary)]">{detail.title || detail.url}</p>
                <p className="text-xs text-[color:var(--text-muted)]">{detail.url}</p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-full p-2 text-[color:var(--text-secondary)] hover:bg-[color:var(--tool-chip-inactive-bg)]">
                <X size={18} />
              </button>
            </div>
            <div className="flex gap-2 border-b border-[color:var(--tool-surface-border)] p-3">
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
                    tab === t.id ? 'bg-violet-500/20 text-[color:var(--tool-violet-body)] border border-violet-300/30' : 'text-[color:var(--text-muted)]'
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
                    <div key={`${k.word}-${k.count}`} className="flex items-center justify-between rounded-xl border border-[color:var(--tool-surface-border)] bg-[color:var(--tool-surface-subtle)] p-3">
                      <span className="text-[color:var(--body-text)]">{k.word}</span>
                      <span className="text-[color:var(--text-secondary)]">{k.count} · {k.density}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {tab === 'headings' ? (
                <div className="space-y-2">
                  {detail.headingTree?.length
                    ? renderTree(detail.headingTree)
                    : (detail.headings || []).map((h, idx) => (
                        <div key={`${h.tag}-${h.text}-${idx}`} className="rounded-xl border border-[color:var(--tool-surface-border)] bg-[color:var(--tool-surface-subtle)] p-3 text-[color:var(--body-text)]">
                          <span className="mr-2 rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-[color:var(--tool-violet-body)]">{h.tag}</span>
                          {h.text}
                        </div>
                      ))}
                </div>
              ) : null}

              {tab === 'links' ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[color:var(--tool-surface-border)] bg-[color:var(--tool-surface-subtle)] p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--tool-violet-body)]">Anchor Links</p>
                    <p className="text-xs text-[color:var(--text-secondary)]">Internal: {detail.linkStats?.anchor?.internal || 0}</p>
                    <p className="text-xs text-[color:var(--text-secondary)]">External: {detail.linkStats?.anchor?.external || 0}</p>
                    <p className="text-xs text-[color:var(--text-secondary)]">Nofollow: {detail.linkStats?.anchor?.nofollow || 0}</p>
                    <p className="text-xs text-[color:var(--text-secondary)]">Dofollow: {detail.linkStats?.anchor?.dofollow || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--tool-surface-border)] bg-[color:var(--tool-surface-subtle)] p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--tool-violet-body)]">Resource Links</p>
                    <p className="text-xs text-[color:var(--text-secondary)]">Internal: {detail.linkStats?.resource?.internal || 0}</p>
                    <p className="text-xs text-[color:var(--text-secondary)]">External: {detail.linkStats?.resource?.external || 0}</p>
                    <p className="text-xs text-[color:var(--text-secondary)]">Nofollow: {detail.linkStats?.resource?.nofollow || 0}</p>
                    <p className="text-xs text-[color:var(--text-secondary)]">Dofollow: {detail.linkStats?.resource?.dofollow || 0}</p>
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

      {robotsRawModal ? (
        <div className="fixed inset-0 z-[96] bg-black/70 p-6 backdrop-blur-sm">
          <div className="mx-auto flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-violet-400/30 bg-slate-950">
            <div className="flex items-center justify-between border-b border-[color:var(--tool-surface-border)] p-4">
              <div>
                <p className="text-sm font-bold text-[color:var(--text-primary)] flex items-center gap-2">
                  <ShieldAlert size={14} className="text-[color:var(--tool-violet-heading)]" />
                  robots.txt — {robotsRawModal.domain}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--tool-violet-muted)]">
                  HTTP {robotsRawModal.robots.statusCode || 'N/A'} · sitemap refs: {robotsRawModal.robots.sitemapRefs.length}
                </p>
              </div>
              <button onClick={() => setRobotsRawModal(null)} className="rounded-full p-2 text-[color:var(--text-secondary)] hover:bg-[color:var(--tool-chip-inactive-bg)]">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar-indigo p-4">
              <div className="mb-3 flex flex-wrap gap-1 text-[10px] font-bold">
                <span className={`rounded px-1.5 py-0.5 ${robotsRawModal.robots.blocksGooglebot ? 'bg-rose-500/20 text-rose-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                  {robotsRawModal.robots.blocksGooglebot ? 'BLOCK Googlebot' : 'Allow Googlebot'}
                </span>
                {robotsRawModal.robots.blocksAiBots.map((b) => (
                  <span
                    key={b.name}
                    className={`rounded px-1.5 py-0.5 ${b.blocked ? 'bg-rose-500/20 text-rose-200' : 'bg-emerald-500/20 text-emerald-200'}`}
                  >
                    {b.blocked ? 'BLOCK' : 'Allow'} {b.name}
                  </span>
                ))}
              </div>
              <pre className="whitespace-pre-wrap break-all rounded-2xl border border-[color:var(--tool-surface-border)] bg-[color:var(--tool-input-bg)] p-4 text-[11px] leading-relaxed text-[color:var(--body-text)]">
                {(robotsRawModal.robots.raw || '').split('\n').map((line, idx) => {
                  const lower = line.toLowerCase();
                  let cls = 'text-[color:var(--text-secondary)]';
                  if (lower.startsWith('user-agent')) cls = 'text-[color:var(--tool-violet-heading)] font-bold';
                  else if (lower.startsWith('disallow')) cls = 'text-rose-300';
                  else if (lower.startsWith('allow')) cls = 'text-emerald-300';
                  else if (lower.startsWith('sitemap')) cls = 'text-sky-300';
                  else if (lower.startsWith('crawl-delay')) cls = 'text-amber-300';
                  else if (lower.startsWith('#')) cls = 'text-[color:var(--text-muted)] italic';
                  return (
                    <div key={idx} className={cls}>
                      {line || '\u00A0'}
                    </div>
                  );
                })}
              </pre>
            </div>
          </div>
        </div>
      ) : null}

      {imageDetailGroup ? (
        <div className="fixed inset-0 z-[95] bg-black/70 p-6 backdrop-blur-sm">
          <div className="mx-auto h-[85vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-violet-400/30 bg-slate-950">
            <div className="flex items-center justify-between border-b border-[color:var(--tool-surface-border)] p-4">
              <div>
                <p className="text-sm font-bold text-[color:var(--text-primary)]">Chi tiết hình ảnh theo URL</p>
                <p className="text-xs text-[color:var(--text-muted)]">{imageDetailGroup.pageUrl}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--tool-violet-muted)]">{imageDetailGroup.images.length} ảnh</p>
              </div>
              <button onClick={() => setImageDetailGroup(null)} className="rounded-full p-2 text-[color:var(--text-secondary)] hover:bg-[color:var(--tool-chip-inactive-bg)]">
                <X size={18} />
              </button>
            </div>
            <div className="h-[calc(85vh-72px)] overflow-auto custom-scrollbar-indigo p-4">
              <div className="overflow-x-auto custom-scrollbar-indigo rounded-2xl border border-[color:var(--tool-surface-border)]">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-[color:var(--tool-surface-subtle)] uppercase text-[color:var(--text-muted)]">
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
                      <tr key={`${img.src}-${idx}`} className="border-t border-[color:var(--border-color)]">
                        <td className="p-2">
                          <a href={img.src} target="_blank" rel="noreferrer" className="block w-fit">
                            <img src={img.src} alt={img.alt || 'image'} loading="lazy" className="h-12 w-20 rounded border border-[color:var(--tool-surface-border)] object-cover" />
                          </a>
                        </td>
                        <td className="p-2 text-[color:var(--text-secondary)]">{img.src}</td>
                        <td className="p-2 text-[color:var(--body-text)]">{img.alt || <span className="text-rose-300">Missing</span>}</td>
                        <td className="p-2 text-[color:var(--body-text)]">{img.title || <span className="text-amber-300">Missing</span>}</td>
                        <td className="p-2 text-[color:var(--text-secondary)]">{img.sizeKb ?? '--'}</td>
                        <td className="p-2 text-[color:var(--text-secondary)]">{img.width ? `${img.width}px` : '--'}</td>
                        <td className="p-2 text-[color:var(--text-secondary)]">{img.height ? `${img.height}px` : '--'}</td>
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

