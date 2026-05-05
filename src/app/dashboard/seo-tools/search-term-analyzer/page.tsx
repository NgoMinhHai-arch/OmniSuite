"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv, parseCsv } from "@/lib/seo/csv";

interface Row {
  term: string;
  cost: number;
  conv: number;
  clicks: number;
  cpa: number;
}

function parseInput(raw: string): Row[] {
  const rows = parseCsv(raw);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const idxTerm = header.findIndex((h) => /search.term|term|keyword/.test(h));
  const idxCost = header.findIndex((h) => /^cost$|spend|chi/.test(h));
  const idxClicks = header.findIndex((h) => /click/.test(h));
  const idxConv = header.findIndex((h) => /conv|chuy/.test(h));

  if (idxTerm === -1) return [];
  return rows
    .slice(1)
    .map((r) => {
      const cost = idxCost >= 0 ? Number(String(r[idxCost] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      const conv = idxConv >= 0 ? Number(String(r[idxConv] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      const clicks = idxClicks >= 0 ? Number(String(r[idxClicks] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      return {
        term: (r[idxTerm] || "").trim(),
        cost,
        conv,
        clicks,
        cpa: conv > 0 ? cost / conv : 0,
      } satisfies Row;
    })
    .filter((r) => r.term);
}

export default function SearchTermAnalyzerPage() {
  const [raw, setRaw] = useState("");
  const [maxCpaTarget, setMaxCpaTarget] = useState(50);

  const rows = useMemo(() => parseInput(raw), [raw]);

  const negatives = useMemo(
    () => rows.filter((r) => r.cost > 0 && r.conv === 0 && r.clicks >= 5).sort((a, b) => b.cost - a.cost),
    [rows]
  );
  const overspend = useMemo(
    () =>
      rows
        .filter((r) => r.conv > 0 && r.cpa > maxCpaTarget)
        .sort((a, b) => b.cpa - a.cpa),
    [rows, maxCpaTarget]
  );
  const winners = useMemo(
    () =>
      rows
        .filter((r) => r.conv > 0 && r.cpa > 0 && r.cpa <= maxCpaTarget)
        .sort((a, b) => b.conv - a.conv)
        .slice(0, 50),
    [rows, maxCpaTarget]
  );

  return (
    <ToolShell
      title="Search Term Analyzer"
      description="Dán Google Ads Search Terms report (CSV) để chia search term thành: nên loại, vượt CPA mục tiêu, và đang thắng."
      requires={[]}
    >
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          placeholder="Search term,Clicks,Cost,Conversions"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
            CPA mục tiêu:
            <input
              type="number"
              value={maxCpaTarget}
              onChange={(e) => setMaxCpaTarget(Number(e.target.value) || 0)}
              className="ml-2 w-24 rounded-lg px-2 py-1 text-sm font-bold text-cyan-400"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)" }}
            />
          </label>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{rows.length} dòng đã parse</span>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SectionCard title="Đề xuất NEGATIVE" hint="Click ≥ 5, không có conversion" rows={negatives.slice(0, 50)} csvName="negatives.csv" />
          <SectionCard title="Vượt CPA mục tiêu" hint={`CPA > ${maxCpaTarget}`} rows={overspend.slice(0, 50)} csvName="overspend.csv" />
          <SectionCard title="Đang thắng" hint={`CPA ≤ ${maxCpaTarget}`} rows={winners} csvName="winners.csv" highlight />
        </div>
      )}
    </ToolShell>
  );
}

function SectionCard({ title, hint, rows, csvName, highlight }: { title: string; hint: string; rows: Row[]; csvName: string; highlight?: boolean }) {
  const handle = () =>
    downloadAsCsv(csvName, ["Term", "Clicks", "Cost", "Conv", "CPA"], rows.map((r) => [r.term, r.clicks, r.cost, r.conv, r.cpa.toFixed(2)]));
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: highlight ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(6,182,212,0.12)" }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{title}</h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{hint} · {rows.length} term</p>
        </div>
        <button
          onClick={handle}
          disabled={!rows.length}
          className="text-xs font-bold flex items-center gap-1 text-cyan-400 hover:text-cyan-300 disabled:opacity-40"
        >
          <Download size={12} /> CSV
        </button>
      </div>
      <ul className="text-xs space-y-1 max-h-72 overflow-auto" style={{ color: "var(--text-secondary)" }}>
        {rows.slice(0, 25).map((r) => (
          <li key={r.term} className="flex justify-between gap-2">
            <span className="truncate">{r.term}</span>
            <span className="font-mono opacity-70 shrink-0">${r.cost.toFixed(0)} · {r.conv}c</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
