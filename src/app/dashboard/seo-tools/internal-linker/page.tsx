"use client";

import { useState } from "react";
import {
  Link,
  Search,
  ArrowRight,
  Copy,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface LinkSuggestion {
  sourceUrl: string;
  targetUrl: string;
  anchorText: string;
  context: string;
  score: number;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function InternalLinker() {
  const [urls, setUrls] = useState("");
  const [moneyPageUrl, setMoneyPageUrl] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [moneyTitle, setMoneyTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const generateSuggestions = async () => {
    if (!urls.trim() || !targetKeyword.trim()) {
      setError("Vui lòng nhập URLs và từ khóa mục tiêu");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    setMoneyTitle(null);

    try {
      const urlList = urls
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.startsWith("http"));

      const res = await fetch("/api/seo/internal-link-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: urlList,
          targetKeyword: targetKeyword.trim(),
          moneyPageUrl: moneyPageUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không phân tích được");
      }

      setSuggestions(data.suggestions || []);
      setMoneyTitle(data.moneyTitle || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi phân tích");
    } finally {
      setIsLoading(false);
    }
  };

  const copySuggestion = (index: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                <Link size={20} />
              </div>
              <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                Tối ưu Internal Link
              </h1>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Phân tích HTML thật: tìm trang đã nhắc từ khóa nhưng chưa trỏ link tới trang đích (money page).
            </p>
          </div>
          <a
            href="/dashboard/seo-tools"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-cyan-400 hover:text-cyan-300"
          >
            ← Quay lại
          </a>
        </div>

        {/* Input Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <h3 className="text-sm font-black uppercase mb-4" style={{ color: "var(--text-primary)" }}>
              URLs trang nguồn
            </h3>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://example.com/page1&#10;https://example.com/page2&#10;https://example.com/page3"
              rows={8}
              className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            />
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
              <h3 className="text-sm font-black uppercase mb-4" style={{ color: "var(--text-primary)" }}>
                Trang đích (money page)
              </h3>
              <input
                type="url"
                value={moneyPageUrl}
                onChange={(e) => setMoneyPageUrl(e.target.value)}
                placeholder="Để trống = dùng URL cuối trong danh sách"
                className="w-full h-12 rounded-xl px-4 text-sm font-bold"
                style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
              />
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                Các trang nguồn khác sẽ được gợi ý trỏ link về đây khi có ngữ cảnh chứa từ khóa.
              </p>
            </div>

            <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
              <h3 className="text-sm font-black uppercase mb-4" style={{ color: "var(--text-primary)" }}>
                Từ khóa / cụm cần gắn link
              </h3>
              <input
                type="text"
                value={targetKeyword}
                onChange={(e) => setTargetKeyword(e.target.value)}
                placeholder="Ví dụ: dịch vụ SEO địa phương"
                className="w-full h-12 rounded-xl px-4 text-sm font-bold"
                style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
              />
            </div>

            <button
              onClick={generateSuggestions}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold transition-all"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              {isLoading ? "Đang phân tích..." : "Tìm cơ hội Internal Link"}
            </button>

            {error && (
              <div className="rounded-xl p-3 border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center gap-2 text-sm">
                <AlertCircle size={16} /> {error}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {moneyTitle && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Money page title: <span style={{ color: "var(--text-secondary)" }}>{moneyTitle}</span>
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
              <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>
                Gợi ý Internal Link ({suggestions.length})
              </h3>
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(6,182,212,0.05)" }}>
              {suggestions.map((suggestion, index) => (
                <div key={index} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold px-2 py-1 rounded bg-purple-500/10 text-purple-400">
                          Score: {suggestion.score}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <span className="text-cyan-400 truncate max-w-[200px]">{suggestion.sourceUrl}</span>
                        <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
                        <span className="text-pink-400 truncate max-w-[200px]">{suggestion.targetUrl}</span>
                      </div>
                      <div className="rounded-xl p-3" style={{ backgroundColor: "var(--hover-bg)" }}>
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          {!suggestion.anchorText ? (
                            suggestion.context
                          ) : (
                            suggestion.context.split(new RegExp(`(${escapeRegExp(suggestion.anchorText)})`, "gi")).map((part, i) =>
                              part.toLowerCase() === suggestion.anchorText.toLowerCase() ? (
                                <span key={i} className="text-cyan-400 font-bold">
                                  {part}
                                </span>
                              ) : (
                                <span key={i}>{part}</span>
                              )
                            )
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => copySuggestion(index, suggestion.context)}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-bold shrink-0"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {copiedIndex === index ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      {copiedIndex === index ? "Đã copy" : "Copy"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
