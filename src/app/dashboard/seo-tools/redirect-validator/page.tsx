"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Route,
  Globe,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  Trash2,
  ExternalLink,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

interface RedirectResult {
  url: string;
  finalUrl: string;
  statusCodes: number[];
  redirectCount: number;
  error?: string;
  responseTime: number;
}

export default function RedirectValidator() {
  const [urls, setUrls] = useState("");
  const [results, setResults] = useState<RedirectResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkRedirects = async () => {
    const urlList = urls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u && u.startsWith("http"));

    if (urlList.length === 0) {
      setError("Please enter at least one valid URL");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);

    for (const url of urlList) {
      try {
        const startTime = Date.now();
        const response = await fetch("/api/seo/redirect-validator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        const data = await response.json();
        const responseTime = Date.now() - startTime;

        setResults((prev) => [
          ...prev,
          {
            url,
            finalUrl: data.finalUrl || url,
            statusCodes: data.statusCodes || [],
            redirectCount: data.redirectCount || 0,
            error: data.error,
            responseTime,
          },
        ]);
      } catch (err) {
        setResults((prev) => [
          ...prev,
          {
            url,
            finalUrl: url,
            statusCodes: [],
            redirectCount: 0,
            error: err instanceof Error ? err.message : "Failed to check",
            responseTime: 0,
          },
        ]);
      }
    }

    setIsLoading(false);
  };

  const downloadCSV = () => {
    if (results.length === 0) return;

    const headers = ["Original URL", "Final URL", "Redirect Count", "Status Chain", "Response Time (ms)", "Error"];
    const rows = results.map((r) => [
      r.url,
      r.finalUrl,
      r.redirectCount,
      r.statusCodes.join(" → "),
      r.responseTime,
      r.error || "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `redirect-check-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-emerald-400";
    if (status >= 300 && status < 400) return "text-amber-400";
    if (status >= 400) return "text-rose-400";
    return "text-cyan-400";
  };

  const getChainIcon = (count: number) => {
    if (count === 0) return <CheckCircle size={16} className="text-emerald-400" />;
    if (count <= 2) return <ArrowRight size={16} className="text-amber-400" />;
    return <AlertTriangle size={16} className="text-rose-400" />;
  };

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white">
                <Route size={20} />
              </div>
              <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Redirect Validator</h1>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Check redirect chains, status codes, and final destinations</p>
          </div>
          <a href="/dashboard/seo-tools" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-cyan-400 hover:text-cyan-300">← Quay lại</a>
        </div>

        {/* Input */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <h3 className="text-sm font-black uppercase mb-4" style={{ color: "var(--text-primary)" }}>URLs cần kiểm tra</h3>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="https://example.com/old-page&#10;https://example.com/redirect-page"
            rows={6}
            className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />

          {error && (
            <div className="mt-4 rounded-xl p-3 border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center gap-2 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={checkRedirects}
              disabled={isLoading || !urls.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Route size={16} />}
              {isLoading ? "Đang kiểm tra..." : "Kiểm tra Redirect"}
            </button>
            <button
              onClick={() => { setUrls(""); setResults([]); setError(null); }}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            >
              <Trash2 size={16} /> Xóa
            </button>
            {results.length > 0 && (
              <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold ml-auto">
                <Download size={16} /> Tải CSV
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
              <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>Kết quả kiểm tra ({results.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs font-black uppercase" style={{ color: "var(--text-muted)", borderBottom: "1px solid rgba(6,182,212,0.1)" }}>
                    <th className="p-4 text-left">URL gốc</th>
                    <th className="p-4 text-center">Chuỗi redirect</th>
                    <th className="p-4 text-left">URL cuối</th>
                    <th className="p-4 text-center">Số lần redirect</th>
                    <th className="p-4 text-right">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="text-sm" style={{ borderBottom: "1px solid rgba(6,182,212,0.05)" }}>
                      <td className="p-4">
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                          <span className="truncate max-w-[200px]">{r.url}</span>
                          <ExternalLink size={12} />
                        </a>
                        {r.error && <span className="text-xs text-rose-400 block mt-1">{r.error}</span>}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {r.statusCodes.length > 0 ? (
                            r.statusCodes.map((code, idx) => (
                              <span key={idx} className={`text-xs font-bold ${getStatusColor(code)}`}>
                                {code}
                                {idx < r.statusCodes.length - 1 && <span className="text-gray-500 mx-1">→</span>}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {r.finalUrl !== r.url ? (
                          <a href={r.finalUrl} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                            <span className="truncate max-w-[200px]">{r.finalUrl}</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {getChainIcon(r.redirectCount)}
                          <span className="font-bold" style={{ color: r.redirectCount > 2 ? "#f87171" : r.redirectCount > 0 ? "#fbbf24" : "#34d399" }}>
                            {r.redirectCount}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{r.responseTime}ms</span>
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
