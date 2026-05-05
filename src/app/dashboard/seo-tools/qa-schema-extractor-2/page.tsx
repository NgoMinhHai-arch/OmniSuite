"use client";

import { useState } from "react";
import { Loader2, Play, AlertTriangle, MessageCircleQuestion, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface FAQ { q: string; a: string }
interface ResultRow { url: string; ok: boolean; error?: string; faqs?: FAQ[]; rawCount?: number }

export default function QaSchemaExtractorPage() {
  const [raw, setRaw] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResults([]);
    try {
      const urls = raw.split(/\r?\n/).map((s) => s.trim()).filter((u) => u.startsWith("http"));
      const resp = await fetch("/api/seo/qa-schema-extractor", {
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
    results.forEach((r) => {
      (r.faqs || []).forEach((f) => rows.push([r.url, f.q, f.a]));
    });
    downloadAsCsv("faqs.csv", ["URL", "Question", "Answer"], rows);
  };

  return (
    <ToolShell
      title="Q&A Schema Extractor"
      description="Bóc tách FAQ JSON-LD từ các URL bạn cung cấp."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          placeholder="https://example.com/faq"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <div className="flex items-center gap-2">
          <button onClick={handleRun} disabled={running || !raw.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "Đang trích..." : "Trích FAQ"}
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
            <p className="text-xs text-rose-400 flex items-center gap-1"><AlertTriangle size={12} /> {r.error}</p>
          ) : (r.faqs?.length || 0) === 0 ? (
            <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>Không phát hiện FAQ JSON-LD ({r.rawCount} script ld+json).</p>
          ) : (
            <ul className="space-y-2">
              {r.faqs!.map((f, i) => (
                <li key={i} className="text-sm">
                  <p className="font-bold flex items-start gap-2" style={{ color: "var(--text-primary)" }}>
                    <MessageCircleQuestion size={14} className="text-cyan-400 mt-0.5" /> {f.q}
                  </p>
                  <p className="ml-6 mt-1" style={{ color: "var(--text-secondary)" }}>{f.a}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </ToolShell>
  );
}
