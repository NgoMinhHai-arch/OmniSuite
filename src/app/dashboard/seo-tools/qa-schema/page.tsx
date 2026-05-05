"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Copy } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsText } from "@/lib/seo/csv";

interface FAQ {
  q: string;
  a: string;
}

function buildSchema(items: FAQ[]) {
  const filtered = items.filter((i) => i.q.trim() && i.a.trim());
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: filtered.map((i) => ({
      "@type": "Question",
      name: i.q.trim(),
      acceptedAnswer: { "@type": "Answer", text: i.a.trim() },
    })),
  };
}

export default function QaSchemaPage() {
  const [items, setItems] = useState<FAQ[]>([{ q: "", a: "" }]);

  const json = useMemo(() => JSON.stringify(buildSchema(items), null, 2), [items]);
  const wrapped = useMemo(() => `<script type="application/ld+json">\n${json}\n</script>`, [json]);

  return (
    <ToolShell
      title="Q&A Schema Builder"
      description="Tạo nhanh JSON-LD FAQPage cho trang câu hỏi thường gặp."
      requires={[]}
    >
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>FAQ #{i + 1}</span>
              <button
                onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1"
              >
                <Trash2 size={12} /> Xóa
              </button>
            </div>
            <input
              value={item.q}
              onChange={(e) => setItems(items.map((it, idx) => (idx === i ? { ...it, q: e.target.value } : it)))}
              placeholder="Câu hỏi..."
              className="w-full rounded-xl px-4 py-2 text-sm font-bold"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            />
            <textarea
              value={item.a}
              onChange={(e) => setItems(items.map((it, idx) => (idx === i ? { ...it, a: e.target.value } : it)))}
              placeholder="Câu trả lời..."
              rows={3}
              className="w-full rounded-xl px-4 py-2 text-sm resize-none"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            />
          </div>
        ))}
        <button
          onClick={() => setItems([...items, { q: "", a: "" }])}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold"
        >
          <Plus size={14} /> Thêm câu hỏi
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
          <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>JSON-LD</h3>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(wrapped)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
            >
              <Copy size={14} /> Copy &lt;script&gt;
            </button>
            <button
              onClick={() => downloadAsText("faq-schema.json", json, "application/json")}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
            >
              Tải JSON
            </button>
          </div>
        </div>
        <pre className="p-4 text-xs font-mono whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
          {wrapped}
        </pre>
      </div>
    </ToolShell>
  );
}
