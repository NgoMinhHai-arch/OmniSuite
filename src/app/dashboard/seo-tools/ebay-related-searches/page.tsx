"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";

export default function EbayRelatedSearchesPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!query.trim()) return;
    setRunning(true);
    setError(null);
    setItems([]);
    try {
      const resp = await fetch("/api/seo/ebay-related", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Lỗi");
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  return (
    <ToolShell
      title="eBay Related Searches"
      description="Trích related searches từ trang kết quả eBay (HTML). Hữu ích cho ý tưởng từ khóa thương mại."
      requires={[]}
    >
      <div className="rounded-2xl p-6 flex gap-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRun()}
          placeholder="iphone 15 pro max" className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <button onClick={handleRun} disabled={running || !query.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? "Đang fetch..." : "Tìm"}
        </button>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {items.length > 0 && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
          <h3 className="text-xs font-black uppercase mb-3" style={{ color: "var(--text-muted)" }}>{items.length} gợi ý</h3>
          <div className="flex flex-wrap gap-2">
            {items.map((it) => (
              <span key={it} className="text-xs font-mono px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-300">{it}</span>
            ))}
          </div>
        </div>
      )}
    </ToolShell>
  );
}
