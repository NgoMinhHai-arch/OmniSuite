"use client";

import { useMemo, useState } from "react";
import { ToolShell } from "@/components/seo/ToolShell";
import { rankBySimilarity } from "@/lib/seo/embeddings";
import { downloadAsCsv, parseCsv } from "@/lib/seo/csv";
import { Download } from "lucide-react";

interface Row {
  product: string;
  breadcrumb: string;
  score: number;
  status: "ok" | "warn" | "bad";
}

function parseInput(raw: string): { product: string; breadcrumb: string }[] {
  const rows = parseCsv(raw);
  if (!rows.length) return [];
  const headerLooksReal = /product|title|tên/i.test(rows[0]?.[0] || "");
  return rows
    .slice(headerLooksReal ? 1 : 0)
    .map((r) => ({ product: (r[0] || "").trim(), breadcrumb: (r[1] || "").trim() }))
    .filter((r) => r.product && r.breadcrumb);
}

export default function BreadcrumbRelevancyCheckerPage() {
  const [raw, setRaw] = useState("");

  const rows = useMemo<Row[]>(() => {
    const parsed = parseInput(raw);
    return parsed.map((p) => {
      const score = rankBySimilarity(p.product, [p.breadcrumb])[0]?.score ?? 0;
      const status: Row["status"] = score >= 0.35 ? "ok" : score >= 0.18 ? "warn" : "bad";
      return { ...p, score, status };
    });
  }, [raw]);

  const handleExport = () => {
    if (!rows.length) return;
    downloadAsCsv(
      "breadcrumb-relevancy.csv",
      ["Product", "Breadcrumb", "Score", "Status"],
      rows.map((r) => [r.product, r.breadcrumb, r.score.toFixed(3), r.status])
    );
  };

  return (
    <ToolShell
      title="Breadcrumb Relevancy Checker"
      description="So khớp tên sản phẩm với breadcrumb để tìm ra các sản phẩm bị xếp nhầm danh mục."
      requires={[]}
    >
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <label className="text-xs font-black uppercase block mb-2" style={{ color: "var(--text-muted)" }}>
          CSV: Product, Breadcrumb (mỗi dòng 1 cặp)
        </label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          placeholder={"Áo sơ mi nam tay dài,Thời trang > Nam > Áo\nGiày sneaker nữ,Thời trang > Nam"}
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
      </div>

      {rows.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
            <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>Kết quả ({rows.length})</h3>
            <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
              <Download size={14} /> CSV
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr>
                <th className="text-left p-3">Product</th>
                <th className="text-left p-3">Breadcrumb</th>
                <th className="text-right p-3">Score</th>
                <th className="text-center p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3" style={{ color: "var(--text-primary)" }}>{r.product}</td>
                  <td className="p-3 text-xs" style={{ color: "var(--text-secondary)" }}>{r.breadcrumb}</td>
                  <td className="p-3 text-right font-mono">{r.score.toFixed(2)}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        r.status === "ok" ? "bg-emerald-500/10 text-emerald-400" : r.status === "warn" ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
