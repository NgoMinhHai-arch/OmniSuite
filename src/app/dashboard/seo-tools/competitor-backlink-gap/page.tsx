"use client";

import { useState } from "react";
import { Loader2, Play, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface IntersectionItem { domain?: string; backlinks?: number; rank?: number; first_seen?: string }

export default function CompetitorBacklinkGapPage() {
  const [yourDomain, setYourDomain] = useState("");
  const [competitorsRaw, setCompetitorsRaw] = useState("");
  const [items, setItems] = useState<IntersectionItem[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setItems([]);
    try {
      const local = JSON.parse(localStorage.getItem("omnisuite_settings") || "{}");
      const targets = competitorsRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (!targets.length) throw new Error("Cần ít nhất 1 competitor");
      const resp = await fetch("/api/seo/dataforseo/backlinks-intersection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets,
          exclude_target: yourDomain.trim() || undefined,
          user: local.dataforseo_user,
          pass: local.dataforseo_pass,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Lỗi");
      setItems(data.items as IntersectionItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    if (!items.length) return;
    downloadAsCsv("backlink-gap.csv", ["Domain", "Backlinks", "Rank", "First seen"],
      items.map((i) => [i.domain || "", i.backlinks ?? "", i.rank ?? "", i.first_seen || ""])
    );
  };

  return (
    <ToolShell
      title="Competitor Backlink Gap"
      description="Tìm domain đang link tới đối thủ nhưng chưa link tới bạn (DataForSEO Backlinks intersection)."
      requires={["dataforseo"]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <input value={yourDomain} onChange={(e) => setYourDomain(e.target.value)} placeholder="domain của bạn (vd: yoursite.com)"
          className="w-full rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <textarea value={competitorsRaw} onChange={(e) => setCompetitorsRaw(e.target.value)} rows={6} placeholder="đối thủ (mỗi dòng 1, tối đa 20)"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <div className="flex items-center gap-2">
          <button onClick={handleRun} disabled={running || !competitorsRaw.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "Đang gọi..." : "Tìm gap"}
          </button>
          {items.length > 0 && (
            <button onClick={handleExport} className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1">
              <Download size={14} /> CSV
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {items.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr>
                <th className="text-left p-3">Domain</th>
                <th className="text-right p-3">Backlinks</th>
                <th className="text-right p-3">Rank</th>
                <th className="text-left p-3">First seen</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 200).map((i, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3 font-mono" style={{ color: "var(--text-primary)" }}>{i.domain}</td>
                  <td className="p-3 text-right font-mono text-cyan-400">{i.backlinks ?? "—"}</td>
                  <td className="p-3 text-right font-mono">{i.rank ?? "—"}</td>
                  <td className="p-3 text-xs" style={{ color: "var(--text-muted)" }}>{i.first_seen?.slice(0, 10) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
