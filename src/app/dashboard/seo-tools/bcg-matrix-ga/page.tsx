"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv, parseCsv } from "@/lib/seo/csv";

interface InRow { page: string; sessions: number; revenue: number }
interface OutRow extends InRow { quadrant: "Star" | "Cash Cow" | "Question" | "Dog" }

function classify(rows: InRow[]): OutRow[] {
  if (!rows.length) return [];
  const sessionsAvg = rows.reduce((s, r) => s + r.sessions, 0) / rows.length;
  const revAvg = rows.reduce((s, r) => s + r.revenue, 0) / rows.length;
  return rows.map((r) => {
    let q: OutRow["quadrant"];
    if (r.sessions >= sessionsAvg && r.revenue >= revAvg) q = "Star";
    else if (r.sessions < sessionsAvg && r.revenue >= revAvg) q = "Cash Cow";
    else if (r.sessions >= sessionsAvg && r.revenue < revAvg) q = "Question";
    else q = "Dog";
    return { ...r, quadrant: q };
  });
}

function parseInput(raw: string): InRow[] {
  const rows = parseCsv(raw);
  if (!rows.length) return [];
  const h = rows[0].map((c) => c.toLowerCase());
  const idxPage = h.findIndex((c) => /page|landing|url/.test(c));
  const idxSessions = h.findIndex((c) => /session|users|click/.test(c));
  const idxRev = h.findIndex((c) => /revenue|tx|conv|sale/.test(c));
  if (idxPage === -1 || idxSessions === -1 || idxRev === -1) return [];
  return rows
    .slice(1)
    .map((r) => ({
      page: (r[idxPage] || "").trim(),
      sessions: Number(String(r[idxSessions] || "0").replace(/[^0-9.\-]/g, "")) || 0,
      revenue: Number(String(r[idxRev] || "0").replace(/[^0-9.\-]/g, "")) || 0,
    }))
    .filter((r) => r.page);
}

export default function BcgMatrixGaPage() {
  const [raw, setRaw] = useState("");
  const out = useMemo(() => classify(parseInput(raw)), [raw]);

  const handleExport = () => {
    if (!out.length) return;
    downloadAsCsv("bcg-matrix.csv", ["Page", "Sessions", "Revenue", "Quadrant"], out.map((r) => [r.page, r.sessions, r.revenue, r.quadrant]));
  };

  const grouped = useMemo(() => {
    const m: Record<OutRow["quadrant"], OutRow[]> = { Star: [], "Cash Cow": [], Question: [], Dog: [] };
    out.forEach((r) => m[r.quadrant].push(r));
    return m;
  }, [out]);

  return (
    <ToolShell
      title="BCG Matrix (GA)"
      description="Phân loại landing page vào 4 ô BCG dựa trên Sessions × Revenue. Dán dữ liệu xuất từ GA4."
      requires={["ga"]}
      allowRunWithoutKeys
    >
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <label className="text-xs font-black uppercase block mb-2" style={{ color: "var(--text-muted)" }}>CSV: Page, Sessions, Revenue</label>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={10}
          placeholder={"Page,Sessions,Revenue\n/p/iphone-15,3200,1450"}
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        {out.length > 0 && (
          <button onClick={handleExport} className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
            <Download size={12} /> CSV
          </button>
        )}
      </div>

      {out.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(grouped) as OutRow["quadrant"][]).map((q) => (
            <div key={q} className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
              <h3 className="text-sm font-black uppercase mb-2" style={{ color: "var(--text-primary)" }}>{q} ({grouped[q].length})</h3>
              <ul className="text-xs space-y-1 max-h-72 overflow-auto" style={{ color: "var(--text-secondary)" }}>
                {grouped[q].map((r) => (
                  <li key={r.page} className="flex justify-between gap-2">
                    <span className="truncate font-mono">{r.page}</span>
                    <span className="font-mono opacity-70 shrink-0">{r.sessions} · ${r.revenue.toFixed(0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </ToolShell>
  );
}
