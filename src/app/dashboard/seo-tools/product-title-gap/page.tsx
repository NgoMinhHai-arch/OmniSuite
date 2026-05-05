"use client";

import { useMemo, useState } from "react";
import { ToolShell } from "@/components/seo/ToolShell";
import { tokenize } from "@/lib/seo/embeddings";

export default function ProductTitleGapPage() {
  const [mineRaw, setMineRaw] = useState("");
  const [otherRaw, setOtherRaw] = useState("");

  const analysis = useMemo(() => {
    const mine = mineRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const other = otherRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

    const mineTokens = new Set<string>();
    mine.forEach((t) => tokenize(t).forEach((tok) => mineTokens.add(tok)));

    const otherCounts = new Map<string, number>();
    other.forEach((t) => {
      const seen = new Set<string>();
      tokenize(t).forEach((tok) => {
        if (!seen.has(tok)) {
          otherCounts.set(tok, (otherCounts.get(tok) || 0) + 1);
          seen.add(tok);
        }
      });
    });

    const gaps = Array.from(otherCounts.entries())
      .filter(([term]) => !mineTokens.has(term))
      .map(([term, count]) => ({ term, count, share: count / Math.max(1, other.length) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 60);

    return { gaps, mineCount: mine.length, otherCount: other.length };
  }, [mineRaw, otherRaw]);

  return (
    <ToolShell
      title="Product Title Gap"
      description="So sánh tập title của bạn với title đối thủ — liệt kê từ/cụm xuất hiện ở đối thủ nhưng vắng ở bạn."
      requires={[]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>Title của bạn ({analysis.mineCount})</label>
          <textarea
            value={mineRaw}
            onChange={(e) => setMineRaw(e.target.value)}
            rows={12}
            className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
        </div>
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>Title đối thủ ({analysis.otherCount})</label>
          <textarea
            value={otherRaw}
            onChange={(e) => setOtherRaw(e.target.value)}
            rows={12}
            className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
        </div>
      </div>

      {analysis.gaps.length > 0 && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <h3 className="text-sm font-black uppercase mb-3" style={{ color: "var(--text-primary)" }}>Khe hở từ khóa</h3>
          <div className="flex flex-wrap gap-2">
            {analysis.gaps.map((g) => (
              <span key={g.term} className="px-2 py-1 rounded text-xs font-bold bg-amber-500/10 text-amber-300">
                {g.term} <span className="opacity-70 font-mono">×{g.count} · {(g.share * 100).toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </ToolShell>
  );
}
