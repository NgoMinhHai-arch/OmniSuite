"use client";

import { useMemo, useState } from "react";
import { ToolShell } from "@/components/seo/ToolShell";

interface Row {
  keyword: string;
  difficulty: number;
  reason: string;
}

const HARD_TOKENS = ["best", "top", "review", "vs", "near me", "cheap", "buy", "service", "agency", "tốt nhất", "giá rẻ", "dịch vụ"];

function estimateDifficulty(keyword: string): { score: number; reason: string } {
  const k = keyword.toLowerCase();
  const tokens = k.split(/\s+/).filter(Boolean);
  let score = 30;
  const reasons: string[] = [];

  if (tokens.length <= 2) {
    score += 25;
    reasons.push("ngắn (≤ 2 từ)");
  } else if (tokens.length >= 5) {
    score -= 15;
    reasons.push("long-tail (≥ 5 từ)");
  }

  for (const h of HARD_TOKENS) {
    if (k.includes(h)) {
      score += 10;
      reasons.push(`chứa '${h}'`);
    }
  }

  if (/\d{4}/.test(k)) {
    score -= 5;
    reasons.push("có năm cụ thể");
  }
  if (/(làm|cách|how|why|what|when)/i.test(k)) {
    score -= 8;
    reasons.push("informational");
  }

  score = Math.max(5, Math.min(95, score));
  return { score, reason: reasons.join(", ") || "neutral" };
}

export default function KeywordDifficultyCheckerPage() {
  const [raw, setRaw] = useState("");

  const rows: Row[] = useMemo(
    () =>
      raw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((kw) => {
          const { score, reason } = estimateDifficulty(kw);
          return { keyword: kw, difficulty: score, reason };
        }),
    [raw]
  );

  return (
    <ToolShell
      title="Keyword Difficulty (offline)"
      description="Ước lượng nhanh độ khó keyword bằng heuristic (độ dài, từ thương mại, intent). Để có chỉ số thực tế, kết hợp với DataForSEO trong SEO Nâng cao."
      requires={[]}
    >
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          placeholder={"thời trang nam giá rẻ\ncách chăm sóc da mặt cho nam\n..."}
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
      </div>

      {rows.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr>
                <th className="text-left p-3">Keyword</th>
                <th className="text-right p-3">Độ khó</th>
                <th className="text-left p-3">Lý do</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.keyword} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3 font-bold" style={{ color: "var(--text-primary)" }}>{r.keyword}</td>
                  <td className="p-3 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-black ${
                        r.difficulty >= 70 ? "bg-rose-500/10 text-rose-400" : r.difficulty >= 45 ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {r.difficulty}
                    </span>
                  </td>
                  <td className="p-3 text-xs" style={{ color: "var(--text-muted)" }}>{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
