"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";

interface TrendsResultItem {
  type?: string;
  data?: Array<{ values?: Array<{ value?: number }>; date_from?: string; date_to?: string }>;
  keywords?: string[];
}

export default function KeywordTrendsAnalyzerPage() {
  const [raw, setRaw] = useState("");
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState<TrendsResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setItems([]);
    try {
      const local = JSON.parse(localStorage.getItem("omnisuite_settings") || "{}");
      const keywords = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 5);
      if (!keywords.length) throw new Error("Cần ít nhất 1 keyword");
      const resp = await fetch("/api/seo/dataforseo/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          location_code: 2704,
          language_code: "vi",
          user: local.dataforseo_user,
          pass: local.dataforseo_pass,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Lỗi");
      setItems(data.items as TrendsResultItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  return (
    <ToolShell
      title="Keyword Trends Analyzer"
      description="Phân tích xu hướng keyword theo thời gian (DataForSEO Trends explore)."
      requires={["dataforseo"]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={4} placeholder="tối đa 5 keyword, mỗi dòng 1"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <button onClick={handleRun} disabled={running || !raw.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? "Đang gọi..." : "Phân tích"}
        </button>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {items.map((it, i) => (
        <div key={i} className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
          <h3 className="text-sm font-black uppercase mb-2" style={{ color: "var(--text-primary)" }}>{it.type || "Trend"}</h3>
          {it.keywords && (
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{it.keywords.join(", ")}</p>
          )}
          <pre className="text-xs whitespace-pre-wrap font-mono overflow-x-auto" style={{ color: "var(--text-secondary)" }}>
            {JSON.stringify(it.data, null, 2).slice(0, 4000)}
          </pre>
        </div>
      ))}
    </ToolShell>
  );
}
