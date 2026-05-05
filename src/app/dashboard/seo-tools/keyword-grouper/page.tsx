"use client";

import { useMemo, useState } from "react";
import { Layers, Download, Sparkles } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { clusterTexts, ClusterResult } from "@/lib/seo/embeddings";
import { downloadAsCsv } from "@/lib/seo/csv";

export default function KeywordGrouperPage() {
  const [raw, setRaw] = useState("");
  const [threshold, setThreshold] = useState(0.45);
  const [clusters, setClusters] = useState<ClusterResult[]>([]);
  const [running, setRunning] = useState(false);

  const items = useMemo(
    () =>
      raw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [raw]
  );

  const handleRun = () => {
    setRunning(true);
    setTimeout(() => {
      setClusters(clusterTexts(items, threshold));
      setRunning(false);
    }, 0);
  };

  const handleExport = () => {
    if (!clusters.length) return;
    const rows: (string | number)[][] = [];
    clusters.forEach((c, i) => {
      c.members.forEach((m) => rows.push([`Cluster ${i + 1}`, c.centroid, m.text, m.score.toFixed(3)]));
    });
    downloadAsCsv("keyword-clusters.csv", ["Cluster", "Centroid", "Keyword", "Similarity"], rows);
  };

  return (
    <ToolShell
      title="Keyword Grouper"
      description="Cluster danh sách keyword bằng TF-IDF + cosine similarity (chạy hoàn toàn trong trình duyệt/server, không cần API)."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <label className="text-xs font-black uppercase block" style={{ color: "var(--text-muted)" }}>
          Danh sách keyword (mỗi dòng 1 từ khóa) · {items.length} từ khóa
        </label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={12}
          placeholder={"thời trang nam\nthời trang nam công sở\náo sơ mi nam\nquần tây nam\n..."}
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
            Ngưỡng similarity:
            <input
              type="range"
              min={0.2}
              max={0.85}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
            />
            <span className="font-mono text-cyan-400 w-12 text-right">{threshold.toFixed(2)}</span>
          </label>
          <button
            type="button"
            onClick={handleRun}
            disabled={items.length < 2 || running}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold"
          >
            <Sparkles size={16} /> {running ? "Đang nhóm..." : "Nhóm từ khóa"}
          </button>
          {clusters.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <Download size={16} /> Tải CSV
            </button>
          )}
        </div>
      </div>

      {clusters.length > 0 && (
        <div className="space-y-3">
          {clusters.map((c, i) => (
            <div
              key={i}
              className="rounded-2xl p-4"
              style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <Layers size={16} className="text-cyan-400" /> Cluster #{i + 1} · {c.members.length} keyword
                </h3>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  centroid: {c.centroid}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.members.map((m, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-bold px-2 py-1 rounded-lg"
                    style={{ backgroundColor: "var(--hover-bg)", color: "var(--text-secondary)" }}
                  >
                    {m.text}
                    <span className="ml-1 text-cyan-400/80 font-mono">{m.score.toFixed(2)}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </ToolShell>
  );
}
