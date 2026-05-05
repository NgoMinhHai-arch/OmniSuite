"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv, parseCsv } from "@/lib/seo/csv";

interface InRow { url: string; clicks: number; impressions: number; tx: number; }
interface OutRow extends InRow { decision: "Giữ" | "Cập nhật" | "Redirect" | "Xóa"; reason: string; }

function parseInput(raw: string): InRow[] {
  const rows = parseCsv(raw);
  if (!rows.length) return [];
  const h = rows[0].map((c) => c.toLowerCase());
  const idxUrl = h.findIndex((c) => /url|page/.test(c));
  const idxClicks = h.findIndex((c) => /click/.test(c));
  const idxImp = h.findIndex((c) => /impression|hi[eê]?n/.test(c));
  const idxTx = h.findIndex((c) => /tx|transaction|conv|sale/.test(c));
  if (idxUrl === -1) return [];
  return rows.slice(1).map((r) => ({
    url: (r[idxUrl] || "").trim(),
    clicks: idxClicks >= 0 ? Number(String(r[idxClicks] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0,
    impressions: idxImp >= 0 ? Number(String(r[idxImp] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0,
    tx: idxTx >= 0 ? Number(String(r[idxTx] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0,
  })).filter((r) => r.url);
}

function decide(row: InRow): { decision: OutRow["decision"]; reason: string } {
  if (row.tx >= 1) return { decision: "Giữ", reason: "Có chuyển đổi" };
  if (row.clicks >= 30) return { decision: "Giữ", reason: "Traffic ổn" };
  if (row.clicks >= 5 && row.impressions >= 200) return { decision: "Cập nhật", reason: "Có hiển thị, chưa đủ click" };
  if (row.impressions >= 30) return { decision: "Redirect", reason: "Có impression nhỏ → gộp về trang liên quan" };
  return { decision: "Xóa", reason: "Không có hiệu năng nào" };
}

export default function PageRetirementPlannerPage() {
  const [raw, setRaw] = useState("");
  const out: OutRow[] = useMemo(() => parseInput(raw).map((r) => ({ ...r, ...decide(r) })), [raw]);

  const handleExport = () => {
    if (!out.length) return;
    downloadAsCsv(
      "page-retirement.csv",
      ["URL", "Clicks", "Impressions", "Transactions", "Decision", "Reason"],
      out.map((r) => [r.url, r.clicks, r.impressions, r.tx, r.decision, r.reason])
    );
  };

  const grouped = useMemo(() => {
    const m: Record<OutRow["decision"], number> = { "Giữ": 0, "Cập nhật": 0, "Redirect": 0, "Xóa": 0 };
    out.forEach((r) => { m[r.decision] += 1; });
    return m;
  }, [out]);

  return (
    <ToolShell
      title="Page Retirement Planner"
      description="Quyết định Giữ / Cập nhật / Redirect / Xóa cho từng URL dựa trên Clicks, Impressions, Transactions."
      requires={[]}
    >
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <label className="text-xs font-black uppercase block mb-2" style={{ color: "var(--text-muted)" }}>
          CSV: URL, Clicks, Impressions, Transactions
        </label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
      </div>

      {out.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(Object.keys(grouped) as OutRow["decision"][]).map((k) => (
              <div key={k} className="rounded-xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
                <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>{k}</p>
                <p className="text-2xl font-black text-cyan-400">{grouped[k]}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
              <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>Quyết định ({out.length})</h3>
              <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                <Download size={14} /> CSV
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
                <tr><th className="text-left p-3">URL</th><th className="text-right p-3">Clicks</th><th className="text-right p-3">Impr</th><th className="text-right p-3">Tx</th><th className="text-center p-3">Decision</th></tr>
              </thead>
              <tbody>
                {out.slice(0, 300).map((r) => (
                  <tr key={r.url} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                    <td className="p-3 truncate max-w-[300px]" style={{ color: "var(--text-primary)" }}>{r.url}</td>
                    <td className="p-3 text-right font-mono">{r.clicks}</td>
                    <td className="p-3 text-right font-mono">{r.impressions}</td>
                    <td className="p-3 text-right font-mono">{r.tx}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          r.decision === "Giữ" ? "bg-emerald-500/10 text-emerald-400" :
                          r.decision === "Cập nhật" ? "bg-cyan-500/10 text-cyan-400" :
                          r.decision === "Redirect" ? "bg-amber-500/10 text-amber-400" :
                          "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        {r.decision}
                      </span>
                    </td>
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
