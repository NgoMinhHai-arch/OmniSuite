"use client";

import { useMemo, useState } from "react";
import { Copy, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsText } from "@/lib/seo/csv";

function buildSitemap(urls: string[], priority: number, freq: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  urls.forEach((u) => {
    lines.push("  <url>");
    lines.push(`    <loc>${u}</loc>`);
    lines.push(`    <lastmod>${today}</lastmod>`);
    lines.push(`    <changefreq>${freq}</changefreq>`);
    lines.push(`    <priority>${priority.toFixed(1)}</priority>`);
    lines.push("  </url>");
  });
  lines.push("</urlset>");
  return lines.join("\n");
}

export default function BestSellingSitemapPage() {
  const [raw, setRaw] = useState("");
  const [priority, setPriority] = useState(0.9);
  const [freq, setFreq] = useState("daily");

  const urls = useMemo(
    () =>
      raw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((u) => u.startsWith("http")),
    [raw]
  );
  const xml = useMemo(() => buildSitemap(urls, priority, freq), [urls, priority, freq]);

  return (
    <ToolShell
      title="Best Sellers Sitemap"
      description="Xuất sitemap XML chuyên cho danh sách URL bán chạy với priority/changefreq cao để thúc đẩy crawl."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          placeholder="https://shop.example.com/best-product-1"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            Priority:
            <input
              type="number"
              step={0.1}
              min={0.1}
              max={1}
              value={priority}
              onChange={(e) => setPriority(Math.max(0.1, Math.min(1, Number(e.target.value) || 0.5)))}
              className="w-20 rounded-lg px-2 py-1 text-sm font-bold text-cyan-400"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)" }}
            />
          </label>
          <label className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            Changefreq:
            <select
              value={freq}
              onChange={(e) => setFreq(e.target.value)}
              className="rounded-lg px-2 py-1 text-sm font-bold"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            >
              <option>always</option>
              <option>hourly</option>
              <option>daily</option>
              <option>weekly</option>
              <option>monthly</option>
              <option>yearly</option>
              <option>never</option>
            </select>
          </label>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{urls.length} URL hợp lệ</span>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
          <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>sitemap.xml</h3>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(xml)}
              disabled={!urls.length}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold"
            >
              <Copy size={14} /> Copy
            </button>
            <button
              onClick={() => downloadAsText("best-sellers-sitemap.xml", xml, "application/xml")}
              disabled={!urls.length}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold"
            >
              <Download size={14} /> Tải XML
            </button>
          </div>
        </div>
        <pre className="p-4 text-xs font-mono whitespace-pre-wrap overflow-x-auto" style={{ color: "var(--text-secondary)" }}>
          {xml}
        </pre>
      </div>
    </ToolShell>
  );
}
