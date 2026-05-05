"use client";

import { useMemo, useState } from "react";
import { GitMerge, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { clusterTexts } from "@/lib/seo/embeddings";
import { downloadAsCsv } from "@/lib/seo/csv";

export default function KeywordConsolidationPage() {
  const [raw, setRaw] = useState("");
  const [threshold, setThreshold] = useState(0.6);

  const items = useMemo(
    () =>
      raw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [raw]
  );

  const suggestions = useMemo(() => {
    if (items.length < 2) return [];
    return clusterTexts(items, threshold).filter((c) => c.members.length > 1);
  }, [items, threshold]);

  const handleExport = () => {
    if (!suggestions.length) return;
    const rows: (string | number)[][] = [];
    suggestions.forEach((c, i) => {
      c.members.slice(1).forEach((m) =>
        rows.push([`Group ${i + 1}`, c.centroid, m.text, m.score.toFixed(3), "Gộp về centroid"])
      );
    });
    downloadAsCsv("consolidation.csv", ["Group", "Keep (centroid)", "Merge", "Similarity", "Hành động"], rows);
  };

  return (
    <ToolShell
      title="Keyword Consolidation Suggester"
      description="Phát hiện các nhóm từ khóa gần trùng intent (similarity cao) và đề xuất giữ một, gộp các từ còn lại."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          placeholder={"giá iphone 15\niphone 15 giá bao nhiêu\nbảng giá iphone 15\n..."}
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
            Ngưỡng gộp:
            <input type="range" min={0.4} max={0.9} step={0.05} value={threshold} onChange={(e) => setThreshold(parseFloat(e.target.value))} />
            <span className="font-mono text-cyan-400 w-12 text-right">{threshold.toFixed(2)}</span>
          </label>
          {suggestions.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold ml-auto"
            >
              <Download size={16} /> CSV
            </button>
          )}
        </div>
      </div>

      {suggestions.map((c, i) => (
        <div
          key={i}
          className="rounded-2xl p-4 space-y-2"
          style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}
        >
          <div className="flex items-center gap-2">
            <GitMerge size={16} className="text-emerald-400" />
            <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
              Giữ lại:
            </span>
            <span className="text-sm font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{c.centroid}</span>
          </div>
          <ul className="text-sm pl-7 list-disc" style={{ color: "var(--text-secondary)" }}>
            {c.members.slice(1).map((m, idx) => (
              <li key={idx}>
                Gộp <span className="font-mono">{m.text}</span>
                <span className="ml-2 text-xs text-cyan-400/80 font-mono">{m.score.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {items.length > 1 && suggestions.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
          Không phát hiện nhóm nào ở ngưỡng {threshold.toFixed(2)}. Hạ ngưỡng để gộp lỏng hơn.
        </p>
      )}
    </ToolShell>
  );
}
