"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv, parseCsv } from "@/lib/seo/csv";

interface Row {
  url: string;
  links: number;
  transactions: number;
  ratio: number;
}

function parseInput(raw: string): Row[] {
  const rows = parseCsv(raw);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  const idxUrl = header.findIndex((h) => /url|page|landing/.test(h));
  const idxLinks = header.findIndex((h) => /link|backlink|inlink/.test(h));
  const idxTx = header.findIndex((h) => /transaction|conversion|sale|order|đơn/.test(h));
  if (idxUrl === -1 || idxTx === -1) return [];
  return rows
    .slice(1)
    .map((r) => {
      const links = idxLinks >= 0 ? Number(String(r[idxLinks] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      const tx = Number(String(r[idxTx] || "0").replace(/[^0-9.\-]/g, "")) || 0;
      return { url: (r[idxUrl] || "").trim(), links, transactions: tx, ratio: links > 0 ? tx / links : tx };
    })
    .filter((r) => r.url);
}

export default function LowLinksHighTransactionsPage() {
  const [raw, setRaw] = useState("");
  const rows = useMemo(() => parseInput(raw), [raw]);

  const flagged = useMemo(
    () =>
      rows
        .filter((r) => r.transactions >= 1 && r.links <= 3)
        .sort((a, b) => b.transactions - a.transactions),
    [rows]
  );

  const handleExport = () => {
    if (!flagged.length) return;
    downloadAsCsv("low-links-high-tx.csv", ["URL", "Links", "Transactions"], flagged.map((r) => [r.url, r.links, r.transactions]));
  };

  return (
    <ToolShell
      title="Low Links — High Transactions"
      description="Phát hiện trang có nhiều giao dịch nhưng ít backlink/internal link → ưu tiên đẩy thêm link để tăng thêm doanh thu."
      requires={[]}
    >
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <label className="text-xs font-black uppercase block mb-2" style={{ color: "var(--text-muted)" }}>
          CSV: URL, Links, Transactions
        </label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          placeholder={"URL,Links,Transactions\nhttps://shop.example.com/p1,2,18"}
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
      </div>

      {flagged.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
            <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>Cần ưu tiên đẩy link ({flagged.length})</h3>
            <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
              <Download size={14} /> CSV
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr><th className="text-left p-3">URL</th><th className="text-right p-3">Links</th><th className="text-right p-3">Transactions</th></tr>
            </thead>
            <tbody>
              {flagged.slice(0, 200).map((r) => (
                <tr key={r.url} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3 truncate max-w-[400px]" style={{ color: "var(--text-primary)" }}>{r.url}</td>
                  <td className="p-3 text-right font-mono">{r.links}</td>
                  <td className="p-3 text-right font-mono text-emerald-400">{r.transactions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
