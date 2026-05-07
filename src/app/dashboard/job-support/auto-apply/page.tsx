'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Rocket, ShieldCheck } from 'lucide-react';
import Card from '@/shared/ui/Card';
import Typography from '@/shared/ui/Typography';

export default function AutoApplyDashboardPage() {
  const [applyJobUrls, setApplyJobUrls] = useState('');
  const [mode, setMode] = useState<'dry-run' | 'live'>('dry-run');
  const [approved, setApproved] = useState(false);
  const [result, setResult] = useState('');
  const [copyOk, setCopyOk] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setRunning(true);
    setResult('');
    setError('');
    setCopyOk(false);
    try {
      const res = await fetch('/api/job-support/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace: 'auto-apply',
          mode,
          approved,
          applyJobUrls,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; output?: { stdout?: string; hint?: string }; error?: string; hint?: string; errorCode?: string };
      if (!res.ok || !data.ok) {
        setError([data.error, data.hint].filter(Boolean).join('\n') || 'Run failed.');
        return;
      }
      setResult(data.output?.stdout?.trim() || data.output?.hint || 'Done.');
    } catch {
      setResult('Không gọi được API.');
    } finally {
      setRunning(false);
    }
  };

  const inputCount = useMemo(() => {
    return applyJobUrls
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean).length;
  }, [applyJobUrls]);

  const extractUrlsFromStdout = () => {
    try {
      const j = JSON.parse(result) as { applyUrls?: string[] };
      return Array.isArray(j.applyUrls) ? j.applyUrls : [];
    } catch {
      return [];
    }
  };

  const copyUrls = async () => {
    const urls = extractUrlsFromStdout();
    if (urls.length === 0) return;
    try {
      await navigator.clipboard.writeText(urls.join('\n'));
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    } catch {
      setCopyOk(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <Card className="rounded-[2rem] p-8 md:p-10" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
          <ShieldCheck size={14} />
          Manual Apply Assistant
        </div>
        <Typography variant="h2" className="mb-3" style={{ color: 'var(--text-primary)' }}>
          Checklist nộp hồ sơ (thủ công)
        </Typography>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          OmniSuite không tự điền form hay Playwright apply. Chỉ gom và xác nhận danh sách link bạn đã chọn để làm checklist.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
            <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>Input lines</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{inputCount}</p>
          </div>
          <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
            <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>Mode</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{mode}</p>
          </div>
          <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
            <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>Approval</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{approved ? 'ON' : 'OFF'}</p>
          </div>
          <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
            <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>Safety</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>Manual</p>
          </div>
        </div>
      </Card>

      <Card className="rounded-[2rem] p-8 space-y-4" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <label className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Link ứng tuyển (mỗi dòng một URL, hoặc dán khối văn bản chứa link)
        </label>
        <textarea
          value={applyJobUrls}
          onChange={(e) => setApplyJobUrls(e.target.value)}
          rows={10}
          placeholder="https://itviec.com/it-jobs/...&#10;https://www.topcv.vn/viec-lam/...&#10;..."
          className="w-full rounded-xl px-4 py-3 text-xs font-mono"
          style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        />
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'dry-run' ? 'live' : 'dry-run'))}
            className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest"
            style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
          >
            Mode: {mode}
          </button>
          <button
            type="button"
            onClick={() => setApproved((x) => !x)}
            className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest"
            style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
          >
            Xác nhận batch (live): {approved ? 'ON' : 'OFF'}
          </button>
        </div>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Live chỉ có nghĩa “đã đồng ý checklist hàng loạt” và tính vào giới hạn/ngày; mở từng tab vẫn do bạn trên máy.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={run} disabled={running} className="rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest inline-flex items-center gap-2" style={{ backgroundColor: '#6366f1', color: 'white' }}>
            <Rocket size={14} />
            {running ? 'Running...' : 'Tạo checklist'}
          </button>
          <button type="button" onClick={copyUrls} disabled={!result.startsWith('{')} className="rounded-xl px-4 py-3 text-[10px] font-bold uppercase inline-flex items-center gap-2" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
            <ClipboardList size={12} />
            Copy danh sách URL
          </button>
          {copyOk && <span className="text-[10px] self-center text-emerald-500 inline-flex items-center gap-1"><CheckCircle2 size={12} />Đã copy</span>}
        </div>

        {error && (
          <div className="rounded-xl p-3 text-[11px]" style={{ backgroundColor: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', color: '#fb7185' }}>
            {error}
          </div>
        )}

        <pre className="rounded-xl p-3 text-[11px] whitespace-pre-wrap max-h-[360px] overflow-auto" style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
          {result || 'Chưa chạy.'}
        </pre>
      </Card>
    </div>
  );
}
