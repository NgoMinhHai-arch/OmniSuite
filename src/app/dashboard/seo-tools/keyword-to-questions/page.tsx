"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Copy } from "lucide-react";
import { keywordsToQuestionSeeds } from "@/lib/seo/keyword-utils";

export default function KeywordToQuestionsTool() {
  const [keyword, setKeyword] = useState("");
  const questions = useMemo(() => keywordsToQuestionSeeds(keyword), [keyword]);

  const copyAll = () => {
    navigator.clipboard.writeText(questions.join("\n"));
  };

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <a href="/dashboard/seo-tools" className="text-cyan-400 hover:text-cyan-300">
            <ArrowLeft size={24} />
          </a>
          <div>
            <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
              Keyword → Questions
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Sinh dàn ý câu hỏi mẫu cho FAQ, PAA hoặc outline nội dung (tiếng Anh).
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase mb-2 block" style={{ color: "var(--text-muted)" }}>
            Từ khóa trọng tâm
          </label>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="content marketing"
            className="w-full h-12 rounded-xl px-4 text-sm font-bold"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
          <button
            type="button"
            onClick={copyAll}
            disabled={questions.length === 0}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-bold"
          >
            <Copy size={16} /> Copy tất cả
          </button>
        </div>

        <ul className="space-y-2">
          {questions.map((q, i) => (
            <li
              key={i}
              className="rounded-xl px-4 py-3 text-sm"
              style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)", color: "var(--text-secondary)" }}
            >
              {q}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
