"use client";

import { useMemo, useState } from "react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";
import { Download } from "lucide-react";

export default function CompetitorGapPage() {
  const [mineRaw, setMineRaw] = useState("");
  const [otherRaw, setOtherRaw] = useState("");

  const result = useMemo(() => {
    const mine = new Set(mineRaw.split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean));
    const other = new Set(otherRaw.split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean));
    const onlyOther = Array.from(other).filter((k) => !mine.has(k));
    const onlyMine = Array.from(mine).filter((k) => !other.has(k));
    const both = Array.from(mine).filter((k) => other.has(k));
    return { onlyOther, onlyMine, both };
  }, [mineRaw, otherRaw]);

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ...result.onlyOther.map((k) => [k, "Đối thủ có"]),
      ...result.onlyMine.map((k) => [k, "Mình có"]),
      ...result.both.map((k) => [k, "Cả hai"]),
    ];
    downloadAsCsv("competitor-gap.csv", ["Keyword", "Group"], rows);
  };

  return (
    <ToolShell
      title="Competitor Gap"
      description="So sánh 2 danh sách keyword (của bạn vs đối thủ). Xác định từ chỉ đối thủ rank, từ bạn đang giữ độc quyền và overlap."
      requires={[]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>Keyword của bạn</label>
          <textarea value={mineRaw} onChange={(e) => setMineRaw(e.target.value)} rows={10} className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        </div>
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>Keyword đối thủ</label>
          <textarea value={otherRaw} onChange={(e) => setOtherRaw(e.target.value)} rows={10} className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Box title="Chỉ đối thủ có (cơ hội)" items={result.onlyOther} color="amber" />
        <Box title="Cả hai cùng có" items={result.both} color="cyan" />
        <Box title="Chỉ bạn có" items={result.onlyMine} color="emerald" />
      </div>

      {(result.onlyOther.length || result.onlyMine.length || result.both.length) > 0 && (
        <div className="text-right">
          <button onClick={handleExport} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
            <Download size={14} /> CSV tổng hợp
          </button>
        </div>
      )}
    </ToolShell>
  );
}

function Box({ title, items, color }: { title: string; items: string[]; color: "amber" | "cyan" | "emerald" }) {
  const tone = color === "amber" ? "bg-amber-500/10 text-amber-300" : color === "emerald" ? "bg-emerald-500/10 text-emerald-300" : "bg-cyan-500/10 text-cyan-300";
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
      <h3 className="text-xs font-black uppercase mb-2" style={{ color: "var(--text-muted)" }}>{title} · {items.length}</h3>
      <div className="flex flex-wrap gap-1 max-h-72 overflow-auto">
        {items.slice(0, 200).map((k) => (
          <span key={k} className={`text-[11px] font-mono px-2 py-0.5 rounded ${tone}`}>{k}</span>
        ))}
        {items.length === 0 && <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>—</span>}
      </div>
    </div>
  );
}
