'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Download,
  ExternalLink,
  Globe,
  History,
  KeyRound,
  Link2,
  Loader2,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Gauge,
  Target,
  TrendingUp,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SETTINGS_KEY = 'omnisuite_settings';
const SEO_HISTORY_KEY = 'omnisuite_seo_history';
const SAVED_KEYWORDS_KEY = 'omnisuite_saved_keywords';

type KeywordMode = 'auto' | 'related' | 'suggestions' | 'ideas';
type SortField = 'volume' | 'competition' | 'cpc' | 'keyword';
type SortOrder = 'asc' | 'desc';

type SearchHistoryItem = {
  id: string;
  domain: string;
  seedKeyword: string;
  locationCode: number;
  limit: number;
  timestamp: number;
  includeAiVisibility: boolean;
  keywordMode: KeywordMode;
};

type SavedKeyword = {
  id: string;
  keyword: string;
  searchVolume: number;
  competition: string;
  cpc: number | null;
  savedAt: number;
  domain: string;
};

type AdvancedSeoResult = {
  target: string;
  seedKeyword: string;
  totalCost: number;
  partialErrors: Record<string, string | null>;
  overview: any;
  rankedKeywords: any[];
  keywordIdeas: any[];
  serp: any[];
  backlinks: any;
  backlinkRows: any[];
  referringDomains: any[];
  domainPages: any[];
  rankCheck: {
    position: number | null;
    url: string | null;
  };
  rankChecks: Array<{
    keyword: string;
    position: number | null;
    url: string | null;
  }>;
  aiVisibility: {
    enabled: boolean;
    google: any;
    googleTopPages: any[];
    chatGpt: any;
  };
  quickAudit: {
    score: number;
    issues: Array<{
      label: string;
      status: 'pass' | 'warn' | 'fail';
      detail: string;
    }>;
  };
};

const locationOptions = [
  { label: 'Vietnam', value: 2704, language: 'vi' },
  { label: 'United States', value: 2840, language: 'en' },
  { label: 'Global English', value: 2840, language: 'en' },
];

const keywordModes: { value: KeywordMode; label: string; description: string }[] = [
  { value: 'auto', label: 'Tự động', description: 'Tự động chọn chế độ tốt nhất' },
  { value: 'related', label: 'Related', description: 'Từ khóa liên quan đến seed' },
  { value: 'suggestions', label: 'Suggestions', description: 'Gợi ý từ khóa mở rộng' },
  { value: 'ideas', label: 'Ideas', description: 'Ý tưởng từ khóa mới' },
];

const sortOptions: { value: SortField; label: string }[] = [
  { value: 'keyword', label: 'Keyword' },
  { value: 'volume', label: 'Search Volume' },
  { value: 'competition', label: 'Cạnh tranh' },
  { value: 'cpc', label: 'CPC' },
];

function formatNumber(value: any) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  return new Intl.NumberFormat('vi-VN').format(number);
}

function getSearchVolume(item: any) {
  return item?.keyword_data?.keyword_info?.search_volume ?? item?.keyword_info?.search_volume ?? 0;
}

function getCompetition(item: any) {
  return item?.keyword_data?.keyword_info?.competition_level ?? item?.keyword_info?.competition_level ?? '--';
}

function getCpc(item: any) {
  return item?.keyword_data?.keyword_info?.cpc ?? item?.keyword_info?.cpc ?? null;
}

function getKeyword(item: any) {
  return item?.keyword_data?.keyword ?? item?.keyword ?? '--';
}

function metricFromOverview(overview: any, key: string) {
  return overview?.metrics?.organic?.[key] ?? overview?.[key] ?? null;
}

function buildCsv(rows: any[], type: 'ranked' | 'ideas') {
  const header = ['keyword', 'search_volume', 'competition', 'cpc', 'ranked_url', 'rank_position'];
  const lines = rows.map((row) => {
    const values = [
      getKeyword(row),
      getSearchVolume(row),
      getCompetition(row),
      getCpc(row) ?? '',
      type === 'ranked' ? row?.ranked_serp_element?.serp_item?.url ?? '' : '',
      type === 'ranked' ? row?.ranked_serp_element?.serp_item?.rank_absolute ?? '' : '',
    ];
    return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
  });
  return [header.join(','), ...lines].join('\n');
}

function getAiMetric(total: any, platform: string, key: string) {
  const platformRow = Array.isArray(total?.platform)
    ? total.platform.find((item: any) => item?.key === platform)
    : null;
  return platformRow?.[key] ?? total?.[key] ?? null;
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-5 animate-pulse" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.16)' }}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="h-2.5 w-20 rounded bg-cyan-500/20" />
          <div className="mt-3 h-8 w-24 rounded bg-cyan-500/10" />
        </div>
        <div className="h-11 w-11 rounded-xl bg-cyan-500/10" />
      </div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="rounded-[2rem] p-6 overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.16)' }}>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="h-4 w-32 rounded bg-cyan-500/20" />
        <div className="h-3 w-16 rounded bg-cyan-500/10" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-cyan-500/5" />
        ))}
      </div>
    </div>
  );
}

function HistoryPanel({
  history,
  onSelect,
  onRemove,
  onClear,
  isOpen,
  onClose,
}: {
  history: SearchHistoryItem[];
  onSelect: (item: SearchHistoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 right-0 mt-2 z-50"
    >
      <div className="rounded-2xl p-4 shadow-2xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.3)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black uppercase flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <History size={16} className="text-cyan-400" />
            Tìm kiếm gần đây
          </h3>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Trash2 size={12} />
                Xóa tất cả
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
              <X size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
            Chưa có lịch sử tìm kiếm
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => onSelect(item)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                    {item.domain}
                  </p>
                  {item.seedKeyword && (
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      Keyword: {item.seedKeyword}
                    </p>
                  )}
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {new Date(item.timestamp).toLocaleDateString('vi-VN')} · {locationOptions.find(l => l.value === item.locationCode)?.label}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                  className="p-2 opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 rounded-lg transition-all"
                >
                  <Trash2 size={14} className="text-rose-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SaveKeywordDialog({
  keyword,
  isOpen,
  onClose,
  onSave,
}: {
  keyword: { keyword: string; volume: number; competition: string; cpc: number | null } | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!isOpen || !keyword) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.3)' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Save size={18} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase" style={{ color: 'var(--text-primary)' }}>Lưu Keyword</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Thêm vào danh sách theo dõi</p>
            </div>
          </div>

          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'var(--hover-bg)' }}>
            <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{keyword.keyword}</p>
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>Volume: <span className="text-emerald-400 font-bold">{formatNumber(keyword.volume)}</span></span>
              <span style={{ color: 'var(--text-secondary)' }}>CPC: <span className="text-sky-400 font-bold">{keyword.cpc ? `$${keyword.cpc.toFixed(2)}` : '--'}</span></span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-xl font-bold text-xs uppercase tracking-widest"
              style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}
            >
              Hủy
            </button>
            <button
              onClick={onSave}
              className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest transition-all"
            >
              Lưu keyword
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function AuditGauge({ score, size = 120 }: { score: number; size?: number }) {
  const circumference = 2 * Math.PI * ((size - 12) / 2);
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size - 12) / 2}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size - 12) / 2}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black" style={{ color }}>{score}</span>
        <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>/100</span>
      </div>
    </div>
  );
}

function AuditCategoryBadge({ status, count }: { status: 'fail' | 'warn' | 'pass'; count: number }) {
  const config = {
    fail: { label: 'Critical', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
    warn: { label: 'Warning', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    pass: { label: 'Passed', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  };
  const c = config[status];

  return (
    <div className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border ${c.color} flex items-center gap-2`}>
      <span className={`h-2 w-2 rounded-full ${status === 'fail' ? 'bg-rose-400' : status === 'warn' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
      {c.label}
      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>{count}</span>
    </div>
  );
}

function SortControls({
  sortField,
  sortOrder,
  onSortChange,
}: {
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        <Filter size={12} className="inline mr-1" />
        Sắp xếp:
      </span>
      <div className="flex items-center gap-1">
        {sortOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onSortChange(option.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              sortField === option.value
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'hover:bg-white/5'
            }`}
            style={{ color: sortField === option.value ? undefined : 'var(--text-secondary)' }}
          >
            {option.label}
            {sortField === option.value && (
              sortOrder === 'asc' ? <ChevronUp size={12} className="inline ml-1" /> : <ChevronDown size={12} className="inline ml-1" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'indigo',
}: {
  label: string;
  value: React.ReactNode;
  icon: any;
  tone?: 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose';
}) {
  const toneMap = {
    indigo: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.16)' }}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <div className="mt-2 text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{value}</div>
        </div>
        <div className={`h-11 w-11 rounded-xl border flex items-center justify-center ${toneMap[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function DataTable({
  title,
  rows,
  type,
  onSaveKeyword,
}: {
  title: string;
  rows: any[];
  type: 'ranked' | 'ideas';
  onSaveKeyword?: (keyword: string, volume: number, competition: string, cpc: number | null) => void;
}) {
  const displayRows = rows.slice(0, 12);

  return (
    <div className="rounded-[2rem] p-6 overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.16)' }}>
      <div className="flex items-center justify-between gap-4 mb-5">
        <h3 className="text-sm font-black uppercase" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {formatNumber(rows.length)} dòng
        </span>
      </div>

      {displayRows.length === 0 ? (
        <div className="py-12 text-center text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Chưa có dữ liệu
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                <th className="pb-3 pr-4">Keyword</th>
                <th className="pb-3 pr-4">Volume</th>
                <th className="pb-3 pr-4">Cạnh tranh</th>
                <th className="pb-3 pr-4">CPC</th>
                {type === 'ranked' && <th className="pb-3">URL</th>}
                {onSaveKeyword && <th className="pb-3 pl-2"></th>}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, index) => (
                <tr key={`${getKeyword(row)}-${index}`} className="text-xs font-bold group" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td className="py-4 pr-4 min-w-[220px]" style={{ color: 'var(--text-primary)' }}>{getKeyword(row)}</td>
                  <td className="py-4 pr-4 text-emerald-400">{formatNumber(getSearchVolume(row))}</td>
                  <td className="py-4 pr-4" style={{ color: 'var(--text-secondary)' }}>{getCompetition(row)}</td>
                  <td className="py-4 pr-4" style={{ color: 'var(--text-secondary)' }}>{getCpc(row) ? `$${Number(getCpc(row)).toFixed(2)}` : '--'}</td>
                  {type === 'ranked' && (
                    <td className="py-4 min-w-[260px]">
                      {row?.ranked_serp_element?.serp_item?.url ? (
                        <a
                          href={row.ranked_serp_element.serp_item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 max-w-[320px] truncate text-sky-400 hover:text-sky-300"
                        >
                          <ExternalLink size={12} />
                          <span className="truncate">{row.ranked_serp_element.serp_item.url}</span>
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>--</span>
                      )}
                    </td>
                  )}
                  {onSaveKeyword && (
                    <td className="py-4 pl-2">
                      <button
                        onClick={() => onSaveKeyword(getKeyword(row), getSearchVolume(row), getCompetition(row), getCpc(row))}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-emerald-500/20 transition-all"
                        title="Lưu keyword"
                      >
                        <Save size={14} className="text-emerald-400" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SimpleListTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: any[];
  columns: Array<{ label: string; render: (row: any, index: number) => React.ReactNode; className?: string }>;
}) {
  const displayRows = rows.slice(0, 10);

  return (
    <div className="rounded-[2rem] p-6 overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.16)' }}>
      <div className="flex items-center justify-between gap-4 mb-5">
        <h3 className="text-sm font-black uppercase" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {formatNumber(rows.length)} dòng
        </span>
      </div>

      {displayRows.length === 0 ? (
        <div className="py-10 text-center text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Chưa có dữ liệu
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                {columns.map((column) => (
                  <th key={column.label} className={`pb-3 pr-4 ${column.className || ''}`}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, index) => (
                <tr key={`${title}-${index}`} className="text-xs font-bold" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {columns.map((column) => (
                    <td key={column.label} className={`py-4 pr-4 ${column.className || ''}`}>
                      {column.render(row, index)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdvancedSeoPage() {
  const [domain, setDomain] = useState('');
  const [seedKeyword, setSeedKeyword] = useState('');
  const [trackingKeywords, setTrackingKeywords] = useState('');
  const [includeAiVisibility, setIncludeAiVisibility] = useState(false);
  const [locationCode, setLocationCode] = useState(2704);
  const [languageCode, setLanguageCode] = useState('vi');
  const [limit, setLimit] = useState(25);
  const [keywordMode, setKeywordMode] = useState<KeywordMode>('auto');
  const [settings, setSettings] = useState<any>({});
  const [result, setResult] = useState<AdvancedSeoResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // History state
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('volume');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Saved keywords state
  const [savedKeywords, setSavedKeywords] = useState<SavedKeyword[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [keywordToSave, setKeywordToSave] = useState<{ keyword: string; volume: number; competition: string; cpc: number | null } | null>(null);

  // Load history and saved keywords on mount
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch {
        setSettings({});
      }
    }

    const history = localStorage.getItem(SEO_HISTORY_KEY);
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch {
        setSearchHistory([]);
      }
    }

    const savedKws = localStorage.getItem(SAVED_KEYWORDS_KEY);
    if (savedKws) {
      try {
        setSavedKeywords(JSON.parse(savedKws));
      } catch {
        setSavedKeywords([]);
      }
    }
  }, []);

  // History management
  const addToHistory = useCallback((item: Omit<SearchHistoryItem, 'id' | 'timestamp'>) => {
    const newItem: SearchHistoryItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    const updated = [newItem, ...searchHistory].slice(0, 20);
    setSearchHistory(updated);
    localStorage.setItem(SEO_HISTORY_KEY, JSON.stringify(updated));
  }, [searchHistory]);

  const removeFromHistory = useCallback((id: string) => {
    const updated = searchHistory.filter((item) => item.id !== id);
    setSearchHistory(updated);
    localStorage.setItem(SEO_HISTORY_KEY, JSON.stringify(updated));
  }, [searchHistory]);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem(SEO_HISTORY_KEY);
  }, []);

  const selectHistoryItem = useCallback((item: SearchHistoryItem) => {
    setDomain(item.domain);
    setSeedKeyword(item.seedKeyword);
    setLocationCode(item.locationCode);
    setLimit(item.limit);
    setIncludeAiVisibility(item.includeAiVisibility);
    setKeywordMode(item.keywordMode);
    setShowHistory(false);
  }, []);

  // Sorting logic
  const handleSortChange = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }, [sortField]);

  const sortKeywords = useCallback((keywords: any[]) => {
    return [...keywords].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'volume':
          aVal = getSearchVolume(a);
          bVal = getSearchVolume(b);
          break;
        case 'cpc':
          aVal = getCpc(a) || 0;
          bVal = getCpc(b) || 0;
          break;
        case 'competition':
          aVal = getCompetition(a);
          bVal = getCompetition(b);
          return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'keyword':
        default:
          aVal = getKeyword(a);
          bVal = getKeyword(b);
          return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [sortField, sortOrder]);

  // Saved keywords management
  const saveKeyword = useCallback(() => {
    if (!keywordToSave || !result) return;
    const newSaved: SavedKeyword = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      keyword: keywordToSave.keyword,
      searchVolume: keywordToSave.volume,
      competition: keywordToSave.competition,
      cpc: keywordToSave.cpc,
      savedAt: Date.now(),
      domain: result.target,
    };
    const updated = [newSaved, ...savedKeywords];
    setSavedKeywords(updated);
    localStorage.setItem(SAVED_KEYWORDS_KEY, JSON.stringify(updated));
    setShowSaveDialog(false);
    setKeywordToSave(null);
  }, [keywordToSave, savedKeywords, result]);

  const removeSavedKeyword = useCallback((id: string) => {
    const updated = savedKeywords.filter((item) => item.id !== id);
    setSavedKeywords(updated);
    localStorage.setItem(SAVED_KEYWORDS_KEY, JSON.stringify(updated));
  }, [savedKeywords]);

  const hasDataForSeo = Boolean(settings?.dataforseo_user && settings?.dataforseo_pass);
  const partialErrors = useMemo(
    () => Object.entries(result?.partialErrors || {}).filter(([, message]) => Boolean(message)),
    [result],
  );

  const handleLocationChange = (value: string) => {
    const code = Number(value);
    const match = locationOptions.find((item) => item.value === code);
    setLocationCode(code);
    if (match) setLanguageCode(match.language);
  };

  const runAnalysis = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/seo/advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          seedKeyword,
          includeAiVisibility,
          trackingKeywords: trackingKeywords
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
          locationCode,
          languageCode,
          limit,
          keywordMode,
          dataforseoUser: settings?.dataforseo_user,
          dataforseoPass: settings?.dataforseo_pass,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể phân tích SEO nâng cao');
      setResult(data);

      // Add to history
      addToHistory({
        domain,
        seedKeyword,
        locationCode,
        limit,
        includeAiVisibility,
        keywordMode,
      });
    } catch (err: any) {
      setError(err?.message || 'Có lỗi khi phân tích');
    } finally {
      setIsLoading(false);
    }
  };

  const exportCsv = (type: 'ranked' | 'ideas') => {
    if (!result) return;
    const rows = type === 'ranked' ? result.rankedKeywords : result.keywordIdeas;
    const blob = new Blob([buildCsv(rows, type)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.target}-${type}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="advanced-seo-theme flex flex-col gap-10 min-h-screen font-inter pb-20 overflow-x-hidden max-w-full min-w-0 box-border">
      <header className="flex justify-between items-end pb-10" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-6">
            <div className="p-3.5 rounded-2xl border shadow-[0_0_15px_rgba(34,211,238,0.3)]" style={{ backgroundColor: 'rgba(6,182,212,0.1)', borderColor: 'rgba(6,182,212,0.3)' }}>
              <BarChart3 className="text-cyan-400" size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none" style={{ color: 'var(--text-primary)' }}>
              SEO nâng cao
            </h1>
          </div>
          <div className="flex items-center gap-4 px-2">
            <div className="w-12 h-px bg-white/10" />
            <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest opacity-60">DOMAIN INSIGHT, RANK TRACKING, BACKLINK & TECHNICAL AUDIT.</p>
          </div>
        </div>

        <div className={`rounded-2xl px-5 py-4 flex items-center gap-3 border shrink-0 ${hasDataForSeo ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400'}`}>
          {hasDataForSeo ? <ShieldCheck size={18} /> : <KeyRound size={18} />}
          <span className="text-[10px] font-black uppercase tracking-widest">
            {hasDataForSeo ? 'DataForSEO sẵn sàng' : 'Thiếu DataForSEO'}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-8 flex-1 w-full max-w-full min-w-0 box-border">
        <div className="w-full">
          <div className="rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <div className="hidden">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Target size={18} />
              </div>
              <h2 className="text-sm font-black uppercase" style={{ color: 'var(--text-primary)' }}>Đầu vào phân tích</h2>
            </div>

            <div className="hidden xl:block absolute left-8 top-1/2 -translate-y-1/2 w-1 h-24 bg-cyan-500 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.6)]" />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start xl:pl-12">
              <label className="block relative">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Domain</span>
                <div className="relative mt-2">
                  <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={domain}
                    onChange={(event) => setDomain(event.target.value)}
                    placeholder="example.com"
                    className="w-full h-11 rounded-xl pl-11 pr-10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--text-primary)' }}
                  />
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    title="Lịch sử tìm kiếm"
                  >
                    <History size={14} />
                  </button>
                </div>
                <HistoryPanel
                  history={searchHistory}
                  onSelect={selectHistoryItem}
                  onRemove={removeFromHistory}
                  onClear={clearHistory}
                  isOpen={showHistory}
                  onClose={() => setShowHistory(false)}
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Keyword hạt giống</span>
                <div className="relative mt-2">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={seedKeyword}
                    onChange={(event) => setSeedKeyword(event.target.value)}
                    placeholder="dịch vụ seo"
                    className="w-full h-11 rounded-xl pl-11 pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--text-primary)' }}
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Chế độ keyword</span>
                <select
                  value={keywordMode}
                  onChange={(event) => setKeywordMode(event.target.value as KeywordMode)}
                  className="mt-2 w-full h-11 rounded-xl px-4 text-xs font-black focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--text-primary)' }}
                >
                  {keywordModes.map((mode) => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Thị trường</span>
                <select
                  value={locationCode}
                  onChange={(event) => handleLocationChange(event.target.value)}
                  className="mt-2 w-full h-11 rounded-xl px-4 text-xs font-black focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--text-primary)' }}
                >
                  {locationOptions.map((item) => (
                    <option key={`${item.label}-${item.value}`} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Số dòng</span>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={limit}
                  onChange={(event) => setLimit(Number(event.target.value))}
                  className="mt-2 w-full h-11 rounded-xl px-4 text-xs font-black focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--text-primary)' }}
                />
              </label>

              <label className="block md:col-span-2 xl:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Rank tracking nhanh</span>
                <textarea
                  value={trackingKeywords}
                  onChange={(event) => setTrackingKeywords(event.target.value)}
                  placeholder={'mỗi dòng 1 keyword\nthiết kế logo\nseo tổng thể'}
                  rows={3}
                  className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/30 resize-none"
                  style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--text-primary)' }}
                />
              </label>

              <div className="flex items-center gap-3 md:col-span-2 xl:col-span-2">
                <button
                  onClick={() => setIncludeAiVisibility((current) => !current)}
                  className="flex-1 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-left h-11"
                  style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(6,182,212,0.2)' }}
                  type="button"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">AI / LLM visibility</span>
                  <span className={`h-5 w-9 rounded-full p-0.5 transition-all ${includeAiVisibility ? 'bg-indigo-500' : 'bg-white/10'}`}>
                    <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${includeAiVisibility ? 'translate-x-4' : 'translate-x-0'}`} />
                  </span>
                </button>

                {savedKeywords.length > 0 && (
                  <button
                    onClick={() => {}}
                    className="h-11 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 whitespace-nowrap"
                    title={`${savedKeywords.length} keyword đã lưu`}
                  >
                    <Save size={14} />
                    <span className="hidden sm:inline">{savedKeywords.length}</span>
                  </button>
                )}

                {!hasDataForSeo ? (
                  <a href="/dashboard/settings" className="h-11 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 whitespace-nowrap">
                    Mở cấu hình
                    <ArrowRight size={14} />
                  </a>
                ) : (
                  <button
                    onClick={runAnalysis}
                    disabled={isLoading || !domain}
                    className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg whitespace-nowrap"
                    type="button"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                    {isLoading ? 'Đang phân tích' : 'Chạy SEO'}
                  </button>
                )}
              </div>

              {error && (
                <div className="rounded-xl p-3 border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-start gap-3 text-xs font-bold md:col-span-2 xl:col-span-4">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-full overflow-hidden flex flex-col min-w-0 max-w-full space-y-8">
          {!result ? (
            <div className="rounded-[2.5rem] min-h-[600px] flex items-center justify-center text-center p-10 shadow-2xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.2)' }}>
              <div>
                <div className="h-16 w-16 rounded-2xl mx-auto mb-5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <BarChart3 size={28} />
                </div>
                <h2 className="text-xl font-black uppercase" style={{ color: 'var(--text-primary)' }}>Bảng phân tích đang chờ dữ liệu</h2>
                <p className="mt-3 max-w-md text-sm font-bold leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Nhập domain, thêm keyword hạt giống nếu muốn xem SERP và keyword ideas, rồi chạy phân tích.
                </p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
              <SkeletonTable />
              <SkeletonTable />
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Organic Keywords" value={formatNumber(metricFromOverview(result.overview, 'count'))} icon={Search} tone="sky" />
                <StatCard label="Organic Traffic" value={formatNumber(metricFromOverview(result.overview, 'etv'))} icon={TrendingUp} tone="emerald" />
                <StatCard label="Backlinks" value={formatNumber(result.backlinks?.backlinks)} icon={Link2} tone="indigo" />
                <StatCard label="Rank Keyword" value={result.rankCheck.position ? `#${result.rankCheck.position}` : '--'} icon={Target} tone={result.rankCheck.position ? 'amber' : 'rose'} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="Audit nhanh" value={`${result.quickAudit?.score ?? 0}/100`} icon={Gauge} tone={(result.quickAudit?.score ?? 0) >= 75 ? 'emerald' : 'amber'} />
                <StatCard label="Referring Domains" value={formatNumber(result.backlinks?.referring_domains)} icon={Globe} tone="sky" />
                <StatCard label="Top Pages có link" value={formatNumber(result.domainPages?.length)} icon={ExternalLink} tone="indigo" />
              </div>

              {result.aiVisibility?.enabled && (
                <div className="rounded-3xl p-6" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.16)' }}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-black uppercase" style={{ color: 'var(--text-primary)' }}>AI / LLM visibility</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">DataForSEO AI Optimization</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard label="Google AI mentions" value={formatNumber(getAiMetric(result.aiVisibility.google, 'google', 'mentions'))} icon={Sparkles} tone="sky" />
                    <StatCard label="Google AI volume" value={formatNumber(getAiMetric(result.aiVisibility.google, 'google', 'ai_search_volume'))} icon={TrendingUp} tone="emerald" />
                    <StatCard label="ChatGPT mentions" value={formatNumber(getAiMetric(result.aiVisibility.chatGpt, 'chat_gpt', 'mentions'))} icon={Activity} tone="amber" />
                  </div>
                  <div className="mt-5">
                    <SimpleListTable
                      title="AI top cited pages"
                      rows={result.aiVisibility.googleTopPages || []}
                      columns={[
                        {
                          label: 'Page',
                          className: 'min-w-[260px]',
                          render: (row) => (
                            <span className="block max-w-[420px] truncate" style={{ color: 'var(--text-primary)' }}>{row.page || row.url || row.target || '--'}</span>
                          ),
                        },
                        {
                          label: 'Mentions',
                          render: (row) => <span className="text-emerald-400">{formatNumber(row.mentions)}</span>,
                        },
                        {
                          label: 'Volume',
                          render: (row) => <span style={{ color: 'var(--text-secondary)' }}>{formatNumber(row.ai_search_volume)}</span>,
                        },
                      ]}
                    />
                  </div>
                </div>
              )}

              {partialErrors.length > 0 && (
                <div className="rounded-2xl p-5 border border-amber-500/30 bg-amber-500/10">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-amber-300">Một vài nguồn trả lỗi nhưng phần còn lại vẫn dùng được</p>
                      <div className="mt-2 space-y-1">
                        {partialErrors.map(([key, message]) => (
                          <p key={key} className="text-xs font-bold text-amber-100/80">{key}: {message}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-3xl p-6" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.16)' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Domain</p>
                    <p className="mt-2 text-lg font-black" style={{ color: 'var(--text-primary)' }}>{result.target}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Backlink Rank</p>
                    <p className="mt-2 text-lg font-black text-cyan-300">{formatNumber(result.backlinks?.rank)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Chi phí DataForSEO</p>
                    <p className="mt-2 text-lg font-black text-emerald-300">${Number(result.totalCost || 0).toFixed(4)}</p>
                  </div>
                </div>

                {result.rankCheck.url && (
                  <a href={result.rankCheck.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-sky-400 hover:text-sky-300">
                    <ExternalLink size={15} />
                    URL đang rank cho keyword: {result.rankCheck.url}
                  </a>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={() => exportCsv('ranked')} className="px-4 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-cyan-300 hover:bg-indigo-500/20 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Download size={14} />
                  Xuất keyword đang rank
                </button>
                <button onClick={() => exportCsv('ideas')} className="px-4 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Download size={14} />
                  Xuáº¥t keyword ideas
                </button>
              </div>

              <SimpleListTable
                title="Rank tracking nhanh"
                rows={result.rankChecks || []}
                columns={[
                  {
                    label: 'Keyword',
                    className: 'min-w-[220px]',
                    render: (row) => <span style={{ color: 'var(--text-primary)' }}>{row.keyword}</span>,
                  },
                  {
                    label: 'Position',
                    render: (row) => <span className={row.position ? 'text-emerald-400' : 'text-rose-400'}>{row.position ? `#${row.position}` : 'Chưa thấy trong top 50'}</span>,
                  },
                  {
                    label: 'URL',
                    className: 'min-w-[280px]',
                    render: (row) => row.url ? (
                      <a href={row.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 max-w-[360px] truncate text-sky-400 hover:text-sky-300">
                        <ExternalLink size={12} />
                        <span className="truncate">{row.url}</span>
                      </a>
                    ) : <span style={{ color: 'var(--text-muted)' }}>--</span>,
                  },
                ]}
              />

              <div className="rounded-3xl p-6" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.16)' }}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-black uppercase" style={{ color: 'var(--text-primary)' }}>Site Technical Audit</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Lighthouse Score</span>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-start gap-6 mb-6">
                  <div className="flex items-center gap-5">
                    <AuditGauge score={result.quickAudit?.score ?? 0} size={100} />
                    <div>
                      <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
                        {result.quickAudit?.score ?? 0 >= 90 ? 'Xuất sắc' : result.quickAudit?.score ?? 0 >= 70 ? 'Tốt' : result.quickAudit?.score ?? 0 >= 50 ? 'Cần cải thiện' : 'Kém'}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {result.quickAudit?.score ?? 0 >= 90 ? 'Trang web được tối ưu tốt' : result.quickAudit?.score ?? 0 >= 70 ? 'Cần một số cải thiện nhỏ' : 'Nhiều vấn đề cần khắc phục'}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-wrap gap-2">
                    {(['fail', 'warn', 'pass'] as const).map((status) => {
                      const count = (result.quickAudit?.issues || []).filter((i: any) => i.status === status).length;
                      if (count === 0) return null;
                      return <AuditCategoryBadge key={status} status={status} count={count} />;
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(result.quickAudit?.issues || []).map((issue: any) => (
                    <div key={issue.label} className="rounded-2xl p-4 flex items-start gap-3" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}>
                      <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${issue.status === 'pass' ? 'bg-emerald-400' : issue.status === 'warn' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black uppercase" style={{ color: 'var(--text-primary)' }}>{issue.label}</p>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${issue.status === 'pass' ? 'bg-emerald-500/20 text-emerald-400' : issue.status === 'warn' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {issue.status === 'pass' ? 'PASS' : issue.status === 'warn' ? 'WARN' : 'FAIL'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-bold break-words" style={{ color: 'var(--text-secondary)' }}>{issue.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SERP Features Detection */}
              {result.serp && result.serp.length > 0 && (
                <div className="rounded-3xl p-6" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.16)' }}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-black uppercase" style={{ color: 'var(--text-primary)' }}>SERP Features</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                      {result.serp.filter((item: any) => item.type !== 'organic').length} features
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(result.serp.map((item: any) => item.type).filter((t: string) => t !== 'organic'))).map((featureType: string) => {
                      const count = result.serp.filter((item: any) => item.type === featureType).length;
                      const featureConfig: Record<string, { icon: string; color: string }> = {
                        featured_snippet: { icon: 'Star', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                        people_also_ask: { icon: 'HelpCircle', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
                        video: { icon: 'Play', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
                        images: { icon: 'Image', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                        local_pack: { icon: 'MapPin', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
                        knowledge_graph: { icon: 'Brain', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
                        related_searches: { icon: 'Search', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
                      };
                      const config = featureConfig[featureType] || { icon: 'Zap', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' };
                      return (
                        <div key={featureType} className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${config.color}`}>
                          <span>{featureType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <SortControls
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSortChange={handleSortChange}
                />
              </div>

              <DataTable
                title="Keyword domain đang rank"
                rows={sortKeywords(result.rankedKeywords || [])}
                type="ranked"
                onSaveKeyword={(kw, vol, comp, cpc) => {
                  setKeywordToSave({ keyword: kw, volume: vol, competition: comp, cpc });
                  setShowSaveDialog(true);
                }}
              />
              <DataTable
                title="Keyword ideas từ seed"
                rows={sortKeywords(result.keywordIdeas || [])}
                type="ideas"
                onSaveKeyword={(kw, vol, comp, cpc) => {
                  setKeywordToSave({ keyword: kw, volume: vol, competition: comp, cpc });
                  setShowSaveDialog(true);
                }}
              />

              <SimpleListTable
                title="Backlink chi tiết"
                rows={result.backlinkRows || []}
                columns={[
                  {
                    label: 'Nguồn',
                    className: 'min-w-[260px]',
                    render: (row) => row.url_from ? (
                      <a href={row.url_from} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 max-w-[360px] truncate text-sky-400 hover:text-sky-300">
                        <ExternalLink size={12} />
                        <span className="truncate">{row.url_from}</span>
                      </a>
                    ) : <span style={{ color: 'var(--text-muted)' }}>--</span>,
                  },
                  {
                    label: 'Đích',
                    className: 'min-w-[220px]',
                    render: (row) => <span className="block max-w-[320px] truncate" style={{ color: 'var(--text-secondary)' }}>{row.url_to || '--'}</span>,
                  },
                  {
                    label: 'Rank',
                    render: (row) => <span className="text-emerald-400">{formatNumber(row.rank)}</span>,
                  },
                  {
                    label: 'Anchor',
                    render: (row) => <span style={{ color: 'var(--text-secondary)' }}>{row.anchor || '--'}</span>,
                  },
                ]}
              />

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <SimpleListTable
                  title="Referring domains"
                  rows={result.referringDomains || []}
                  columns={[
                    {
                      label: 'Domain',
                      className: 'min-w-[180px]',
                      render: (row) => <span style={{ color: 'var(--text-primary)' }}>{row.domain || row.referring_domain || '--'}</span>,
                    },
                    {
                      label: 'Backlinks',
                      render: (row) => <span className="text-emerald-400">{formatNumber(row.backlinks)}</span>,
                    },
                    {
                      label: 'Rank',
                      render: (row) => <span style={{ color: 'var(--text-secondary)' }}>{formatNumber(row.rank)}</span>,
                    },
                  ]}
                />

                <SimpleListTable
                  title="Top linked pages"
                  rows={result.domainPages || []}
                  columns={[
                    {
                      label: 'Page',
                      className: 'min-w-[240px]',
                      render: (row) => (
                        <span className="block max-w-[360px] truncate" style={{ color: 'var(--text-primary)' }}>{row.page || row.url || '--'}</span>
                      ),
                    },
                    {
                      label: 'Backlinks',
                      render: (row) => <span className="text-emerald-400">{formatNumber(row.backlinks)}</span>,
                    },
                    {
                      label: 'Domains',
                      render: (row) => <span style={{ color: 'var(--text-secondary)' }}>{formatNumber(row.referring_domains)}</span>,
                    },
                  ]}
                />
              </div>

              <div className="rounded-3xl p-6" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.16)' }}>
                <h3 className="text-sm font-black uppercase mb-5" style={{ color: 'var(--text-primary)' }}>SERP top kết quả</h3>
                <div className="space-y-3">
                  {(result.serp || []).filter((item) => item.type === 'organic').slice(0, 8).map((item, index) => (
                    <div key={`${item.url}-${index}`} className="rounded-2xl p-4 flex items-start gap-4" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}>
                      <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-cyan-300 flex items-center justify-center text-xs font-black">#{item.rank_absolute || index + 1}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black truncate" style={{ color: 'var(--text-primary)' }}>{item.title || item.domain}</p>
                        <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-bold text-sky-400 truncate">{item.url}</a>
                        <p className="mt-2 text-xs font-medium line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <SaveKeywordDialog
        keyword={keywordToSave}
        isOpen={showSaveDialog}
        onClose={() => {
          setShowSaveDialog(false);
          setKeywordToSave(null);
        }}
        onSave={saveKeyword}
      />
    </div>
  );
}



