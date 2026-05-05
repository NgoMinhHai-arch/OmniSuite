"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Map,
  Globe,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  Trash2,
  ExternalLink,
  Database,
  Layers,
  FileJson,
  Filter,
  Search,
} from "lucide-react";

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

interface SitemapInfo {
  url: string;
  isIndex: boolean;
  urls: SitemapUrl[];
  children: SitemapInfo[];
}

export default function SitemapExtractor() {
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [results, setResults] = useState<SitemapInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const extractSitemap = async () => {
    if (!sitemapUrl.trim()) {
      setError("Please enter a sitemap URL");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch("/api/seo/sitemap-extractor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sitemapUrl: sitemapUrl.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to extract sitemap");
      }

      const data = await response.json();
      setResults([data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const getAllUrls = (infos: SitemapInfo[]): SitemapUrl[] => {
    let urls: SitemapUrl[] = [];
    for (const info of infos) {
      urls = urls.concat(info.urls);
      if (info.children.length > 0) {
        urls = urls.concat(getAllUrls(info.children));
      }
    }
    return urls;
  };

  const getTotalSitemaps = (infos: SitemapInfo[]): number => {
    let count = infos.length;
    for (const info of infos) {
      count += getTotalSitemaps(info.children);
    }
    return count;
  };

  const downloadCSV = () => {
    const allUrls = getAllUrls(results);
    const filteredUrls = filter
      ? allUrls.filter((u) => u.loc.toLowerCase().includes(filter.toLowerCase()))
      : allUrls;

    if (filteredUrls.length === 0) return;

    const headers = ["URL", "Last Modified", "Change Frequency", "Priority"];
    const rows = filteredUrls.map((u) => [u.loc, u.lastmod || "", u.changefreq || "", u.priority || ""]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sitemap-urls-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const downloadTxt = () => {
    const allUrls = getAllUrls(results);
    const filteredUrls = filter
      ? allUrls.filter((u) => u.loc.toLowerCase().includes(filter.toLowerCase()))
      : allUrls;

    if (filteredUrls.length === 0) return;

    const content = filteredUrls.map((u) => u.loc).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sitemap-urls-${new Date().toISOString().split("T")[0]}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const clearAll = () => {
    setSitemapUrl("");
    setResults([]);
    setError(null);
    setFilter("");
  };

  const allUrls = getAllUrls(results);
  const filteredUrls = filter
    ? allUrls.filter((u) => u.loc.toLowerCase().includes(filter.toLowerCase()))
    : allUrls;
  const totalSitemaps = getTotalSitemaps(results);

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
                <Map size={20} />
              </div>
              <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                Sitemap URL Extractor
              </h1>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Extract all URLs from XML sitemaps including sitemap indexes
            </p>
          </div>
          <a
            href="/dashboard/seo-tools"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            ← Quay lại
          </a>
        </div>

        {/* Input Section */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>
              Sitemap URL
            </h3>
          </div>
          <div className="relative">
            <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={sitemapUrl}
              onChange={(e) => setSitemapUrl(e.target.value)}
              placeholder="https://example.com/sitemap.xml"
              className="w-full h-12 rounded-xl pl-12 pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
              onKeyDown={(e) => e.key === "Enter" && extractSitemap()}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Nhập URL của sitemap.xml hoặc sitemap index. Tool sẽ tự động phân tích và trích xuất tất cả URLs.
          </p>

          {error && (
            <div className="mt-4 rounded-xl p-3 border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center gap-2 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={extractSitemap}
              disabled={isLoading || !sitemapUrl.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-all"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {isLoading ? "Đang trích xuất..." : "Trích xuất Sitemap"}
            </button>
            <button
              onClick={clearAll}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            >
              <Trash2 size={16} />
              Xóa tất cả
            </button>
          </div>
        </div>

        {/* Results Summary */}
        {results.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Database size={16} className="text-emerald-400" />
                  <span className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Tổng URLs</span>
                </div>
                <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                  {allUrls.length.toLocaleString()}
                </span>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Layers size={16} className="text-cyan-400" />
                  <span className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Sitemaps</span>
                </div>
                <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                  {totalSitemaps}
                </span>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Filter size={16} className="text-amber-400" />
                  <span className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Đã lọc</span>
                </div>
                <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                  {filteredUrls.length.toLocaleString()}
                </span>
              </div>
              <div className="rounded-xl p-4 flex items-center justify-end gap-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
                <button
                  onClick={downloadCSV}
                  disabled={filteredUrls.length === 0}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all"
                >
                  <Download size={14} />
                  CSV
                </button>
                <button
                  onClick={downloadTxt}
                  disabled={filteredUrls.length === 0}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all"
                >
                  <FileJson size={14} />
                  TXT
                </button>
              </div>
            </div>

            {/* Filter */}
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Lọc URLs..."
                className="w-full h-11 rounded-xl pl-12 pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Results Table */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
              <div className="p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
                <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>
                  URLs trong sitemap ({filteredUrls.length.toLocaleString()})
                </h3>
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0" style={{ backgroundColor: "var(--card-bg)" }}>
                    <tr className="text-xs font-black uppercase" style={{ color: "var(--text-muted)", borderBottom: "1px solid rgba(6,182,212,0.1)" }}>
                      <th className="p-4 text-left">URL</th>
                      <th className="p-4 text-left">Last Modified</th>
                      <th className="p-4 text-center">Change Freq</th>
                      <th className="p-4 text-right">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUrls.map((url, index) => (
                      <tr key={index} className="text-sm hover:bg-white/5 transition-colors" style={{ borderBottom: "1px solid rgba(6,182,212,0.05)" }}>
                        <td className="p-4">
                          <a href={url.loc} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                            <span className="truncate max-w-[400px]">{url.loc}</span>
                            <ExternalLink size={12} />
                          </a>
                        </td>
                        <td className="p-4">
                          <span style={{ color: "var(--text-secondary)" }}>{url.lastmod || "—"}</span>
                        </td>
                        <td className="p-4 text-center">
                          {url.changefreq ? (
                            <span className="px-2 py-1 rounded-lg text-xs font-bold bg-cyan-500/10 text-cyan-400">
                              {url.changefreq}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <span style={{ color: "var(--text-secondary)" }}>{url.priority || "—"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
