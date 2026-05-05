"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { rankBySimilarity } from "@/lib/seo/embeddings";
import { downloadAsCsv } from "@/lib/seo/csv";

export default function InternalSearchMapperPage() {
  const [searchesRaw, setSearchesRaw] = useState("");
  const [pagesRaw, setPagesRaw] = useState("");

  const searches = useMemo(() => searchesRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), [searchesRaw]);
  const pages = useMemo(() => pagesRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), [pagesRaw]);

  const mapping = useMemo(() => {
    if (!searches.length || !pages.length) return [];
    return searches.map((q) => {
      const ranked = rankBySimilarity(q, pages);
      return { query: q, top: ranked[0] };
    });
  }, [searches, pages]);

  const handleExport = () => {
    if (!mapping.length) return;
    downloadAsCsv(
      "internal-search-mapping.csv",
      ["Query", "Best landing", "Score"],
      mapping.map((m) => [m.query, m.top?.text || "", m.top?.score.toFixed(3) || "0"])
    );
  };

  return (
    <ToolShell
      title="Internal Search Mapper"
      description="Map keyword nội bộ (site search log) sang landing page có sẵn dựa trên similarity. Hữu ích cho redirect / tạo trang mới khi không có match."
      requires={[]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>Search queries ({searches.length})</label>
          <textarea
            value={searchesRaw}
            onChange={(e) => setSearchesRaw(e.target.value)}
            rows={12}
            className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
        </div>
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>Landing pages ({pages.length})</label>
          <textarea
            value={pagesRaw}
            onChange={(e) => setPagesRaw(e.target.value)}
            rows={12}
            className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
        </div>
      </div>

      {mapping.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
            <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>Mapping ({mapping.length})</h3>
            <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
              <Download size={14} /> CSV
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr><th className="text-left p-3">Query</th><th className="text-left p-3">Best landing</th><th className="text-right p-3">Score</th></tr>
            </thead>
            <tbody>
              {mapping.slice(0, 300).map((m, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3 font-bold" style={{ color: "var(--text-primary)" }}>{m.query}</td>
                  <td className="p-3 text-xs" style={{ color: "var(--text-secondary)" }}>{m.top?.text}</td>
                  <td className="p-3 text-right font-mono">{m.top?.score.toFixed(2) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
