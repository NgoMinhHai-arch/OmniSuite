"use client";

import { useMemo, useState } from "react";
import { ToolShell } from "@/components/seo/ToolShell";
import { topNgrams } from "@/lib/seo/embeddings";
import { downloadAsCsv } from "@/lib/seo/csv";
import { Download } from "lucide-react";

export default function NgramSerpExtractorPage() {
  const [raw, setRaw] = useState("");
  const [n, setN] = useState(2);

  const corpus = useMemo(() => raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), [raw]);
  const top = useMemo(() => topNgrams(corpus, n, 50), [corpus, n]);

  const handleExport = () => {
    if (!top.length) return;
    downloadAsCsv("ngrams.csv", ["Phrase", "Count"], top.map((t) => [t.phrase, t.count]));
  };

  return (
    <ToolShell
      title="N-Gram SERP Extractor"
      description="Đếm tần suất n-gram (1–4) trên danh sách title/snippet/description bạn dán vào — không cần SerpApi."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={12}
          placeholder="Dán title hoặc snippet (mỗi dòng 1)"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <div className="flex items-center gap-3">
          <label className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            n =
            <select
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="rounded-lg px-2 py-1 text-sm font-bold"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            >
              <option value={1}>1-gram</option>
              <option value={2}>2-gram</option>
              <option value={3}>3-gram</option>
              <option value={4}>4-gram</option>
            </select>
          </label>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{corpus.length} dòng đầu vào</span>
          {top.length > 0 && (
            <button onClick={handleExport} className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
              <Download size={14} /> CSV
            </button>
          )}
        </div>
      </div>

      {top.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr><th className="text-left p-3">Phrase</th><th className="text-right p-3">Count</th></tr>
            </thead>
            <tbody>
              {top.map((t) => (
                <tr key={t.phrase} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3" style={{ color: "var(--text-primary)" }}>{t.phrase}</td>
                  <td className="p-3 text-right font-mono text-cyan-400">{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
