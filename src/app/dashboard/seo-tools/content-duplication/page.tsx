"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { containmentSimilarity, jaccardSimilarity } from "@/lib/seo/text-similarity";

export default function ContentDuplicationTool() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const scores = useMemo(() => {
    if (!a.trim() || !b.trim()) return null;
    return {
      jaccard: jaccardSimilarity(a, b),
      containment: containmentSimilarity(a, b),
    };
  }, [a, b]);

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-4">
          <a href="/dashboard/seo-tools" className="text-cyan-400 hover:text-cyan-300">
            <ArrowLeft size={24} />
          </a>
          <div>
            <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
              Content Duplication Finder
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              So khớp nhanh bằng tập từ (Jaccard + containment), không thay thế crawl toàn site.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <span className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              Văn bản A
            </span>
            <textarea
              value={a}
              onChange={(e) => setA(e.target.value)}
              rows={16}
              className="mt-2 w-full rounded-xl px-4 py-3 text-sm resize-none"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <span className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              Văn bản B
            </span>
            <textarea
              value={b}
              onChange={(e) => setB(e.target.value)}
              rows={16}
              className="mt-2 w-full rounded-xl px-4 py-3 text-sm resize-none"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {scores && (
          <div className="rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div>
              <p className="text-xs font-black uppercase mb-1" style={{ color: "var(--text-muted)" }}>Jaccard (từ)</p>
              <p className="text-3xl font-black text-cyan-400">{(scores.jaccard * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase mb-1" style={{ color: "var(--text-muted)" }}>Containment</p>
              <p className="text-3xl font-black text-emerald-400">{(scores.containment * 100).toFixed(1)}%</p>
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                Tỉ lệ từ của đoạn ngắn hơn nằm trong đoạn dài hơn.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
