'use client';

import { useMemo, useState } from 'react';
import { FileText, Sparkles, Wand2 } from 'lucide-react';
import Card from '@/shared/ui/Card';
import Typography from '@/shared/ui/Typography';

export default function TailorCvDashboardPage() {
  const [jobUrl, setJobUrl] = useState('');
  const [jdText, setJdText] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [result, setResult] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setRunning(true);
    setResult('');
    setError('');
    try {
      const res = await fetch('/api/job-support/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace: 'tailor-cv',
          mode: 'dry-run',
          jobUrl,
          jdText,
          resumeText,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; output?: { stdout?: string; hint?: string }; error?: string; hint?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || data.hint || 'Run failed.');
        return;
      }
      setResult(data.output?.stdout?.trim() || data.output?.hint || 'Done.');
    } catch {
      setResult('Không gọi được API.');
    } finally {
      setRunning(false);
    }
  };

  const jdLength = useMemo(() => jdText.trim().length, [jdText]);
  const resumeLength = useMemo(() => resumeText.trim().length, [resumeText]);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <Card className="rounded-[2rem] p-8 md:p-10" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
          <Sparkles size={14} />
          CV Tailoring
        </div>
        <Typography variant="h2" className="mb-3" style={{ color: 'var(--text-primary)' }}>
          Tailor CV Dashboard
        </Typography>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Nền tảng: `ai-resume-tailor` - tối ưu CV theo JD và ATS keywords.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
            <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>JD chars</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{jdLength}</p>
          </div>
          <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
            <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>Resume chars</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{resumeLength}</p>
          </div>
          <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
            <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>Input state</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{jdLength > 0 || jobUrl ? 'Ready' : 'Draft'}</p>
          </div>
          <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
            <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>Mode</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>Dry-run</p>
          </div>
        </div>
      </Card>

      <Card className="rounded-[2rem] p-8 space-y-4" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <input value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="Job URL (optional)" className="w-full h-12 rounded-xl px-4" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }} />
        <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} rows={6} placeholder="JD text" className="w-full rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }} />
        <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} rows={7} placeholder="Resume text" className="w-full rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }} />
        <div className="flex flex-wrap gap-2">
        <button type="button" onClick={run} disabled={running} className="rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest inline-flex items-center gap-2" style={{ backgroundColor: '#6366f1', color: 'white' }}>
          <Wand2 size={14} />
          {running ? 'Running...' : 'Run Tailor CV'}
        </button>
        <button
          type="button"
          onClick={() => {
            setJobUrl('');
            setJdText('');
            setResumeText('');
            setResult('');
            setError('');
          }}
          className="rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2"
          style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        >
          <FileText size={14} />
          Clear form
        </button>
        </div>
        {error && (
          <div className="rounded-xl p-3 text-[11px]" style={{ backgroundColor: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', color: '#fb7185' }}>
            {error}
          </div>
        )}
        <pre className="rounded-xl p-3 text-[11px] whitespace-pre-wrap max-h-[260px] overflow-auto" style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
          {result || 'No output yet.'}
        </pre>
      </Card>
    </div>
  );
}
