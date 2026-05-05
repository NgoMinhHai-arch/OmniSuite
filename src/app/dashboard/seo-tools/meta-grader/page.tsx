"use client";

import { useState } from "react";
import { Sparkles, AlertCircle, ArrowLeft } from "lucide-react";
import { gradeMetaDescription } from "@/lib/seo/meta-grade";

export default function MetaGrader() {
  const [metaDescription, setMetaDescription] = useState("");
  const [brandHint, setBrandHint] = useState("");
  const [result, setResult] = useState<{ score: number; feedback: string[] } | null>(null);

  const analyzeMeta = () => {
    if (!metaDescription.trim()) return;
    const graded = gradeMetaDescription(metaDescription, { brandHint: brandHint.trim() || undefined });
    setResult(graded);
  };

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <a href="/dashboard/seo-tools" className="text-cyan-400 hover:text-cyan-300">
            <ArrowLeft size={24} />
          </a>
          <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
            Đánh giá Meta Description
          </h1>
        </div>

        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder="Nhập meta description cần đánh giá..."
            rows={4}
            className="w-full rounded-xl px-4 py-3 text-sm resize-none"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
          <input
            type="text"
            value={brandHint}
            onChange={(e) => setBrandHint(e.target.value)}
            placeholder="Tên thương hiệu (tuỳ chọn, để chấm điểm có nhắc brand)"
            className="w-full mt-3 rounded-xl px-4 py-2.5 text-sm"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
          <div className="flex justify-between items-center mt-4">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {metaDescription.length} ký tự · gợi ý ~150–160
            </span>
            <button
              onClick={analyzeMeta}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
            >
              <Sparkles size={16} />
              Đánh giá
            </button>
          </div>
        </div>

        {result && (
          <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="flex items-center gap-4 mb-4">
              <div className={`text-4xl font-black ${result.score >= 80 ? "text-emerald-400" : result.score >= 60 ? "text-amber-400" : "text-rose-400"}`}>
                {result.score}/100
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {result.score >= 80 ? "Xuất sắc!" : result.score >= 60 ? "Khá tốt" : "Cần cải thiện"}
                </p>
              </div>
            </div>
            {result.feedback.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>Gợi ý cải thiện:</p>
                {result.feedback.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-amber-400">
                    <AlertCircle size={14} /> {f}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
