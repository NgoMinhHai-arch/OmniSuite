"use client";

import { useMemo, useState } from "react";
import { Tag, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface RuleRow {
  tag: string;
  patterns: string[];
}

function parseRules(input: string): RuleRow[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [tag, ...rest] = line.split("=");
      const patterns = rest
        .join("=")
        .split("|")
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
      return { tag: (tag || "").trim(), patterns };
    })
    .filter((r) => r.tag && r.patterns.length);
}

function tagKeyword(keyword: string, rules: RuleRow[]): string[] {
  const k = keyword.toLowerCase();
  const tags: string[] = [];
  for (const rule of rules) {
    if (rule.patterns.some((p) => k.includes(p))) tags.push(rule.tag);
  }
  return tags;
}

export default function BulkKeywordTaggerPage() {
  const [keywordsRaw, setKeywordsRaw] = useState("");
  const [rulesRaw, setRulesRaw] = useState(
    "Thương hiệu=nike|adidas\nGiá rẻ=cheap|giá rẻ|sale\nMobile=iphone|android"
  );

  const rules = useMemo(() => parseRules(rulesRaw), [rulesRaw]);
  const keywords = useMemo(
    () =>
      keywordsRaw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [keywordsRaw]
  );

  const tagged = useMemo(
    () => keywords.map((k) => ({ keyword: k, tags: tagKeyword(k, rules) })),
    [keywords, rules]
  );

  const handleExport = () => {
    if (tagged.length === 0) return;
    downloadAsCsv(
      "tagged-keywords.csv",
      ["Keyword", "Tags"],
      tagged.map((t) => [t.keyword, t.tags.join(" | ")])
    );
  };

  return (
    <ToolShell
      title="Bulk Keyword Tagger"
      description="Gắn nhãn cho danh sách từ khóa theo bộ luật tự định nghĩa. Cú pháp mỗi dòng: TAG=pattern1|pattern2."
      requires={[]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase block mb-2" style={{ color: "var(--text-muted)" }}>
            Bộ luật ({rules.length})
          </label>
          <textarea
            value={rulesRaw}
            onChange={(e) => setRulesRaw(e.target.value)}
            rows={10}
            className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
        </div>
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase block mb-2" style={{ color: "var(--text-muted)" }}>
            Keyword ({keywords.length})
          </label>
          <textarea
            value={keywordsRaw}
            onChange={(e) => setKeywordsRaw(e.target.value)}
            rows={10}
            placeholder={"iphone 15 giá rẻ\nadidas chính hãng\n..."}
            className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
        </div>
      </div>

      {tagged.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
            <h3 className="text-sm font-black uppercase flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Tag size={16} className="text-cyan-400" /> Kết quả ({tagged.length})
            </h3>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
            >
              <Download size={14} /> CSV
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr>
                <th className="text-left p-3">Keyword</th>
                <th className="text-left p-3">Tags</th>
              </tr>
            </thead>
            <tbody>
              {tagged.slice(0, 500).map((row, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3" style={{ color: "var(--text-primary)" }}>{row.keyword}</td>
                  <td className="p-3 flex flex-wrap gap-1">
                    {row.tags.length === 0 ? (
                      <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>—</span>
                    ) : (
                      row.tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400">
                          {t}
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tagged.length > 500 && (
            <p className="text-xs p-3 text-center" style={{ color: "var(--text-muted)" }}>
              Hiển thị 500/{tagged.length} dòng đầu. Toàn bộ có trong file CSV xuất ra.
            </p>
          )}
        </div>
      )}
    </ToolShell>
  );
}
