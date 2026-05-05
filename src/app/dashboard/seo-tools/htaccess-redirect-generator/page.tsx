"use client";

import { useMemo, useState } from "react";
import { Copy, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsText, parseCsv } from "@/lib/seo/csv";

type Mode = "htaccess" | "nginx";

interface RedirectRow {
  from: string;
  to: string;
  code: number;
}

function parseInput(raw: string): RedirectRow[] {
  if (raw.trim().startsWith("From,") || raw.includes(",")) {
    const rows = parseCsv(raw);
    if (!rows.length) return [];
    const headerLooksReal = /from/i.test(rows[0]?.[0] || "") && /to/i.test(rows[0]?.[1] || "");
    return rows
      .slice(headerLooksReal ? 1 : 0)
      .map((r) => ({
        from: (r[0] || "").trim(),
        to: (r[1] || "").trim(),
        code: Number((r[2] || "301").trim()) || 301,
      }))
      .filter((r) => r.from && r.to);
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      return { from: parts[0], to: parts[1] || "", code: Number(parts[2]) || 301 };
    })
    .filter((r) => r.from && r.to);
}

function pathOf(input: string): string {
  try {
    return new URL(input).pathname || "/";
  } catch {
    return input.startsWith("/") ? input : `/${input}`;
  }
}

function generate(rows: RedirectRow[], mode: Mode): string {
  if (mode === "htaccess") {
    const lines = ["RewriteEngine On"];
    rows.forEach((r) => {
      const fromPath = pathOf(r.from).replace(/\.([?*+()|.\[\]{}\\])/g, "\\$1");
      lines.push(`RewriteRule ^${fromPath.replace(/^\//, "")}$ ${r.to} [R=${r.code},L]`);
    });
    return lines.join("\n");
  }
  // nginx
  const lines = ["# server { ... }"];
  rows.forEach((r) => {
    const fromPath = pathOf(r.from);
    lines.push(`location = ${fromPath} { return ${r.code} ${r.to}; }`);
  });
  return lines.join("\n");
}

export default function HtaccessRedirectGeneratorPage() {
  const [raw, setRaw] = useState("https://old.example.com/page-a, https://new.example.com/page-a, 301");
  const [mode, setMode] = useState<Mode>("htaccess");
  const rows = useMemo(() => parseInput(raw), [raw]);
  const output = useMemo(() => generate(rows, mode), [rows, mode]);

  return (
    <ToolShell
      title="HTAccess / Nginx Redirect Generator"
      description="Sinh quy tắc 301 cho Apache .htaccess hoặc Nginx từ danh sách From → To."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
          Đầu vào · CSV (From,To,Code) hoặc dạng "from to code" mỗi dòng
        </label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <div className="flex items-center gap-3">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rounded-xl px-3 py-2 text-sm font-bold"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
          >
            <option value="htaccess">Apache .htaccess</option>
            <option value="nginx">Nginx</option>
          </select>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {rows.length} quy tắc hợp lệ
          </span>
        </div>
      </div>

      {output && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
            <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>
              Output
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(output)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                <Copy size={14} /> Copy
              </button>
              <button
                onClick={() => downloadAsText(mode === "htaccess" ? ".htaccess" : "redirects.conf", output, "text/plain")}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                <Download size={14} /> Tải file
              </button>
            </div>
          </div>
          <pre
            className="p-4 text-xs font-mono whitespace-pre-wrap overflow-x-auto"
            style={{ color: "var(--text-secondary)" }}
          >
            {output}
          </pre>
        </div>
      )}
    </ToolShell>
  );
}
