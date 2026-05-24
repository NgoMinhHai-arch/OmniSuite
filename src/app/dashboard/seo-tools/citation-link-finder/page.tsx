"use client";

import { useState } from "react";
import { Loader2, Play, ExternalLink, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface OrganicResult { title?: string; snippet?: string; link?: string; displayed_link?: string }

export default function CitationLinkFinderPage() {
  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState<OrganicResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!topic.trim()) return;
    setRunning(true);
    setError(null);
    setItems([]);
    try {
      const apiKey = (typeof window !== "undefined" && JSON.parse(localStorage.getItem("omnisuite_settings") || "{}").serpapi_key) || "";
      // Khai thác mệnh đề citation phổ biến
      const queries = [
        `${topic} site:wikipedia.org`,
        `${topic} statistics`,
        `${topic} report pdf`,
        `${topic} study`,
        `${topic} guide`,
      ];
      const out: OrganicResult[] = [];
      for (const q of queries) {
        const resp = await fetch("/api/seo/serpapi-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, apiKey, num: 10 }),
        });
        const data = await resp.json();
        if (resp.ok) (data?.organic_results || []).slice(0, 5).forEach((r: OrganicResult) => out.push(r));
      }
      // dedupe by link
      const seen = new Set<string>();
      const uniq = out.filter((r) => {
        if (!r.link || seen.has(r.link)) return false;
        seen.add(r.link);
        return true;
      });
      setItems(uniq);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    if (!items.length) return;
    downloadAsCsv("citations.csv", ["Title", "Link", "Snippet"], items.map((r) => [r.title || "", r.link || "", r.snippet || ""]));
  };

  return (
    <ToolShell
      title="Citation Link Finder"
      description="Tìm nguồn citation chất lượng (Wikipedia, statistics, study, report) cho chủ đề bài viết — qua SerpApi."
      requires={["serpapi"]}
    >
      <div className="rounded-2xl p-6 flex gap-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="climate change Vietnam"
          className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <button onClick={handleRun} disabled={running || !topic.trim()}
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
        {items.map((r, i) => (
          <a key={i} href={r.link} target="_blank" rel="noreferrer" className="block rounded-2xl p-4 hover:opacity-80"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
            <p className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              {r.title} <ExternalLink size={12} className="text-cyan-400" />
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{r.snippet}</p>
            <p className="text-[10px] mt-1 font-mono text-cyan-400/80">{r.displayed_link || r.link}</p>
          </a>
        ))}
      </div>
    </ToolShell>
  );
}
