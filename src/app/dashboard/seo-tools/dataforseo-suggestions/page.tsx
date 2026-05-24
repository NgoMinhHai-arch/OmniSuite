"use client";

import { useState } from "react";
import { Loader2, Play, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface Suggestion {
  keyword?: string;
  keyword_info?: { search_volume?: number; competition?: string; cpc?: number };
}

export default function DataForSeoSuggestionsPage() {
  const [keyword, setKeyword] = useState("");
  const [locationCode, setLocationCode] = useState(2840);
  const [language, setLanguage] = useState("vi");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!keyword.trim()) return;
    setRunning(true);
    setError(null);
    setItems([]);
    try {
      const local = JSON.parse(localStorage.getItem("omnisuite_settings") || "{}");
      const resp = await fetch("/api/seo/dataforseo/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          location_code: locationCode,
          language_code: language,
          user: local.dataforseo_user,
          pass: local.dataforseo_pass,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Lỗi");
      setItems((data.items || []) as Suggestion[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    if (!items.length) return;
    downloadAsCsv("dataforseo-suggestions.csv",
      ["Keyword", "Volume", "Competition", "CPC"],
      items.map((i) => [
        i.keyword || "",
        i.keyword_info?.search_volume ?? "",
        i.keyword_info?.competition ?? "",
        i.keyword_info?.cpc ?? "",
      ])
    );
  };

  return (
    <ToolShell
      title="DataForSEO Suggestions"
      description="Lấy keyword suggestions kèm volume/CPC/competition từ DataForSEO Labs."
      requires={["dataforseo"]}
    >
      <div className="rounded-2xl p-6 flex flex-wrap gap-2 items-center" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="seed keyword"
          className="flex-1 min-w-[200px] rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <input type="number" value={locationCode} onChange={(e) => setLocationCode(Number(e.target.value) || 2840)}
          className="w-28 rounded-xl px-3 py-2.5 text-sm font-mono"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} title="Location code (2840=US, 2704=VN, 2826=UK)" />
        <input value={language} onChange={(e) => setLanguage(e.target.value)} className="w-20 rounded-xl px-3 py-2.5 text-sm font-mono"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <button onClick={handleRun} disabled={running || !keyword.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? "Đang gọi..." : "Lấy suggestions"}
        </button>
        {items.length > 0 && (
          <button onClick={handleExport} className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1">
            <Download size={14} /> CSV
          </button>
        )}
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {items.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr>
                <th className="text-left p-3">Keyword</th>
                <th className="text-right p-3">Volume</th>
                <th className="text-right p-3">CPC</th>
                <th className="text-right p-3">Competition</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 200).map((i, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3" style={{ color: "var(--text-primary)" }}>{i.keyword}</td>
                  <td className="p-3 text-right font-mono text-cyan-400">{i.keyword_info?.search_volume ?? "—"}</td>
                  <td className="p-3 text-right font-mono">{i.keyword_info?.cpc?.toFixed?.(2) ?? "—"}</td>
                  <td className="p-3 text-right font-mono">{i.keyword_info?.competition ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
