"use client";

import { useState } from "react";
import { Loader2, Play, Download, MessageCircleQuestion } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface PaaItem { question?: string; snippet?: string; link?: string; title?: string }

export default function PaaScraperPage() {
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState<PaaItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!query.trim()) return;
    setRunning(true);
    setError(null);
    setItems([]);
    try {
      const apiKey = (typeof window !== "undefined" && JSON.parse(localStorage.getItem("omnisuite_settings") || "{}").serpapi_key) || "";
      const resp = await fetch("/api/seo/serpapi-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), apiKey }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Lỗi");
      setItems((data?.related_questions || []) as PaaItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    if (!items.length) return;
    downloadAsCsv("paa.csv", ["Question", "Snippet", "Link"], items.map((p) => [p.question || "", p.snippet || "", p.link || ""]));
  };

  return (
    <ToolShell
      title="People Also Ask Scraper"
      description="Trích các câu hỏi 'People also ask' từ Google qua SerpApi."
      requires={["serpapi"]}
    >
      <div className="rounded-2xl p-6 flex gap-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRun()}
          placeholder="cách viết bài chuẩn SEO" className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <button onClick={handleRun} disabled={running || !query.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Tìm
        </button>
        {items.length > 0 && (
          <button onClick={handleExport} className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1">
            <Download size={14} /> CSV
          </button>
        )}
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <div className="space-y-2">
        {items.map((p, i) => (
          <div key={i} className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
            <p className="text-sm font-bold flex items-start gap-2" style={{ color: "var(--text-primary)" }}>
              <MessageCircleQuestion size={14} className="text-cyan-400 mt-0.5" /> {p.question}
            </p>
            {p.snippet && <p className="ml-6 text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{p.snippet}</p>}
            {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="ml-6 text-xs text-cyan-400 hover:text-cyan-300 mt-1 block">{p.title || p.link}</a>}
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
