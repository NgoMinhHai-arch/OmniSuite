"use client";

import { useState } from "react";
import { Loader2, Play, AlertTriangle, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface Row { keys?: string[]; clicks?: number; impressions?: number; position?: number }

interface CannibalRow {
  query: string;
  pages: { page: string; clicks: number; impressions: number; position: number }[];
}

export default function GscCannibalizationCheckerPage() {
  const [siteUrl, setSiteUrl] = useState("");
  const today = new Date(); const end = new Date(today); end.setDate(today.getDate() - 3);
  const startDef = new Date(end); startDef.setDate(end.getDate() - 28);
  const [startDate, setStartDate] = useState(startDef.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(end.toISOString().slice(0, 10));
  const [running, setRunning] = useState(false);
  const [groups, setGroups] = useState<CannibalRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setGroups([]);
    try {
      const local = JSON.parse(localStorage.getItem("omnisuite_settings") || "{}");
      const resp = await fetch("/api/seo/gsc/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteUrl: siteUrl || local.gsc_property_uri,
          startDate, endDate,
          dimensions: ["query", "page"],
          rowLimit: 5000,
          serviceAccountKey: local.gsc_service_account_key,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Lỗi");
      const map = new Map<string, CannibalRow>();
      ((data.rows || []) as Row[]).forEach((r) => {
        const q = r.keys?.[0] || "";
        const p = r.keys?.[1] || "";
        if (!q || !p) return;
        if (!map.has(q)) map.set(q, { query: q, pages: [] });
        map.get(q)!.pages.push({
          page: p,
          clicks: r.clicks || 0,
          impressions: r.impressions || 0,
          position: r.position || 0,
        });
      });
      const flagged = Array.from(map.values())
        .filter((g) => g.pages.length >= 2 && g.pages.reduce((s, x) => s + x.impressions, 0) >= 50)
        .sort((a, b) => b.pages.length - a.pages.length || b.pages.reduce((s, x) => s + x.clicks, 0) - a.pages.reduce((s, x) => s + x.clicks, 0));
      setGroups(flagged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    if (!groups.length) return;
    const rows: (string | number)[][] = [];
    groups.forEach((g) => g.pages.forEach((p) => rows.push([g.query, p.page, p.clicks, p.impressions, p.position.toFixed(1)])));
    downloadAsCsv("cannibalization.csv", ["Query", "Page", "Clicks", "Impressions", "Position"], rows);
  };

  return (
    <ToolShell
      title="GSC Cannibalization Checker"
      description="Phát hiện cùng 1 keyword được rank bởi nhiều URL — gây chồng chéo intent."
      requires={["gsc"]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="Property URI"
            className="rounded-xl px-3 py-2.5 text-sm font-mono"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm font-mono"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm font-mono"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRun} disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "Đang phân tích..." : "Phân tích"}
          </button>
          {groups.length > 0 && (
            <button onClick={handleExport} className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1">
              <Download size={14} /> CSV
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {groups.map((g, i) => (
        <div key={i} className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <h3 className="text-sm font-black flex items-center gap-2 mb-2" style={{ color: "var(--text-primary)" }}>
            <AlertTriangle size={14} className="text-amber-400" /> {g.query} · {g.pages.length} URL
          </h3>
          <table className="w-full text-xs">
            <tbody>
              {g.pages.sort((a, b) => b.clicks - a.clicks).map((p, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-2 truncate max-w-[400px] font-mono" style={{ color: "var(--text-primary)" }}>{p.page}</td>
                  <td className="p-2 text-right font-mono text-cyan-400">{p.clicks}c</td>
                  <td className="p-2 text-right font-mono">{p.impressions}i</td>
                  <td className="p-2 text-right font-mono">pos {p.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </ToolShell>
  );
}
