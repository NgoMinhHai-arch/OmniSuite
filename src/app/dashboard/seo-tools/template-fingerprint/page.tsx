"use client";

import { useState } from "react";
import { Loader2, Play, Layers } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";

interface Cluster { signature: string; urls: { url: string; size: number }[] }

export default function TemplateFingerprintPage() {
  const [raw, setRaw] = useState("");
  const [running, setRunning] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setClusters([]);
    try {
      const urls = raw.split(/\r?\n/).map((s) => s.trim()).filter((u) => u.startsWith("http"));
      const resp = await fetch("/api/seo/template-fingerprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Lỗi fetch");
      setClusters(data.clusters || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  return (
    <ToolShell
      title="Template Fingerprint"
      description="Cluster URL theo cấu trúc HTML để phát hiện template chung — hữu ích cho audit SEO trên nhóm trang giống nhau."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          placeholder="https://shop.example.com/p1"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <button onClick={handleRun} disabled={running || !raw.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? "Đang fetch..." : "Phân tích"}
        </button>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>

      {clusters.map((c, i) => (
        <div key={i} className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
          <h3 className="text-sm font-black flex items-center gap-2 mb-2" style={{ color: "var(--text-primary)" }}>
            <Layers size={14} className="text-cyan-400" /> Template #{i + 1} · {c.urls.length} URL
          </h3>
          <p className="text-[10px] font-mono truncate mb-2" style={{ color: "var(--text-muted)" }}>{c.signature.slice(0, 200)}...</p>
          <ul className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
            {c.urls.map((u) => (
              <li key={u.url} className="flex justify-between gap-2">
                <span className="truncate font-mono">{u.url}</span>
                <span className="opacity-70 shrink-0">{(u.size / 1024).toFixed(1)} KB</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </ToolShell>
  );
}
