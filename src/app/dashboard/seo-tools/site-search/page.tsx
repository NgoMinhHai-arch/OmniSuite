"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

export default function SiteSearchAnalyzerPage() {
  const [raw, setRaw] = useState("");

  const summary = useMemo(() => {
    const queries = raw
      .split(/\r?\n/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const counts = new Map<string, number>();
    for (const q of queries) counts.set(q, (counts.get(q) || 0) + 1);
    const list = Array.from(counts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count);
    const zeroResultGuess = list.filter((q) => q.count >= 3 && q.query.length > 4);
    return { total: queries.length, unique: list.length, list, zeroResultGuess };
  }, [raw]);

  const handleExport = () => {
    downloadAsCsv("site-search.csv", ["Query", "Count"], summary.list.map((q) => [q.query, q.count]));
  };

  return (
    <ToolShell
      title="Site Search Analyzer"
      description="Dán log search nội bộ (mỗi dòng 1 query) để biết những truy vấn được tìm nhiều nhất → cần tạo trang/redirect."
      requires={[]}
    >
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={12}
          placeholder={"áo sơ mi nam\nquần tây nam\nflashsale tháng 12\nflashsale tháng 12"}
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <div className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Tổng truy vấn: <b className="text-cyan-400">{summary.total}</b> · Unique: <b className="text-cyan-400">{summary.unique}</b>
        </div>
      </div>

      {summary.list.length > 0 && (
        <>
          <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <h3 className="text-sm font-black uppercase mb-2 text-amber-400">Đáng chú ý — có thể đang trả 0 kết quả</h3>
            <div className="flex flex-wrap gap-2">
              {summary.zeroResultGuess.slice(0, 30).map((q) => (
                <span key={q.query} className="text-xs font-mono px-2 py-1 rounded bg-amber-500/10 text-amber-300">
                  {q.query} <span className="opacity-70">×{q.count}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
              <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>Top queries</h3>
              <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                <Download size={14} /> CSV
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
                <tr><th className="text-left p-3">Query</th><th className="text-right p-3">Count</th></tr>
              </thead>
              <tbody>
                {summary.list.slice(0, 200).map((q) => (
                  <tr key={q.query} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                    <td className="p-3" style={{ color: "var(--text-primary)" }}>{q.query}</td>
                    <td className="p-3 text-right font-mono text-cyan-400">{q.count}</td>
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
