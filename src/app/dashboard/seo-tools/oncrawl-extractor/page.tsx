"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";

interface Crawl { id?: string; status?: string; created_at?: string; nb_crawled_urls?: number; name?: string }

export default function OncrawlExtractorPage() {
  const [running, setRunning] = useState(false);
  const [crawls, setCrawls] = useState<Crawl[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setCrawls([]);
    try {
      const local = JSON.parse(localStorage.getItem("omnisuite_settings") || "{}");
      const resp = await fetch("/api/seo/oncrawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: local.oncrawl_api_key, projectId: local.oncrawl_project_id }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Lỗi");
      setCrawls(data?.crawls || data?.data || data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  return (
    <ToolShell
      title="OnCrawl Extractor"
      description="Lấy 20 crawl gần nhất của project OnCrawl đã cấu hình."
      requires={["oncrawl"]}
    >
      <button onClick={handleRun} disabled={running}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
        {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
        {running ? "Đang gọi OnCrawl..." : "Lấy danh sách crawl"}
      </button>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {crawls.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Status</th><th className="text-right p-3">URLs</th><th className="text-left p-3">Created</th></tr>
            </thead>
            <tbody>
              {crawls.map((c, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3" style={{ color: "var(--text-primary)" }}>{c.name || c.id}</td>
                  <td className="p-3 text-xs" style={{ color: "var(--text-secondary)" }}>{c.status}</td>
                  <td className="p-3 text-right font-mono">{c.nb_crawled_urls ?? "—"}</td>
                  <td className="p-3 text-xs" style={{ color: "var(--text-muted)" }}>{c.created_at?.slice(0, 10) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
