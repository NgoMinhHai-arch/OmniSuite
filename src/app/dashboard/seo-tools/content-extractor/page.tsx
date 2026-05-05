"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Globe,
  Download,
  Settings,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle,
  Trash2,
  Upload,
  ExternalLink,
  Database,
  Clock,
  BarChart3,
} from "lucide-react";

interface ExtractedContent {
  url: string;
  title: string | null;
  h1: string | null;
  content: string | null;
  contentLength: number;
  status: "success" | "failed";
  error: string | null;
  metaDescription: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  wordCount: number;
}

interface Config {
  rateLimit: number;
  maxWorkers: number;
  timeout: number;
  userAgent: string;
  includeMeta: boolean;
  includeOG: boolean;
}

const defaultConfig: Config = {
  rateLimit: 1,
  maxWorkers: 3,
  timeout: 10,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  includeMeta: true,
  includeOG: true,
};

function generateCSV(data: ExtractedContent[]) {
  const headers = [
    "URL",
    "Title",
    "H1",
    "Meta Description",
    "Canonical",
    "OG Title",
    "OG Description",
    "Content Length",
    "Word Count",
    "Status",
    "Error",
    "Content Preview",
  ];

  const rows = data.map((item) => [
    item.url,
    item.title || "",
    item.h1 || "",
    item.metaDescription || "",
    item.canonical || "",
    item.ogTitle || "",
    item.ogDescription || "",
    item.contentLength,
    item.wordCount,
    item.status,
    item.error || "",
    item.content ? item.content.substring(0, 500) : "",
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");

  return csvContent;
}

function downloadCSV(data: ExtractedContent[]) {
  const csv = generateCSV(data);
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `content-extract-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function ContentExtractor() {
  const [urls, setUrls] = useState<string>("");
  const [results, setResults] = useState<ExtractedContent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [showConfig, setShowConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractFromUrl = async (url: string): Promise<ExtractedContent> => {
    try {
      const response = await fetch("/api/seo/content-extractor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          timeout: config.timeout,
          userAgent: config.userAgent,
          includeMeta: config.includeMeta,
          includeOG: config.includeOG,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        url,
        ...data,
        status: data.success ? "success" : "failed",
      };
    } catch (err) {
      return {
        url,
        title: null,
        h1: null,
        content: null,
        contentLength: 0,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
        metaDescription: null,
        canonical: null,
        ogTitle: null,
        ogDescription: null,
        wordCount: 0,
      };
    }
  };

  const processUrls = useCallback(async () => {
    const urlList = urls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u && u.startsWith("http"));

    if (urlList.length === 0) {
      setError("Please enter at least one valid URL starting with http:// or https://");
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress({ current: 0, total: urlList.length });
    setResults([]);

    const newResults: ExtractedContent[] = [];

    for (let i = 0; i < urlList.length; i += config.maxWorkers) {
      const batch = urlList.slice(i, i + config.maxWorkers);
      const batchPromises = batch.map(async (url, index) => {
        await new Promise((resolve) => setTimeout(resolve, index * config.rateLimit * 1000));
        const result = await extractFromUrl(url);
        return result;
      });

      const batchResults = await Promise.all(batchPromises);
      newResults.push(...batchResults);
      setResults([...newResults]);
      setProgress({ current: Math.min(i + config.maxWorkers, urlList.length), total: urlList.length });

      if (i + config.maxWorkers < urlList.length) {
        await new Promise((resolve) => setTimeout(resolve, config.rateLimit * 1000));
      }
    }

    setIsLoading(false);
    setProgress({ current: 0, total: 0 });
  }, [urls, config]);

  const clearAll = () => {
    setUrls("");
    setResults([]);
    setError(null);
    setProgress({ current: 0, total: 0 });
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
                <Database size={20} />
              </div>
              <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Content Extractor</h1>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Extract metadata, H1, and content from URLs for content audits and analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
              style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            >
              <Settings size={16} />
              Cấu hình
            </button>
            <a
              href="/dashboard/seo-tools"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              ← Quay lại
            </a>
          </div>
        </div>

        {/* Configuration Panel */}
        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-2xl p-6 overflow-hidden"
              style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}
            >
              <h3 className="text-sm font-black uppercase mb-4" style={{ color: "var(--text-primary)" }}>Cấu hình trích xuất</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    Rate Limit (giây)
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    max={5}
                    step={0.5}
                    value={config.rateLimit}
                    onChange={(e) => setConfig({ ...config, rateLimit: parseFloat(e.target.value) })}
                    className="w-full h-10 rounded-xl px-3 text-sm font-bold"
                    style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    Concurrent Requests
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={config.maxWorkers}
                    onChange={(e) => setConfig({ ...config, maxWorkers: parseInt(e.target.value) })}
                    className="w-full h-10 rounded-xl px-3 text-sm font-bold"
                    style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    Timeout (giây)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={30}
                    value={config.timeout}
                    onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) })}
                    className="w-full h-10 rounded-xl px-3 text-sm font-bold"
                    style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.includeMeta}
                    onChange={(e) => setConfig({ ...config, includeMeta: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>Include Meta Tags</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.includeOG}
                    onChange={(e) => setConfig({ ...config, includeOG: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>Include Open Graph</span>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Section */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>URLs cần trích xuất</h3>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {urls.split("\n").filter((u) => u.trim().startsWith("http")).length} URLs
            </span>
          </div>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="https://example.com/page1&#10;https://example.com/page2&#10;https://example.com/page3"
            rows={8}
            className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Nhập mỗi URL trên một dòng. Tool sẽ tự động trích xuất Title, H1, Meta Description, và nội dung chính.
          </p>

          {error && (
            <div className="mt-4 rounded-xl p-3 border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center gap-2 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={processUrls}
              disabled={isLoading || !urls.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-all"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {isLoading ? `Đang xử lý ${progress.current}/${progress.total}` : "Bắt đầu trích xuất"}
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
            {results.length > 0 && (
              <button
                onClick={() => downloadCSV(results)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all ml-auto"
              >
                <Download size={16} />
                Tải CSV
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {isLoading && progress.total > 0 && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Tiến độ xử lý</span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--hover-bg)" }}>
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Results Summary */}
        {results.length > 0 && !isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Database size={16} className="text-cyan-400" />
                <span className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Tổng URLs</span>
              </div>
              <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>{results.length}</span>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={16} className="text-emerald-400" />
                <span className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Thành công</span>
              </div>
              <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>{successCount}</span>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={16} className="text-rose-400" />
                <span className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Thất bại</span>
              </div>
              <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>{failedCount}</span>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={16} className="text-indigo-400" />
                <span className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Avg Content Length</span>
              </div>
              <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                {Math.round(results.filter((r) => r.contentLength > 0).reduce((acc, r) => acc + r.contentLength, 0) / Math.max(successCount, 1)).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
              <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>Kết quả trích xuất</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs font-black uppercase" style={{ color: "var(--text-muted)", borderBottom: "1px solid rgba(6,182,212,0.1)" }}>
                    <th className="p-4 text-left">URL</th>
                    <th className="p-4 text-left">Title</th>
                    <th className="p-4 text-left">H1</th>
                    <th className="p-4 text-left">Meta Description</th>
                    <th className="p-4 text-right">Content</th>
                    <th className="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index} className="text-sm" style={{ borderBottom: "1px solid rgba(6,182,212,0.05)" }}>
                      <td className="p-4">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          <span className="truncate max-w-[200px]">{result.url}</span>
                          <ExternalLink size={12} />
                        </a>
                      </td>
                      <td className="p-4">
                        <span className="truncate max-w-[200px] block" style={{ color: "var(--text-primary)" }}>
                          {result.title || "—"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="truncate max-w-[200px] block" style={{ color: "var(--text-secondary)" }}>
                          {result.h1 || "—"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="truncate max-w-[250px] block text-xs" style={{ color: "var(--text-muted)" }}>
                          {result.metaDescription || "—"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                          {result.contentLength.toLocaleString()} chars
                          <br />
                          {result.wordCount.toLocaleString()} words
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {result.status === "success" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400">
                            <CheckCircle size={12} />
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400" title={result.error || ""}>
                            <AlertCircle size={12} />
                            FAIL
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
