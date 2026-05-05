"use client";

import { useState } from "react";
import { Loader2, Play, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface Row { url: string; status: number | null; finalUrl?: string; ok: boolean; error?: string; redirected?: boolean }

export default function DeadLinkReclaimerPage() {
  const [raw, setRaw] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResults([]);
    try {
      const urls = raw.split(/\r?\n/).map((s) => s.trim()).filter((u) => u.startsWith("http"));
      const resp = await fetch("/api/seo/dead-link-reclaimer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Không kiểm tra được");
      setResults(data.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const dead = results.filter((r) => !r.ok && (r.status === null || r.status >= 400));

  const handleExport = () => {
    if (!results.length) return;
    downloadAsCsv("dead-links.csv", ["URL", "Status", "Final URL", "Action"],
      results.map((r) => [r.url, r.status ?? "ERR", r.finalUrl || "", r.ok ? (r.redirected ? "Redirect OK" : "OK") : "Cần redirect/khôi phục"])
    );
  };

  return (
    <ToolShell
      title="Dead Link Reclaimer"
      description="Kiểm tra trạng thái URL → phát hiện 4xx/5xx để chuẩn bị redirect 301 hoặc khôi phục nội dung."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          placeholder="https://yoursite.com/old-blog-post"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <div className="flex items-center gap-2">
          <button onClick={handleRun} disabled={running || !raw.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "Đang kiểm tra..." : "Kiểm tra"}
          </button>
          {results.length > 0 && (
            <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">
              <Download size={14} /> CSV
            </button>
          )}
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>

      {results.length > 0 && (
        <>
          <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <h3 className="text-sm font-black uppercase text-amber-400 mb-2">
              Cần xử lý: {dead.length}/{results.length}
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Sau khi xác nhận, dùng HTAccess Redirect Generator để sinh quy tắc 301.
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <table className="w-full text-sm">
              <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
                <tr><th className="text-left p-3">URL</th><th className="text-center p-3">Status</th><th className="text-left p-3">Final</th></tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.url} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                    <td className="p-3 truncate max-w-[300px]" style={{ color: "var(--text-primary)" }}>{r.url}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        r.ok ? "bg-emerald-500/10 text-emerald-400" :
                        (r.status && r.status >= 400 && r.status < 500) ? "bg-rose-500/10 text-rose-400" :
                        "bg-amber-500/10 text-amber-400"
                      }`}>
                        {r.status ?? r.error ?? "ERR"}
                      </span>
                    </td>
                    <td className="p-3 truncate max-w-[300px] text-xs" style={{ color: "var(--text-secondary)" }}>
                      {r.redirected ? r.finalUrl : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ToolShell>
  );
}
