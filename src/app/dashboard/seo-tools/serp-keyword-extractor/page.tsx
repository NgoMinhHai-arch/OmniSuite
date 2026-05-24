"use client";

import { useMemo, useState } from "react";
import { Loader2, Play, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";
import { topNgrams } from "@/lib/seo/embeddings";

interface OrganicResult { title?: string; snippet?: string; link?: string }

export default function SerpKeywordExtractorPage() {
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [organic, setOrganic] = useState<OrganicResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(2);

  const handleRun = async () => {
    if (!query.trim()) return;
    setRunning(true);
    setError(null);
    setOrganic([]);
    try {
      const apiKey = (typeof window !== "undefined" && JSON.parse(localStorage.getItem("omnisuite_settings") || "{}").serpapi_key) || "";
      const resp = await fetch("/api/seo/serpapi-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), apiKey, num: 30 }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Lỗi");
      setOrganic(data?.organic_results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const corpus = useMemo(() => organic.flatMap((o) => [o.title || "", o.snippet || ""]).filter(Boolean), [organic]);
  const topGrams = useMemo(() => topNgrams(corpus, n, 40), [corpus, n]);

  const handleExport = () => {
    if (!topGrams.length) return;
    downloadAsCsv("serp-keywords.csv", ["Phrase", "Count"], topGrams.map((t) => [t.phrase, t.count]));
  };

  return (
    <ToolShell
      title="SERP Keyword Extractor"
      description="Lấy SERP qua SerpApi rồi đếm n-gram phổ biến trong title/snippet — tìm cụm từ Google đang ưu tiên."
      requires={["serpapi"]}
    >
      <div className="rounded-2xl p-6 flex flex-wrap gap-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="keyword chính"
          className="flex-1 min-w-[200px] rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <select value={n} onChange={(e) => setN(Number(e.target.value))} className="rounded-xl px-3 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}>
          <option value={1}>1-gram</option>
          <option value={2}>2-gram</option>
          <option value={3}>3-gram</option>
        </select>
        <button onClick={handleRun} disabled={running || !query.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Phân tích SERP
        </button>
        {topGrams.length > 0 && (
          <button onClick={handleExport} className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1">
            <Download size={14} /> CSV
          </button>
        )}
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {topGrams.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr><th className="text-left p-3">Phrase</th><th className="text-right p-3">Count</th></tr>
            </thead>
            <tbody>
              {topGrams.map((t) => (
                <tr key={t.phrase} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3" style={{ color: "var(--text-primary)" }}>{t.phrase}</td>
                  <td className="p-3 text-right font-mono text-cyan-400">{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
