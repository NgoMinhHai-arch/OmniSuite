'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Database,
  Key,
  RefreshCw,
  Server,
  Settings,
  Terminal,
  Wrench,
  XCircle,
} from 'lucide-react';

type ServiceStatus = {
  id: string;
  label?: string;
  port?: number;
  required?: boolean;
  managedBy?: string;
  healthUrl?: string;
  group?: string;
  status: string;
  httpStatus?: number;
  message?: string;
};

type RuntimeStatus = {
  ok: boolean;
  app?: {
    name?: string;
    mode?: string;
    dashboardUrl?: string;
  };
  contractVersion?: number;
  commands?: Record<string, string>;
  setup?: {
    state?: {
      updatedAt?: string;
      signature?: string;
      nodeReady?: boolean;
      pythonReady?: boolean;
      playwrightReady?: boolean;
    } | null;
    signatureFiles?: string[];
  };
  services?: ServiceStatus[];
  requiredDown?: ServiceStatus[];
  generatedAt?: string;
};

type StatusPayload = {
  merged?: Record<string, boolean>;
  envOnly?: Record<string, boolean>;
  runtime?: RuntimeStatus;
};

type StatusTone = 'good' | 'warn' | 'bad' | 'neutral';

const API_KEYS: Array<{ key: string; label: string; group: string }> = [
  { key: 'openai_api_key', label: 'OpenAI', group: 'AI' },
  { key: 'gemini_api_key', label: 'Gemini', group: 'AI' },
  { key: 'claude_api_key', label: 'Claude', group: 'AI' },
  { key: 'groq_api_key', label: 'Groq', group: 'AI' },
  { key: 'deepseek_api_key', label: 'DeepSeek', group: 'AI' },
  { key: 'openrouter_api_key', label: 'OpenRouter', group: 'AI' },
  { key: 'ollama_base_url', label: 'Ollama URL', group: 'Local AI' },
  { key: 'ninerouter_api_key', label: '9Router', group: 'AI Proxy' },
  { key: 'serpapi_key', label: 'SerpApi', group: 'SEO Data' },
  { key: 'dataforseo_user', label: 'DataForSEO User', group: 'SEO Data' },
  { key: 'dataforseo_pass', label: 'DataForSEO Pass', group: 'SEO Data' },
  { key: 'google_maps_api_key', label: 'Google Maps', group: 'Maps' },
  { key: 'gsc_service_account_key', label: 'GSC Service Account', group: 'Search Console' },
  { key: 'gsc_property_uri', label: 'GSC Property', group: 'Search Console' },
];

function statusTone(status?: string): StatusTone {
  if (status === 'online' || status === 'managed') return 'good';
  if (status === 'degraded' || status === 'optional-offline' || status === 'unknown') return 'warn';
  if (status === 'offline') return 'bad';
  return 'neutral';
}

function toneClass(tone: StatusTone) {
  if (tone === 'good') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400';
  if (tone === 'warn') return 'border-amber-500/25 bg-amber-500/10 text-amber-400';
  if (tone === 'bad') return 'border-rose-500/25 bg-rose-500/10 text-rose-400';
  return 'border-slate-500/25 bg-slate-500/10 text-slate-400';
}

function statusLabel(status?: string) {
  switch (status) {
    case 'online':
      return 'Online';
    case 'managed':
      return 'Managed';
    case 'degraded':
      return 'Degraded';
    case 'optional-offline':
      return 'Optional offline';
    case 'offline':
      return 'Offline';
    case 'unknown':
      return 'Unknown';
    default:
      return 'Pending';
  }
}

function shortDate(value?: string) {
  if (!value) return 'Chưa có';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[2rem] border p-6 shadow-2xl shadow-black/10 ${className}`}
      style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'var(--border-color)' }}
    >
      {children}
    </div>
  );
}

function Badge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest ${toneClass(tone)}`}>
      {children}
    </span>
  );
}

function CommandButton({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="group flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-all hover:bg-white/5 active:scale-[0.99]"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}
    >
      <code className="min-w-0 truncate text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
        {command}
      </code>
      <span className="flex shrink-0 items-center gap-2 text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        <Clipboard size={14} />
        {copied ? 'Đã copy' : 'Copy'}
      </span>
    </button>
  );
}

export default function SystemHealthPage() {
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let keys: Record<string, unknown> = {};
      try {
        keys = JSON.parse(localStorage.getItem('omnisuite_settings') || '{}');
      } catch {
        keys = {};
      }

      const res = await fetch('/api/system/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as StatusPayload;
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đọc được trạng thái hệ thống');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const runtime = payload?.runtime;
  const services = runtime?.services || [];
  const requiredDown = runtime?.requiredDown || [];
  const commands = runtime?.commands || {};
  const setupState = runtime?.setup?.state || null;

  const readyCount = services.filter((service) => service.status === 'online' || service.status === 'managed').length;
  const keyCount = useMemo(() => {
    const merged = payload?.merged || {};
    return API_KEYS.filter((item) => merged[item.key]).length;
  }, [payload?.merged]);

  const overallTone: StatusTone = !runtime ? 'neutral' : runtime.ok ? 'good' : 'bad';
  const overallLabel = !runtime ? 'Đang kiểm tra' : runtime.ok ? 'Sẵn sàng' : 'Cần sửa';

  return (
    <main className="min-h-screen p-6 lg:p-10" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)', backgroundColor: 'var(--hover-bg)' }}>
              <Activity size={14} />
              System Readiness Center
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight lg:text-5xl" style={{ color: 'var(--text-primary)' }}>
                Trạng thái hệ thống
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                Một chỗ để xem OmniSuite đang thiếu gì, service nào đang sống, API key nào đã cấu hình, và nên chạy lệnh nào để sửa. Cuối cùng cũng có một bảng điện, thay vì nghe tiếng nổ rồi đoán cầu chì nào cháy.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadStatus}
              className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-[12px] font-black uppercase tracking-widest transition-all hover:bg-white/5 active:scale-[0.99]"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', backgroundColor: 'var(--sidebar-bg)' }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-[12px] font-black uppercase tracking-widest transition-all hover:bg-white/5 active:scale-[0.99]"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', backgroundColor: 'var(--sidebar-bg)' }}
            >
              <Settings size={16} />
              Cấu hình
            </Link>
          </div>
        </div>

        {error && (
          <Card className="border-rose-500/30 bg-rose-500/10">
            <div className="flex items-start gap-4">
              <XCircle className="mt-1 text-rose-400" size={22} />
              <div>
                <h2 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>Không đọc được trạng thái</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
                <div className="mt-4 max-w-md">
                  <CommandButton command="GO.cmd --repair" />
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>Tổng trạng thái</p>
                <h2 className="mt-3 text-3xl font-black" style={{ color: 'var(--text-primary)' }}>{overallLabel}</h2>
              </div>
              <Badge tone={overallTone}>{overallLabel}</Badge>
            </div>
          </Card>

          <Card>
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>Services sẵn sàng</p>
            <h2 className="mt-3 text-3xl font-black" style={{ color: 'var(--text-primary)' }}>{readyCount}/{services.length || 0}</h2>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Online hoặc managed</p>
          </Card>

          <Card>
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>Required down</p>
            <h2 className="mt-3 text-3xl font-black" style={{ color: requiredDown.length ? '#fb7185' : 'var(--text-primary)' }}>{requiredDown.length}</h2>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Service bắt buộc đang chết</p>
          </Card>

          <Card>
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>API keys</p>
            <h2 className="mt-3 text-3xl font-black" style={{ color: 'var(--text-primary)' }}>{keyCount}/{API_KEYS.length}</h2>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Tính cả key trong Settings</p>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <Card>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Server className="text-indigo-400" size={22} />
                <div>
                  <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Dịch vụ runtime</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Lấy từ config/omnisuite.system.json</p>
                </div>
              </div>
              {runtime?.generatedAt && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cập nhật: {shortDate(runtime.generatedAt)}</p>}
            </div>

            <div className="space-y-3">
              {services.length === 0 && (
                <div className="rounded-2xl border p-5 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'var(--hover-bg)' }}>
                  Chưa có dữ liệu service. Có thể Next.js chưa đọc được contract hoặc API đang lỗi.
                </div>
              )}

              {services.map((service) => {
                const tone = statusTone(service.status);
                const Icon = tone === 'good' ? CheckCircle2 : tone === 'bad' ? XCircle : AlertCircle;
                return (
                  <div key={service.id} className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-4">
                        <Icon className={tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-rose-400' : 'text-amber-400'} size={22} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black" style={{ color: 'var(--text-primary)' }}>{service.label || service.id}</h3>
                            {service.required && <Badge tone="bad">Required</Badge>}
                            {!service.required && <Badge tone="neutral">Optional</Badge>}
                          </div>
                          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {service.id}{service.port ? ` · port ${service.port}` : ''}{service.group ? ` · ${service.group}` : ''}
                          </p>
                          {service.message && <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{service.message}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Badge tone={tone}>{statusLabel(service.status)}</Badge>
                        {typeof service.httpStatus === 'number' && <Badge tone="neutral">HTTP {service.httpStatus}</Badge>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <div className="mb-5 flex items-center gap-3">
                <Terminal className="text-indigo-400" size={22} />
                <div>
                  <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Lệnh sửa nhanh</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Copy rồi chạy ở repo root</p>
                </div>
              </div>
              <div className="space-y-3">
                <CommandButton command={commands.repair || 'GO.cmd --repair'} />
                <CommandButton command={commands.repairNpm || 'npm run repair'} />
                <CommandButton command={commands.start || 'GO.cmd'} />
                <CommandButton command={commands.startNpm || 'npm run go'} />
              </div>
            </Card>

            <Card>
              <div className="mb-5 flex items-center gap-3">
                <Database className="text-indigo-400" size={22} />
                <div>
                  <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Setup state</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Từ .omnisuite/quick-start-state.json</p>
                </div>
              </div>
              <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex justify-between gap-3"><span>Contract</span><strong style={{ color: 'var(--text-primary)' }}>v{runtime?.contractVersion || 1}</strong></div>
                <div className="flex justify-between gap-3"><span>Last setup</span><strong className="text-right" style={{ color: 'var(--text-primary)' }}>{shortDate(setupState?.updatedAt)}</strong></div>
                <div className="flex justify-between gap-3"><span>Node</span><strong style={{ color: setupState?.nodeReady === false ? '#fb7185' : 'var(--text-primary)' }}>{setupState?.nodeReady === false ? 'Chưa ổn' : 'OK / chưa rõ'}</strong></div>
                <div className="flex justify-between gap-3"><span>Python</span><strong style={{ color: setupState?.pythonReady === false ? '#fb7185' : 'var(--text-primary)' }}>{setupState?.pythonReady === false ? 'Chưa ổn' : 'OK / chưa rõ'}</strong></div>
                <div className="flex justify-between gap-3"><span>Playwright</span><strong style={{ color: setupState?.playwrightReady === false ? '#f59e0b' : 'var(--text-primary)' }}>{setupState?.playwrightReady === false ? 'Cần repair' : 'OK / chưa rõ'}</strong></div>
              </div>
            </Card>
          </div>
        </div>

        <Card>
          <div className="mb-5 flex items-center gap-3">
            <Key className="text-indigo-400" size={22} />
            <div>
              <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>API keys & kết nối ngoài</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Xanh là đã có trong .env hoặc Dashboard Settings</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {API_KEYS.map((item) => {
              const active = !!payload?.merged?.[item.key];
              const envOnly = !!payload?.envOnly?.[item.key];
              return (
                <div key={item.key} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black" style={{ color: 'var(--text-primary)' }}>{item.label}</h3>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{item.group}</p>
                    </div>
                    <Badge tone={active ? 'good' : 'neutral'}>{active ? (envOnly ? '.env' : 'Settings') : 'Missing'}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {requiredDown.length > 0 && (
          <Card className="border-rose-500/30">
            <div className="flex items-start gap-4">
              <Wrench className="mt-1 text-rose-400" size={22} />
              <div className="space-y-3">
                <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Có service bắt buộc đang chết</h2>
                <p className="text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                  Chạy repair trước. Nếu vẫn lỗi, nhìn log phía terminal. Đúng, terminal lại xuất hiện, vì đời chưa đủ khổ.
                </p>
                <div className="max-w-md">
                  <CommandButton command={commands.repair || 'GO.cmd --repair'} />
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
