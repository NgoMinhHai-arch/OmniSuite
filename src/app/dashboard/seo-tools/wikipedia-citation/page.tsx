"use client";

import { useState } from "react";
import { Loader2, Play, ExternalLink } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";

interface Hit { title: string; pageid: number; snippet: string; url: string }

export default function WikipediaCitationPage() {
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState("vi");
  const [hits, setHits] = useState<Hit[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!query.trim()) return;
    setRunning(true);
    setError(null);
    setHits([]);
    try {
      const resp = await fetch("/api/seo/wikipedia-citation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), lang }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Lỗi");
      setHits(data.hits || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  return (
    <ToolShell
      title="Wikipedia Citation"
      description="Tìm bài Wikipedia liên quan để có cơ hội đặt citation/trích nguồn."
      requires={[]}
    >
      <div className="rounded-2xl p-6 flex flex-wrap items-center gap-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRun()}
          placeholder="hiệu ứng nhà kính" className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-xl px-3 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}>
          <option value="vi">vi</option>
          <option value="en">en</option>
          <option value="ja">ja</option>
          <option value="ko">ko</option>
          <option value="zh">zh</option>
        </select>
        <button onClick={handleRun} disabled={running || !query.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Tìm
        </button>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <div className="space-y-2">
        {hits.map((h) => (
          <a key={h.pageid} href={h.url} target="_blank" rel="noreferrer" className="block rounded-2xl p-4 hover:opacity-80"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
            <p className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>{h.title} <ExternalLink size={12} className="text-cyan-400" /></p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{h.snippet}</p>
          </a>
        ))}
      </div>
    </ToolShell>
  );
}
