'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Key,
  MapPin,
  Search,
  Image as ImageIcon,
  Sparkles,
  Stethoscope,
  BarChart,
  Settings,
  Activity,
  Download,
  RotateCcw,
  ArrowRight,
  Zap,
} from 'lucide-react';
import Card from '@/shared/ui/Card';
import Typography from '@/shared/ui/Typography';
import Button from '@/shared/ui/Button';
import {
  getMetrics,
  resetMetrics,
  type AppMetrics,
  type HistoryItem,
} from '@/shared/utils/metrics';

const QUICK_TOOLS = [
  { name: 'Phân tích Từ khóa', href: '/dashboard/keywords', icon: Key, color: 'text-indigo-400' },
  { name: 'Viết bài AI', href: '/dashboard/content', icon: FileText, color: 'text-violet-400' },
  { name: 'Quét bản đồ', href: '/dashboard/maps', icon: MapPin, color: 'text-fuchsia-400' },
  { name: 'Bộ công cụ SEO', href: '/dashboard/seo-tools', icon: Search, color: 'text-sky-400' },
  { name: 'Kiểm tra website', href: '/dashboard/seo-tools/scraper', icon: Stethoscope, color: 'text-emerald-400' },
  { name: 'SEO nâng cao', href: '/dashboard/seo-tools/advanced', icon: BarChart, color: 'text-amber-400' },
  { name: 'Tìm hình ảnh', href: '/dashboard/images', icon: ImageIcon, color: 'text-pink-400' },
  { name: 'Quản gia', href: '/dashboard/ai-support', icon: Sparkles, color: 'text-cyan-400' },
];

const TOOL_LABELS: Record<keyof AppMetrics['tool_usage'], string> = {
  content: 'Viết bài AI',
  keywords: 'Từ khóa',
  images: 'Hình ảnh',
  maps: 'Quét bản đồ',
  scraper: 'Kiểm tra web',
};

function statusColor(status: HistoryItem['status']) {
  if (status === 'success') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (status === 'failed') return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<AppMetrics | null>(null);

  const refreshMetrics = () => setMetrics(getMetrics());

  useEffect(() => {
    refreshMetrics();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'omnisuite_metrics') refreshMetrics();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const totalApiCalls = useMemo(() => {
    if (!metrics) return 0;
    return Object.values(metrics.api_calls).reduce((a, b) => a + b, 0);
  }, [metrics]);

  const totalToolRuns = useMemo(() => {
    if (!metrics) return 0;
    return Object.values(metrics.tool_usage).reduce((a, b) => a + b, 0);
  }, [metrics]);

  const topApiProviders = useMemo(() => {
    if (!metrics) return [];
    return Object.entries(metrics.api_calls)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [metrics]);

  const handleReset = () => {
    if (!window.confirm('Xóa toàn bộ thống kê và lịch sử trên máy này?')) return;
    resetMetrics();
    refreshMetrics();
  };

  const handleExport = async () => {
    if (!metrics) return;
    try {
      const res = await fetch('/api/metrics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OmniSuite_Metrics_${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Không xuất được file thống kê.');
    }
  };

  return (
    <div className="flex flex-col gap-10 min-h-screen font-inter">
      <header className="flex flex-wrap justify-between items-end gap-6 pb-10" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-6">
            <div
              className="p-3.5 rounded-2xl border shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              style={{ backgroundColor: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.3)' }}
            >
              <LayoutDashboard className="text-indigo-400" size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none" style={{ color: 'var(--text-primary)' }}>
              Tổng quan
            </h1>
          </div>
          <p className="text-xs font-semibold max-w-xl" style={{ color: 'var(--text-muted)' }}>
            Theo dõi lượt dùng công cụ, cuộc gọi API và lịch sử thao tác gần đây trên máy của bạn.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" leftIcon={<RotateCcw size={16} />} onClick={refreshMetrics}>
            Làm mới
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<Download size={16} />} onClick={handleExport} disabled={!metrics}>
            Xuất Excel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Settings size={16} />}
            onClick={() => router.push('/dashboard/settings')}
          >
            Cấu hình
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Lượt dùng công cụ', value: totalToolRuns, icon: Activity, accent: 'text-indigo-400' },
          { label: 'Cuộc gọi API', value: totalApiCalls, icon: Zap, accent: 'text-amber-400' },
          { label: 'File đã xuất', value: metrics?.files_exported ?? 0, icon: Download, accent: 'text-emerald-400' },
          { label: 'Mục lịch sử', value: metrics?.history?.length ?? 0, icon: LayoutDashboard, accent: 'text-fuchsia-400' },
        ].map((stat) => (
          <Card key={stat.label} className="p-6 rounded-2xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }} animate={false}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {stat.label}
              </span>
              <stat.icon size={16} className={stat.accent} />
            </div>
            <div className={`text-3xl font-black ${stat.accent}`}>{stat.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 xl:col-span-5 space-y-8">
          <Card className="p-8 rounded-3xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }} animate={false}>
            <Typography variant="h3" className="mb-6 uppercase tracking-widest text-sm" style={{ color: 'var(--text-primary)' }}>
              Truy cập nhanh
            </Typography>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {QUICK_TOOLS.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="flex items-center justify-between p-4 rounded-2xl border transition-all hover:border-indigo-500/40 group"
                  style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <tool.icon size={18} className={tool.color} />
                    <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {tool.name}
                    </span>
                  </div>
                  <ArrowRight size={14} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" style={{ color: 'var(--text-muted)' }} />
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-8 rounded-3xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }} animate={false}>
            <Typography variant="h3" className="mb-6 uppercase tracking-widest text-sm" style={{ color: 'var(--text-primary)' }}>
              Dùng theo công cụ
            </Typography>
            <div className="space-y-3">
              {(Object.entries(TOOL_LABELS) as [keyof AppMetrics['tool_usage'], string][]).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span className="font-black text-indigo-400">{metrics?.tool_usage[key] ?? 0}</span>
                </div>
              ))}
            </div>
            {topApiProviders.length > 0 && (
              <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                  API nhiều nhất
                </p>
                <div className="space-y-2">
                  {topApiProviders.map(([name, count]) => (
                    <div key={name} className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
                      <span className="font-bold text-amber-400">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-7">
          <Card className="p-8 rounded-3xl min-h-[420px] flex flex-col" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }} animate={false}>
            <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
              <Typography variant="h3" className="mb-0 uppercase tracking-widest text-sm" style={{ color: 'var(--text-primary)' }}>
                Lịch sử gần đây
              </Typography>
              <button
                type="button"
                onClick={handleReset}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors hover:border-rose-500/40 text-rose-400"
                style={{ borderColor: 'var(--border-color)' }}
              >
                Xóa thống kê
              </button>
            </div>

            {!metrics?.history?.length ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16 gap-4">
                <Activity size={48} className="opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Chưa có hoạt động nào được ghi nhận.
                </p>
                <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
                  Khi bạn dùng Viết bài, Từ khóa, Quét bản đồ hoặc các công cụ khác, lịch sử sẽ hiện tại đây.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto custom-scrollbar-indigo space-y-2 pr-1">
                {metrics.history.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-3 p-4 rounded-2xl border"
                    style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-black uppercase" style={{ color: 'var(--text-primary)' }}>
                          {item.tool}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${statusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                        {item.action}
                      </p>
                      {item.details && (
                        <p className="text-[11px] mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                          {item.details}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
