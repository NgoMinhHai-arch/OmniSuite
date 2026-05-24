"use client";

import { useState } from "react";
import { Loader2, Play, Copy, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsText } from "@/lib/seo/csv";

export default function FirecrawlMarkdownScraperPage() {
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setMarkdown("");
    try {
      const local = JSON.parse(localStorage.getItem("omnisuite_settings") || "{}");
      const resp = await fetch("/api/seo/firecrawl-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), apiKey: local.firecrawl_api_key, formats: ["markdown"] }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Lỗi");
      setMarkdown(data.markdown || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  return (
    <ToolShell
      title="Firecrawl Markdown Scraper"
      description="Crawl 1 URL và lấy phần nội dung chính dưới dạng Markdown sạch (qua Firecrawl API)."
      requires={["firecrawl"]}
    >
      <div className="rounded-2xl p-6 flex gap-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article"
          className="flex-1 rounded-xl px-4 py-2.5 text-sm font-mono"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <button onClick={handleRun} disabled={running || !url.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? "Đang scrape..." : "Scrape"}
        </button>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {markdown && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
            <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>Markdown ({markdown.length} ký tự)</h3>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(markdown)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold">
                <Copy size={12} /> Copy
              </button>
              <button onClick={() => downloadAsText("scraped.md", markdown, "text/markdown")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                <Download size={12} /> .md
              </button>
            </div>
          </div>
          <pre className="p-4 text-xs whitespace-pre-wrap font-mono max-h-[600px] overflow-auto" style={{ color: "var(--text-secondary)" }}>{markdown}</pre>
        </div>
      )}
    </ToolShell>
  );
}
