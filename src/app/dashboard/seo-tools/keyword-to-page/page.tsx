"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { rankBySimilarity } from "@/lib/seo/embeddings";
import { downloadAsCsv } from "@/lib/seo/csv";

export default function KeywordToPagePage() {
  const [keywordsRaw, setKeywordsRaw] = useState("");
  const [pagesRaw, setPagesRaw] = useState("");

  const keywords = useMemo(() => keywordsRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), [keywordsRaw]);
  const pages = useMemo(() => pagesRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), [pagesRaw]);

  const matches = useMemo(() => {
    if (!keywords.length || !pages.length) return [];
    return keywords.map((kw) => {
      const ranked = rankBySimilarity(kw, pages);
      return { keyword: kw, top: ranked.slice(0, 3) };
    });
  }, [keywords, pages]);

  const handleExport = () => {
    if (!matches.length) return;
    downloadAsCsv(
      "keyword-to-page.csv",
      ["Keyword", "Top match URL", "Score"],
      matches.map((m) => [m.keyword, m.top[0]?.text || "", m.top[0]?.score.toFixed(3) || "0"])
    );
  };

  return (
    <ToolShell
      title="Keyword → Page Mapper"
      description="Map mỗi keyword vào URL phù hợp nhất theo TF-IDF similarity giữa keyword và URL/slug/text bạn cung cấp."
      requires={[]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>Keyword ({keywords.length})</label>
          <textarea
            value={keywordsRaw}
            onChange={(e) => setKeywordsRaw(e.target.value)}
            rows={12}
            className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
        </div>
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>Pages / URL / Title ({pages.length})</label>
          <textarea
            value={pagesRaw}
            onChange={(e) => setPagesRaw(e.target.value)}
            rows={12}
            placeholder={"https://site/blog/seo-tips - SEO tips for beginners\n..."}
            className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
        </div>
      </div>

      {matches.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
            <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>Mapping</h3>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
            >
              <Download size={14} /> CSV
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr><th className="text-left p-3">Keyword</th><th className="text-left p-3">Top 3</th></tr>
            </thead>
            <tbody>
              {matches.slice(0, 200).map((m, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3 font-bold" style={{ color: "var(--text-primary)" }}>{m.keyword}</td>
                  <td className="p-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <ul className="space-y-1">
                      {m.top.map((t, idx) => (
                        <li key={idx}>
                          <span className="font-mono">{t.text}</span>
                          <span className="ml-2 text-cyan-400/80 font-mono">{t.score.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
