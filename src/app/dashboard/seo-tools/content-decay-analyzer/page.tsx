"use client";

import { useState } from "react";
import { Loader2, Play, Download, TrendingDown } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface GscRow { keys?: string[]; clicks?: number; impressions?: number; position?: number }
interface DecayRow { page: string; before: number; after: number; delta: number }

export default function ContentDecayAnalyzerPage() {
  const [siteUrl, setSiteUrl] = useState("");
  const today = new Date();
  const endB = new Date(today); endB.setDate(today.getDate() - 3);
  const startB = new Date(endB); startB.setDate(endB.getDate() - 28);
  const endA = new Date(startB); endA.setDate(startB.getDate() - 1);
  const startA = new Date(endA); startA.setDate(endA.getDate() - 28);

  const [pA, setPA] = useState({ start: startA.toISOString().slice(0, 10), end: endA.toISOString().slice(0, 10) });
  const [pB, setPB] = useState({ start: startB.toISOString().slice(0, 10), end: endB.toISOString().slice(0, 10) });
  const [rows, setRows] = useState<DecayRow[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setRows([]);
    try {
      const local = JSON.parse(localStorage.getItem("omnisuite_settings") || "{}");
      const fetchRange = async (start: string, end: string): Promise<GscRow[]> => {
        const resp = await fetch("/api/seo/gsc/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteUrl: siteUrl || local.gsc_property_uri,
            startDate: start, endDate: end,
            dimensions: ["page"], rowLimit: 5000,
            serviceAccountKey: local.gsc_service_account_key,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Lỗi");
        return data.rows || [];
      };
      const [a, b] = await Promise.all([fetchRange(pA.start, pA.end), fetchRange(pB.start, pB.end)]);
      const mapB = new Map(b.map((r) => [r.keys?.[0] || "", r]));
      const compare: DecayRow[] = a.map((r) => {
        const p = r.keys?.[0] || "";
        const newRow = mapB.get(p);
        return {
          page: p,
          before: r.clicks || 0,
          after: newRow?.clicks || 0,
          delta: (newRow?.clicks || 0) - (r.clicks || 0),
        };
      }).filter((r) => r.before >= 10 && r.delta < 0).sort((a, b) => a.delta - b.delta);
      setRows(compare);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    if (!rows.length) return;
    downloadAsCsv("content-decay.csv", ["Page", "Clicks before", "Clicks after", "Delta"], rows.map((r) => [r.page, r.before, r.after, r.delta]));
  };

  return (
    <ToolShell title="Content Decay Analyzer" description="Trang sụt clicks giữa 2 khoảng thời gian — cần làm mới nội dung." requires={["gsc"]}>
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="Property URI"
          className="w-full rounded-xl px-3 py-2.5 text-sm font-mono"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs font-black uppercase mb-1" style={{ color: "var(--text-muted)" }}>A (trước)</p>
            <div className="flex gap-2">
              <input type="date" value={pA.start} onChange={(e) => setPA({ ...pA, start: e.target.value })} className="flex-1 rounded-xl px-3 py-2 text-sm font-mono"
                style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
              <input type="date" value={pA.end} onChange={(e) => setPA({ ...pA, end: e.target.value })} className="flex-1 rounded-xl px-3 py-2 text-sm font-mono"
                style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase mb-1" style={{ color: "var(--text-muted)" }}>B (sau)</p>
            <div className="flex gap-2">
              <input type="date" value={pB.start} onChange={(e) => setPB({ ...pB, start: e.target.value })} className="flex-1 rounded-xl px-3 py-2 text-sm font-mono"
                style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
              <input type="date" value={pB.end} onChange={(e) => setPB({ ...pB, end: e.target.value })} className="flex-1 rounded-xl px-3 py-2 text-sm font-mono"
                style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRun} disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Phân tích
          </button>
          {rows.length > 0 && (
            <button onClick={handleExport} className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1">
              <Download size={14} /> CSV
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {rows.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr><th className="text-left p-3">Page</th><th className="text-right p-3">Trước</th><th className="text-right p-3">Sau</th><th className="text-right p-3">Δ</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((r) => (
                <tr key={r.page} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3 truncate max-w-[400px] font-mono" style={{ color: "var(--text-primary)" }}>{r.page}</td>
                  <td className="p-3 text-right font-mono">{r.before}</td>
                  <td className="p-3 text-right font-mono">{r.after}</td>
                  <td className="p-3 text-right font-mono font-bold text-rose-400 flex items-center justify-end gap-1">
                    <TrendingDown size={12} /> {r.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
