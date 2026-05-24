"use client";

import { useState } from "react";
import { Loader2, Play, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface SpecRow { name: string; value: string }
interface Row { url: string; ok: boolean; error?: string; specs?: SpecRow[] }

export default function ProductSpecExtractorPage() {
  const [raw, setRaw] = useState("");
  const [rowSelector, setRowSelector] = useState("");
  const [nameSelector, setNameSelector] = useState("");
  const [valueSelector, setValueSelector] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResults([]);
    try {
      const urls = raw.split(/\r?\n/).map((s) => s.trim()).filter((u) => u.startsWith("http"));
      const selectors = rowSelector && nameSelector && valueSelector ? { row: rowSelector, name: nameSelector, value: valueSelector } : null;
      const resp = await fetch("/api/seo/product-spec-extractor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, selectors }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Không trích được");
      setResults(data.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    const rows: (string | number)[][] = [];
    results.forEach((r) => (r.specs || []).forEach((s) => rows.push([r.url, s.name, s.value])));
    downloadAsCsv("product-specs.csv", ["URL", "Spec", "Value"], rows);
  };

  return (
    <ToolShell
      title="Product Spec Extractor"
      description="Bóc bảng thông số sản phẩm. Mặc định auto-detect bảng <table>/<dl>; có thể chỉ định CSS selector tuỳ biến."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={5}
          placeholder="https://shop.example.com/product/123"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input value={rowSelector} onChange={(e) => setRowSelector(e.target.value)} placeholder=".spec-table tr (selector dòng)"
            className="rounded-lg px-3 py-2 text-sm font-mono"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
          <input value={nameSelector} onChange={(e) => setNameSelector(e.target.value)} placeholder="td:first-child (selector tên)"
            className="rounded-lg px-3 py-2 text-sm font-mono"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
          <input value={valueSelector} onChange={(e) => setValueSelector(e.target.value)} placeholder="td:last-child (selector giá trị)"
            className="rounded-lg px-3 py-2 text-sm font-mono"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Để trống cả 3 selector để dùng auto-detect.</p>
        <div className="flex items-center gap-2">
          <button onClick={handleRun} disabled={running || !raw.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "Đang chạy..." : "Trích spec"}
          </button>
          {results.length > 0 && (
            <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">
              <Download size={14} /> CSV
            </button>
          )}
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>

      {results.map((r) => (
        <div key={r.url} className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
          <p className="text-sm font-mono truncate" style={{ color: "var(--text-primary)" }}>{r.url}</p>
          {!r.ok ? (
            <p className="text-xs text-rose-400">{r.error}</p>
          ) : (r.specs?.length || 0) === 0 ? (
            <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>Không tìm thấy bảng spec.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {r.specs!.map((s, i) => (
                  <tr key={i} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                    <td className="p-2 font-bold w-1/3" style={{ color: "var(--text-primary)" }}>{s.name}</td>
                    <td className="p-2" style={{ color: "var(--text-secondary)" }}>{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </ToolShell>
  );
}
