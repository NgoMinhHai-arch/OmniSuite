"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Gauge } from "lucide-react";
import {
  analyzeEnglishText,
  interpretFlesch,
  simpleVietnameseStats,
} from "@/lib/seo/readability";

export default function ReadingScoreTool() {
  const [text, setText] = useState("");

  const en = useMemo(() => {
    if (!text.trim()) return null;
    return analyzeEnglishText(text);
  }, [text]);

  const vi = useMemo(() => simpleVietnameseStats(text), [text]);

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <a href="/dashboard/seo-tools" className="text-cyan-400 hover:text-cyan-300">
            <ArrowLeft size={24} />
          </a>
          <div>
            <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
              Reading Score (Flesch–Kincaid)
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Chỉ số Flesch phù hợp tiếng Anh; thống kê câu/từ thêm cho tiếng Việt.
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <label className="text-xs font-black uppercase mb-2 block" style={{ color: "var(--text-muted)" }}>
            Nội dung
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="Dán đoạn văn cần đo..."
            className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Gauge size={18} className="text-cyan-400" />
              <h2 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>
                Tiếng Anh (ước lượng)
              </h2>
            </div>
            {!en || en.words < 8 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Nhập ít nhất ~8 từ tiếng Anh để chỉ số ổn định hơn.
              </p>
            ) : (
              <>
                <div className="text-4xl font-black text-cyan-400 mb-1">{en.fleschReadingEase.toFixed(1)}</div>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                  Flesch Reading Ease — {interpretFlesch(en.fleschReadingEase)}
                </p>
                <ul className="text-sm space-y-1" style={{ color: "var(--text-secondary)" }}>
                  <li>Grade (ước lượng): {en.fleschKincaidGrade.toFixed(1)}</li>
                  <li>Câu / từ / âm tiết: {en.sentences} / {en.words} / {en.syllables}</li>
                  <li>Độ dài TB câu: {en.avgSentenceLen.toFixed(1)} từ</li>
                  <li>Âm tiết / từ: {en.avgSyllablesPerWord.toFixed(2)}</li>
                </ul>
              </>
            )}
          </div>

          <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={18} className="text-emerald-400" />
              <h2 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>
                Tiếng Việt (thống kê)
              </h2>
            </div>
            {!vi.words ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chưa có nội dung.</p>
            ) : (
              <ul className="text-sm space-y-1" style={{ color: "var(--text-secondary)" }}>
                <li>Số câu: {vi.sentences}</li>
                <li>Số từ: {vi.words}</li>
                <li>Độ dài TB câu: {vi.avgSentenceLen.toFixed(1)} từ</li>
                <li>Độ dài TB từ: {vi.avgWordLen.toFixed(1)} ký tự</li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
