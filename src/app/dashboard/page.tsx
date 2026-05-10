'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  ChevronRight,
  Download,
  FileText,
  Image as ImageIcon,
  Key,
  MapPin,
  Search,
  Settings,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import Card from '@/shared/ui/Card';
import Typography from '@/shared/ui/Typography';
import { getMetrics, AppMetrics } from '@/shared/utils/metrics';
import * as XLSX from 'xlsx';

const TOOL_LABELS: Record<string, string> = {
  content: 'Viết bài AI',
  keywords: 'Từ khóa',
  images: 'Tìm hình ảnh',
  maps: 'Quét Bản đồ',
  scraper: 'Kiểm tra website',
};

const API_PROVIDER_LABELS: Record<string, string> = {
  OpenAI: 'OpenAI',
  Gemini: 'Gemini',
  Claude: 'Claude',
  Groq: 'Groq',
  SerpAPI: 'SerpAPI',
  DataForSEO: 'DataForSEO',
  Maps: 'Maps',
  Outscraper: 'Outscraper',
  Custom: 'Khác',
};

const QUICK_TOOLS = [
  {
    href: '/dashboard/keywords',
    title: 'Phân tích từ khóa',
    hint: 'Volume, nhóm cụm, ý tưởng nội dung',
    icon: Key,
    accent: 'from-emerald-500/90 to-teal-600/80',
  },
  {
    href: '/dashboard/content',
    title: 'Viết bài AI',
    hint: 'Research, outline, bulk & đa nền tảng',
    icon: FileText,
    accent: 'from-indigo-500/90 to-violet-600/80',
  },
  {
    href: '/dashboard/maps',
    title: 'Quét bản đồ',
    hint: 'Thu thập địa điểm & đối thủ địa phương',
    icon: MapPin,
    accent: 'from-sky-500/90 to-blue-600/80',
  },
  {
    href: '/dashboard/seo-tools',
    title: 'Bộ công cụ SEO',
    hint: '50+ tiện ích GSC, entity, technical…',
    icon: Search,
    accent: 'from-amber-500/90 to-orange-600/80',
  },
  {
    href: '/dashboard/seo-tools/scraper',
    title: 'Kiểm tra website',
    hint: 'On-page, heading tree, liên kết',
    icon: Stethoscope,
    accent: 'from-rose-500/90 to-red-600/80',
  },
  {
    href: '/dashboard/images',
    title: 'Tìm hình ảnh',
    hint: 'Gợi ý visual phục vụ nội dung',
    icon: ImageIcon,
    accent: 'from-fuchsia-500/90 to-pink-600/80',
  },
  {
    href: '/dashboard/job-support',
    title: 'Hỗ trợ tìm việc',
    hint: 'CV, JD và đơn ứng tuyển',
    icon: BriefcaseBusiness,
    accent: 'from-cyan-500/90 to-indigo-600/80',
  },
  {
    href: '/dashboard/settings',
    title: 'Cấu hình API',
    hint: 'Khóa model & nhà cung cấp',
    icon: Settings,
    accent: 'from-slate-500/80 to-slate-700/80',
  },
] as const;

const BAR_PALETTE = ['bg-indigo-500', 'bg-violet-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500'];

function formatRelativeVi(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<AppMetrics | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [nowLabel, setNowLabel] = useState<string>('');

  useEffect(() => {
    setMetrics(getMetrics());
    const tick = () => {
      const d = new Date();
      setNowLabel(
        d.toLocaleDateString('vi-VN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      );
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const totals = useMemo(() => {
    if (!metrics) return null;
    const toolTotal = Object.values(metrics.tool_usage).reduce((a, b) => a + (b || 0), 0);
    const apiTotal = Object.values(metrics.api_calls).reduce((a, b) => a + (b || 0), 0);
    const historyCount = metrics.history?.length ?? 0;
    return { toolTotal, apiTotal, historyCount, exported: metrics.files_exported };
  }, [metrics]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'Chào buổi sáng';
    if (hour >= 11 && hour < 14) return 'Chào buổi trưa';
    if (hour >= 14 && hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }, []);

  const sortedToolUsage = useMemo(() => {
    if (!metrics) return [];
    return (Object.entries(metrics.tool_usage) as [string, number][])
      .map(([key, val]) => ({ key, val, label: TOOL_LABELS[key] ?? key }))
      .sort((a, b) => b.val - a.val);
  }, [metrics]);

  const topProviders = useMemo(() => {
    if (!metrics || !totals?.apiTotal) return [];
    return (Object.entries(metrics.api_calls) as [string, number][])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [metrics, totals?.apiTotal]);

  const recentHistory = useMemo(() => metrics?.history?.slice(0, 8) ?? [], [metrics?.history]);

  const handleExportHistory = () => {
    if (!metrics?.history?.length) return;
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      const toolData = Object.entries(metrics.tool_usage).map(([tool, val]) => ({
        'Công cụ': TOOL_LABELS[tool] ?? tool,
        'Số lượt': val,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toolData), 'Công cụ');

      if (totals && totals.apiTotal > 0) {
        const apiData = Object.entries(metrics.api_calls).map(([key, val]) => ({
          'Nhà cung cấp': API_PROVIDER_LABELS[key] ?? key,
          'Số lần gọi': val,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(apiData), 'API');
      }

      const historyData = metrics.history.map((h) => ({
        'Thời gian': new Date(h.timestamp).toLocaleString('vi-VN'),
        'Công cụ': h.tool,
        'Hành động': h.action,
        'Chi tiết': h.details,
        'Trạng thái': h.status,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(historyData), 'Nhật ký');

      XLSX.writeFile(wb, `OmniSuite_nhat_ky_${new Date().getTime()}.xlsx`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!metrics || !totals) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <Activity size={48} className="text-indigo-500/20 animate-pulse" />
        <p className="font-semibold text-sm tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Đang tải tổng quan…
        </p>
      </div>
    );
  }

  const maxToolVal = Math.max(...sortedToolUsage.map((t) => t.val), 1);

  return (
    <div className="space-y-12 pb-8 max-w-6xl mx-auto">
      {/* Hero: điều hướng + ngữ cảnh */}
      <header className="relative overflow-hidden rounded-3xl border p-8 sm:p-10 shadow-xl shadow-indigo-950/10" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider" style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
              <Sparkles size={14} className="text-indigo-400 shrink-0" />
              Trung tâm làm việc
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight" style={{ color: 'var(--text-primary)' }}>
              {greeting}
            </h1>
            <p className="text-base leading-relaxed font-medium" style={{ color: 'var(--text-secondary)' }}>
              Bắt đầu từ công cụ bạn cần — OmniSuite ghi lại lượt dùng, file xuất và nhật ký để bạn theo dõi tiến độ trong phiên này.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/dashboard/content"
                prefetch={false}
                onPointerEnter={() => router.prefetch('/dashboard/content')}
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-lg shadow-indigo-500/25 transition hover:opacity-95"
                style={{ backgroundColor: '#6366f1', color: '#fff' }}
              >
                Viết bài AI
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/dashboard/seo-tools"
                prefetch={false}
                onPointerEnter={() => router.prefetch('/dashboard/seo-tools')}
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition hover:opacity-90"
                style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                Mở bộ SEO
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-3 text-left lg:text-right shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Hôm nay
            </p>
            <p className="text-lg font-medium capitalize leading-snug max-w-xs lg:ml-auto" style={{ color: 'var(--text-primary)' }}>
              {nowLabel || '—'}
            </p>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {[
                { label: 'Lượt công cụ', value: totals.toolTotal },
                { label: 'File xuất', value: totals.exported },
                { label: 'Nhật ký', value: totals.historyCount },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl px-3 py-2 min-w-[6.5rem]"
                  style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    {s.label}
                  </p>
                  <p className="text-xl font-bold tabular-nums leading-tight mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
            {totals.apiTotal > 0 && (
              <p className="text-xs font-medium lg:text-right" style={{ color: 'var(--text-muted)' }}>
                Đã gọi API tổng cộng{' '}
                <span className="tabular-nums font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {totals.apiTotal}
                </span>{' '}
                lần trong thống kê cục bộ.
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Lối tắt — công dụng chính của trang */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Typography variant="h3" className="font-bold text-lg tracking-tight mb-0" style={{ color: 'var(--text-primary)' }}>
            Lối tắt công cụ
          </Typography>
          <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Chọn một mục để vào thẳng chức năng
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_TOOLS.map((item, i) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onPointerEnter={() => router.prefetch(item.href)}
                className="group block h-full"
              >
                <Card
                  className="h-full p-5 rounded-2xl flex flex-col gap-3 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10"
                  delay={i * 0.03}
                  style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
                >
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${item.accent} text-white shadow-md`}>
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="font-semibold text-[15px] leading-snug flex items-center gap-1 group-hover:text-indigo-400 transition-colors" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                      <ChevronRight size={16} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0 text-indigo-400" />
                    </p>
                    <p className="text-[13px] leading-snug font-medium line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                      {item.hint}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {topProviders.length > 0 && (
        <section className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>
            API dùng nhiều
          </span>
          {topProviders.map(([key, val]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tabular-nums"
              style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            >
              {API_PROVIDER_LABELS[key] ?? key}
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {val}
              </span>
            </span>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Phân bổ lượt dùng — gọn, có ý nghĩa */}
        <div className="lg:col-span-2 space-y-4">
          <Typography variant="h3" className="font-bold text-lg tracking-tight mb-0" style={{ color: 'var(--text-primary)' }}>
            Bạn dùng công cụ nào nhiều nhất
          </Typography>
          <Card className="p-6 rounded-2xl space-y-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            {sortedToolUsage.every((t) => t.val === 0) ? (
              <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Chưa có dữ liệu. Hãy mở một công cụ bất kỳ — OmniSuite sẽ hiển thị tỷ lệ tương đối tại đây.
              </p>
            ) : (
              sortedToolUsage.map((row, i) => (
                <div key={row.key} className="space-y-2">
                  <div className="flex justify-between items-baseline gap-2 text-sm">
                    <span className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {row.label}
                    </span>
                    <span className="tabular-nums font-medium shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {row.val} lượt
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--hover-bg)' }}>
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${BAR_PALETTE[i % BAR_PALETTE.length]}`}
                      style={{ width: `${(row.val / maxToolVal) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        {/* Nhật ký gần đây */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Typography variant="h3" className="font-bold text-lg tracking-tight mb-0" style={{ color: 'var(--text-primary)' }}>
              Hoạt động gần đây
            </Typography>
            <button
              type="button"
              onClick={handleExportHistory}
              disabled={!metrics.history?.length || isExporting}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition hover:opacity-85 disabled:opacity-40 disabled:pointer-events-none shrink-0"
              style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            >
              <Download size={14} />
              {isExporting ? 'Đang xuất…' : 'Xuất Excel'}
            </button>
          </div>
          <Card className="p-0 rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            {recentHistory.length > 0 ? (
              <ul className="divide-y max-h-[min(28rem,70vh)] overflow-y-auto custom-scrollbar-indigo" style={{ borderColor: 'var(--border-color)' }}>
                {recentHistory.map((h, i) => {
                  const statusDot =
                    h.status === 'failed' ? 'bg-rose-500' : h.status === 'info' ? 'bg-amber-400' : 'bg-emerald-500';
                  return (
                    <li key={h.id || i} className="flex gap-4 p-4 sm:p-5 hover:bg-white/[0.02] transition-colors">
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${statusDot}`} aria-hidden />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md" style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                            {h.tool}
                          </span>
                          <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
                            {formatRelativeVi(h.timestamp)}
                          </span>
                        </div>
                        <p className="font-semibold text-sm leading-snug break-words" style={{ color: 'var(--text-primary)' }}>
                          {h.action}
                        </p>
                        {h.details ? (
                          <p className="text-xs leading-relaxed line-clamp-2 font-medium" style={{ color: 'var(--text-muted)' }}>
                            {h.details}
                          </p>
                        ) : null}
                      </div>
                      <time className="hidden sm:block text-[11px] font-mono tabular-nums shrink-0 pt-0.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {new Date(h.timestamp).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </time>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4">
                <Activity size={40} className="opacity-25 text-indigo-400" />
                <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Chưa có hoạt động ghi nhận
                </p>
                <p className="text-sm font-medium max-w-sm" style={{ color: 'var(--text-muted)' }}>
                  Khi bạn chạy từ khóa, viết bài hoặc SEO tools, các bước quan trọng sẽ hiện ở đây để tiếp tục công việc cho đồng bộ.
                </p>
                <Link
                  href="/dashboard/content"
                  prefetch={false}
                  onPointerEnter={() => router.prefetch('/dashboard/content')}
                  className="text-sm font-semibold text-indigo-400 hover:underline"
                >
                  Bắt đầu với Viết bài AI
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
