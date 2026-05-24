"use client";

import { useState } from "react";
import { Loader2, Play, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";

interface Result {
  url: string;
  ok: boolean;
  error?: string;
  hreflangs?: { lang: string; href: string; rel: string }[];
  hasXDefault?: boolean;
  duplicates?: string[];
  selfReferences?: boolean;
}

export default function HreflangCheckerPage() {
  const [raw, setRaw] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResults([]);
    try {
      const urls = raw.split(/\r?\n/).map((s) => s.trim()).filter((u) => u.startsWith("http"));
      const resp = await fetch("/api/seo/hreflang-checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Không kiểm tra được");
      setResults(data.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setRunning(false);
    }
  };

  return (
    <ToolShell
      title="Hreflang Checker"
      description="Kiểm tra thẻ hreflang trên các URL: trùng lặp, thiếu x-default, self-reference."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          placeholder="https://example.com/vn/\nhttps://example.com/en/"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <button
          onClick={handleRun}
          disabled={running || !raw.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold"
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? "Đang fetch..." : "Kiểm tra"}
        </button>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>

      {results.map((r) => (
        <div key={r.url} className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-mono truncate" style={{ color: "var(--text-primary)" }}>{r.url}</p>
            {r.ok ? (
              <span className="text-xs font-black text-emerald-400 flex items-center gap-1"><CheckCircle2 size={14} /> OK</span>
            ) : (
              <span className="text-xs font-black text-rose-400 flex items-center gap-1"><AlertTriangle size={14} /> {r.error}</span>
            )}
          </div>
          {r.ok && (
            <>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Pill ok={r.hasXDefault} label={r.hasXDefault ? "Có x-default" : "Thiếu x-default"} />
                <Pill ok={!r.duplicates?.length} label={r.duplicates?.length ? `Trùng: ${r.duplicates.join(", ")}` : "Không trùng lang"} />
                <Pill ok={!!r.selfReferences} label={r.selfReferences ? "Self-reference OK" : "Thiếu self-reference"} />
              </div>
              <table className="w-full text-xs">
                <thead className="font-black uppercase" style={{ color: "var(--text-muted)" }}>
                  <tr><th className="text-left p-2">Lang</th><th className="text-left p-2">Href</th></tr>
                </thead>
                <tbody>
                  {(r.hreflangs || []).map((h, i) => (
                    <tr key={i} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                      <td className="p-2 font-mono">{h.lang}</td>
                      <td className="p-2 truncate font-mono" style={{ color: "var(--text-secondary)" }}>{h.href}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      ))}
    </ToolShell>
  );
}

function Pill({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <span className={`px-2 py-0.5 rounded font-bold ${ok ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-300"}`}>
      {label}
    </span>
  );
}
