"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Copy, Trash2 } from "lucide-react";
import { dedupeKeywords } from "@/lib/seo/keyword-utils";

export default function KeywordDeduplicationTool() {
  const [raw, setRaw] = useState("");
  const [caseInsensitive, setCaseInsensitive] = useState(true);
  const [sort, setSort] = useState<"alpha" | "length" | "none">("alpha");

  const { lines, removed } = useMemo(
    () => dedupeKeywords(raw, { caseInsensitive, sort }),
    [raw, caseInsensitive, sort]
  );

  const outText = lines.join("\n");

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-4">
          <a href="/dashboard/seo-tools" className="text-cyan-400 hover:text-cyan-300">
            <ArrowLeft size={24} />
          </a>
          <div>
            <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
              Keyword Deduplication
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Loại trùng theo dòng, tuỳ chọn không phân biệt hoa thường và sắp xếp.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <label className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={caseInsensitive} onChange={(e) => setCaseInsensitive(e.target.checked)} />
            Không phân biệt hoa thường
          </label>
          <label className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            Sắp xếp:
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rounded-lg px-2 py-1 text-sm font-bold"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            >
              <option value="alpha">A→Z</option>
              <option value="length">Độ dài</option>
              <option value="none">Giữ thứ tự</option>
            </select>
          </label>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Đã bỏ ~{removed} dòng trùng · Còn {lines.length} dòng
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>Đầu vào</span>
              <button
                type="button"
                onClick={() => setRaw("")}
                className="text-xs font-bold flex items-center gap-1 text-rose-400 hover:text-rose-300"
              >
                <Trash2 size={14} /> Xóa
              </button>
            </div>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={18}
              placeholder={"từ khóa 1\ntừ khóa 2\nTừ khóa 1"}
              className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            />
          </div>

          <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>Sau khi lọc</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(outText)}
                className="text-xs font-bold flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
              >
                <Copy size={14} /> Copy
              </button>
            </div>
            <textarea
              readOnly
              value={outText}
              rows={18}
              className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
