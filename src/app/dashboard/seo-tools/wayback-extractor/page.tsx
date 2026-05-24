"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Globe,
  Download,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  Trash2,
  ExternalLink,
  Database,
  Calendar,
  Filter,
} from "lucide-react";

interface WaybackUrl {
  url: string;
  timestamp: string;
  status: string;
  mimeType: string;
}

interface ExtractConfig {
  fromDate: string;
  toDate: string;
  limit: number;
  matchType: "exact" | "prefix" | "host" | "domain";
  collapseTime: boolean;
  filters: string[];
}

const defaultConfig: ExtractConfig = {
  fromDate: "",
  toDate: "",
  limit: 1000,
  matchType: "prefix",
  collapseTime: true,
  filters: [],
};

export default function WaybackExtractor() {
  const [domain, setDomain] = useState("");
  const [urls, setUrls] = useState<WaybackUrl[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<ExtractConfig>(defaultConfig);
  const [showConfig, setShowConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const extractUrls = async () => {
    if (!domain.trim()) {
      setError("Please enter a domain or URL");
      return;
    }

    setIsLoading(true);
    setError(null);
    setUrls([]);
    setProgress({ current: 0, total: 0 });

    try {
      const cleanDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

      const params = new URLSearchParams({
        url: cleanDomain,
        output: "json",
        collapse: config.collapseTime ? "timestamp:8" : "",
        matchType: config.matchType,
        limit: config.limit.toString(),
      });

      if (config.fromDate) params.append("from", config.fromDate.replace(/-/g, ""));
      if (config.toDate) params.append("to", config.toDate.replace(/-/g, ""));

      const response = await fetch(
        `https://web.archive.org/cdx/search/cdx?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch from Wayback Machine");
      }

      const text = await response.text();
      const lines = text.trim().split("\n");

      setProgress({ current: 0, total: lines.length });

      const extractedUrls: WaybackUrl[] = lines
        .map((line, index) => {
          setProgress({ current: index + 1, total: lines.length });
          const parts = line.split(" ");
          if (parts.length >= 4) {
            const timestamp = parts[1];
            const url = parts[2];
            const status = parts[4] || "unknown";
            const mimeType = parts[3] || "unknown";

            return {
              url,
              timestamp: `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)} ${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}`,
              status,
              mimeType,
            };
          }
          return null;
        })
        .filter((u): u is WaybackUrl => u !== null);

      // Remove duplicates
      const uniqueUrls = Array.from(
        new Map(extractedUrls.map((u) => [u.url, u])).values()
      );

      setUrls(uniqueUrls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const downloadCSV = () => {
    if (urls.length === 0) return;

    const headers = ["URL", "First Seen", "Status", "MIME Type"];
    const rows = urls.map((u) => [u.url, u.timestamp, u.status, u.mimeType]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `wayback-urls-${domain.replace(/[^a-z0-9]/gi, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const clearAll = () => {
    setDomain("");
    setUrls([]);
    setError(null);
  };

  const getStatusColor = (status: string) => {
    if (status === "200") return "text-emerald-400 bg-emerald-500/10";
    if (status === "301" || status === "302") return "text-amber-400 bg-amber-500/10";
    if (status.startsWith("4")) return "text-rose-400 bg-rose-500/10";
    if (status.startsWith("5")) return "text-rose-400 bg-rose-500/10";
    return "text-cyan-400 bg-cyan-500/10";
  };

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white">
                <Clock size={20} />
              </div>
              <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                Wayback URL Extractor
              </h1>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Extract historical URLs from the Internet Archive Wayback Machine
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
              style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            >
              <Filter size={16} />
              Bộ lọc
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
              <h3 className="text-sm font-black uppercase mb-4" style={{ color: "var(--text-primary)" }}>
                Cấu hình trích xuất
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    Từ ngày
                  </label>
                  <input
                    type="date"
                    value={config.fromDate}
                    onChange={(e) => setConfig({ ...config, fromDate: e.target.value })}
                    className="w-full h-10 rounded-xl px-3 text-sm font-bold"
                    style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    Đến ngày
                  </label>
                  <input
                    type="date"
                    value={config.toDate}
                    onChange={(e) => setConfig({ ...config, toDate: e.target.value })}
                    className="w-full h-10 rounded-xl px-3 text-sm font-bold"
                    style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    Giới hạn kết quả
                  </label>
                  <select
                    value={config.limit}
                    onChange={(e) => setConfig({ ...config, limit: parseInt(e.target.value) })}
                    className="w-full h-10 rounded-xl px-3 text-sm font-bold"
                    style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
                  >
                    <option value={100}>100 URLs</option>
                    <option value={500}>500 URLs</option>
                    <option value={1000}>1,000 URLs</option>
                    <option value={5000}>5,000 URLs</option>
                    <option value={10000}>10,000 URLs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    Match Type
                  </label>
                  <select
                    value={config.matchType}
                    onChange={(e) => setConfig({ ...config, matchType: e.target.value as any })}
                    className="w-full h-10 rounded-xl px-3 text-sm font-bold"
                    style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
                  >
                    <option value="exact">Exact URL</option>
                    <option value="prefix">URL Prefix</option>
                    <option value="host">Host only</option>
                    <option value="domain">Domain + subdomains</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.collapseTime}
                    onChange={(e) => setConfig({ ...config, collapseTime: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
                    Gộp theo ngày (loại bỏ trùng lặp trong ngày)
                  </span>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Section */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>
              Domain hoặc URL
            </h3>
          </div>
          <div className="relative">
            <Globe
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com hoặc https://example.com/path"
              className="w-full h-12 rounded-xl pl-12 pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
              onKeyDown={(e) => e.key === "Enter" && extractUrls()}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Nhập domain hoặc URL cụ thể để trích xuất tất cả các phiên bản đã lưu trữ từ Wayback Machine.
          </p>

          {error && (
            <div className="mt-4 rounded-xl p-3 border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center gap-2 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={extractUrls}
              disabled={isLoading || !domain.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-all"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {isLoading ? `Đang tìm kiếm...` : "Tìm kiếm Wayback"}
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
            {urls.length > 0 && (
              <button
                onClick={downloadCSV}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all ml-auto"
              >
                <Download size={16} />
                Tải CSV
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        {isLoading && progress.total > 0 && (
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Đang xử lý dữ liệu từ Wayback Machine
              </span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {progress.current.toLocaleString()} records
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--hover-bg)" }}>
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            </div>
          </div>
        )}

        {/* Results Summary */}
        {urls.length > 0 && !isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Database size={16} className="text-amber-400" />
                <span className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>
                  Tổng URLs
                </span>
              </div>
              <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                {urls.length.toLocaleString()}
              </span>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={16} className="text-cyan-400" />
                <span className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>
                  Khoảng thời gian
                </span>
              </div>
              <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                {urls.length > 0 ? (
                  <>
                    {new Date(urls[urls.length - 1]?.timestamp || "").getFullYear()} -
                    {new Date(urls[0]?.timestamp || "").getFullYear()}
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={16} className="text-emerald-400" />
                <span className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>
                  HTTP 200
                </span>
              </div>
              <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                {urls.filter((u) => u.status === "200").length.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Results Table */}
        {urls.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}
          >
            <div className="p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
              <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>
                URLs đã lưu trữ ({urls.length.toLocaleString()})
              </h3>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0" style={{ backgroundColor: "var(--card-bg)" }}>
                  <tr
                    className="text-xs font-black uppercase"
                    style={{ color: "var(--text-muted)", borderBottom: "1px solid rgba(6,182,212,0.1)" }}
                  >
                    <th className="p-4 text-left">URL</th>
                    <th className="p-4 text-left">Lần đầu lưu trữ</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-left">MIME Type</th>
                  </tr>
                </thead>
                <tbody>
                  {urls.map((url, index) => (
                    <tr
                      key={index}
                      className="text-sm hover:bg-white/5 transition-colors"
                      style={{ borderBottom: "1px solid rgba(6,182,212,0.05)" }}
                    >
                      <td className="p-4">
                        <a
                          href={url.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          <span className="truncate max-w-[300px] md:max-w-[400px]">{url.url}</span>
                          <ExternalLink size={12} />
                        </a>
                      </td>
                      <td className="p-4">
                        <span style={{ color: "var(--text-secondary)" }}>{url.timestamp}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${getStatusColor(
                            url.status
                          )}`}
                        >
                          {url.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                          {url.mimeType}
                        </span>
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
