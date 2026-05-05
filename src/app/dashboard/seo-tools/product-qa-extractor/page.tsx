"use client";

import { useState } from "react";
import { Loader2, Play, Download, MessageSquare } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface QA { q: string; a: string }
interface Row { url: string; ok: boolean; error?: string; qas?: QA[] }

export default function ProductQaExtractorPage() {
  const [raw, setRaw] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResults([]);
    try {
      const urls = raw.split(/\r?\n/).map((s) => s.trim()).filter((u) => u.startsWith("http"));
      const resp = await fetch("/api/seo/product-qa-extractor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
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
    results.forEach((r) => (r.qas || []).forEach((qa) => rows.push([r.url, qa.q, qa.a])));
    downloadAsCsv("product-qa.csv", ["URL", "Question", "Answer"], rows);
  };

  return (
    <ToolShell
      title="Product Q&A Extractor"
      description="Trích Q&A / FAQ từ trang sản phẩm: kết hợp JSON-LD và heuristic CSS selector."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={6}
          placeholder="https://shop.example.com/product/123"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <div className="flex items-center gap-2">
          <button onClick={handleRun} disabled={running || !raw.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "Đang trích..." : "Trích Q&A"}
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
        <div key={r.url} className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
          <p className="text-sm font-mono truncate" style={{ color: "var(--text-primary)" }}>{r.url}</p>
          {!r.ok ? (
            <p className="text-xs text-rose-400">{r.error}</p>
          ) : (r.qas?.length || 0) === 0 ? (
            <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>Không phát hiện Q&A trên trang này.</p>
          ) : (
            <ul className="space-y-2">
              {r.qas!.map((qa, i) => (
                <li key={i}>
                  <p className="font-bold flex items-start gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
                    <MessageSquare size={14} className="text-cyan-400 mt-0.5" /> {qa.q}
                  </p>
                  <p className="ml-6 text-sm" style={{ color: "var(--text-secondary)" }}>{qa.a}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </ToolShell>
  );
}
