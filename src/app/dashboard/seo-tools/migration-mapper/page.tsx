"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { rankBySimilarity } from "@/lib/seo/embeddings";
import { downloadAsCsv } from "@/lib/seo/csv";

function pathRepresentation(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/[\-_/]+/g, " ").trim();
  } catch {
    return url.replace(/[\-_/]+/g, " ");
  }
}

export default function MigrationMapperPage() {
  const [oldRaw, setOldRaw] = useState("");
  const [newRaw, setNewRaw] = useState("");

  const oldUrls = useMemo(() => oldRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), [oldRaw]);
  const newUrls = useMemo(() => newRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), [newRaw]);

  const mapping = useMemo(() => {
    if (!oldUrls.length || !newUrls.length) return [];
    const newRepr = newUrls.map(pathRepresentation);
    return oldUrls.map((oldUrl) => {
      const target = pathRepresentation(oldUrl);
      const ranked = rankBySimilarity(target, newRepr);
      const best = ranked[0];
      const idx = newRepr.indexOf(best?.text || "");
      return {
        oldUrl,
        newUrl: idx >= 0 ? newUrls[idx] : "",
        score: best?.score ?? 0,
      };
    });
  }, [oldUrls, newUrls]);

  const handleExport = () => {
    if (!mapping.length) return;
    downloadAsCsv(
      "url-migration.csv",
      ["Old URL", "New URL", "Score", "Action"],
      mapping.map((m) => [m.oldUrl, m.newUrl, m.score.toFixed(3), m.score >= 0.3 ? "301" : "Cần kiểm tra"])
    );
  };

  return (
    <ToolShell
      title="URL Migration Mapper"
      description="Ghép URL cũ với URL mới gần giống nhất bằng similarity. Score thấp → cần kiểm tra thủ công."
      requires={[]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>Old URLs ({oldUrls.length})</label>
          <textarea
            value={oldRaw}
            onChange={(e) => setOldRaw(e.target.value)}
            rows={12}
            className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
        </div>
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>New URLs ({newUrls.length})</label>
          <textarea
            value={newRaw}
            onChange={(e) => setNewRaw(e.target.value)}
            rows={12}
            className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
        </div>
      </div>

      {mapping.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
            <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>Mapping</h3>
            <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
              <Download size={14} /> CSV
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr><th className="text-left p-3">Old</th><th className="text-left p-3">New</th><th className="text-right p-3">Score</th></tr>
            </thead>
            <tbody>
              {mapping.slice(0, 300).map((m, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3 truncate max-w-[300px]" style={{ color: "var(--text-primary)" }}>{m.oldUrl}</td>
                  <td className="p-3 truncate max-w-[300px]" style={{ color: m.score >= 0.3 ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {m.newUrl || "—"}
                  </td>
                  <td className="p-3 text-right font-mono">{m.score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
