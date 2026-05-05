"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsText, parseCsv } from "@/lib/seo/csv";

interface MapRow {
  lang: string;
  url: string;
}

function parseInput(raw: string): MapRow[] {
  if (raw.includes(",")) {
    const rows = parseCsv(raw);
    if (!rows.length) return [];
    const headerLooksReal = /lang/i.test(rows[0]?.[0] || "") && /url/i.test(rows[0]?.[1] || "");
    return rows
      .slice(headerLooksReal ? 1 : 0)
      .map((r) => ({ lang: (r[0] || "").trim(), url: (r[1] || "").trim() }))
      .filter((r) => r.lang && r.url);
  }
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      return { lang: parts[0], url: parts.slice(1).join(" ") };
    })
    .filter((r) => r.lang && r.url);
}

function buildHtml(rows: MapRow[], includeXDefault: boolean): string {
  const out = rows.map((r) => `<link rel="alternate" hreflang="${r.lang}" href="${r.url}" />`);
  if (includeXDefault && rows.length) {
    out.push(`<link rel="alternate" hreflang="x-default" href="${rows[0].url}" />`);
  }
  return out.join("\n");
}

function buildXml(rows: MapRow[], includeXDefault: boolean): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">');
  rows.forEach((r) => {
    lines.push("  <url>");
    lines.push(`    <loc>${r.url}</loc>`);
    rows.forEach((alt) => {
      lines.push(`    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${alt.url}"/>`);
    });
    if (includeXDefault && rows.length) {
      lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${rows[0].url}"/>`);
    }
    lines.push("  </url>");
  });
  lines.push("</urlset>");
  return lines.join("\n");
}

export default function HreflangGeneratorPage() {
  const [raw, setRaw] = useState("vi, https://example.com/vn/\nen, https://example.com/en/\nja, https://example.com/jp/");
  const [includeXDefault, setIncludeXDefault] = useState(true);
  const [mode, setMode] = useState<"html" | "xml">("html");

  const rows = useMemo(() => parseInput(raw), [raw]);
  const output = useMemo(
    () => (mode === "html" ? buildHtml(rows, includeXDefault) : buildXml(rows, includeXDefault)),
    [rows, mode, includeXDefault]
  );

  return (
    <ToolShell
      title="Hreflang Generator"
      description="Sinh thẻ hreflang dạng HTML hoặc sitemap XML với x-default tuỳ chọn."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          placeholder="lang, url (mỗi dòng 1 cặp)"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={includeXDefault} onChange={(e) => setIncludeXDefault(e.target.checked)} />
            Thêm x-default
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "html" | "xml")}
            className="rounded-xl px-3 py-2 text-sm font-bold"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          >
            <option value="html">HTML &lt;link&gt;</option>
            <option value="xml">Sitemap XML</option>
          </select>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {rows.length} ngôn ngữ
          </span>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
          <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>Output</h3>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(output)}
              disabled={!output}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold"
            >
              <Copy size={14} /> Copy
            </button>
            <button
              onClick={() =>
                downloadAsText(
                  mode === "html" ? "hreflang.html" : "hreflang-sitemap.xml",
                  output,
                  mode === "html" ? "text/html" : "application/xml"
                )
              }
              disabled={!output}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold"
            >
              Tải file
            </button>
          </div>
        </div>
        <pre className="p-4 text-xs font-mono whitespace-pre-wrap overflow-x-auto" style={{ color: "var(--text-secondary)" }}>
          {output || "—"}
        </pre>
      </div>
    </ToolShell>
  );
}
