"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";

function escapeRe(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildOrRegex(samples: string[]): string {
  const cleaned = Array.from(new Set(samples.map((s) => s.trim()).filter(Boolean)));
  if (cleaned.length === 0) return "";
  return `(${cleaned.map(escapeRe).join("|")})`;
}

function buildUrlPathRegex(samples: string[]): string {
  const paths = samples
    .map((s) => {
      try {
        return new URL(s).pathname.replace(/\/$/, "") || "/";
      } catch {
        return s;
      }
    })
    .filter(Boolean);
  if (!paths.length) return "";
  return `^(${paths.map(escapeRe).join("|")})/?$`;
}

function buildUrlPrefix(samples: string[]): string {
  const prefixes = samples
    .map((s) => {
      try {
        const u = new URL(s);
        const segs = u.pathname.split("/").filter(Boolean);
        return "/" + (segs[0] || "");
      } catch {
        return s.replace(/^\/+/, "/").split("/").slice(0, 2).join("/");
      }
    })
    .filter((p) => p && p !== "/");
  const uniq = Array.from(new Set(prefixes));
  if (!uniq.length) return "";
  return `^(${uniq.map(escapeRe).join("|")})(/.*)?$`;
}

export default function RegexGeneratorPage() {
  const [raw, setRaw] = useState("/category/men\n/category/women\n/category/kids");

  const samples = useMemo(() => raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), [raw]);

  const variants = useMemo(
    () => [
      { label: "Match chính xác (alternation)", regex: buildOrRegex(samples) },
      { label: "URL path ($) — anchored", regex: buildUrlPathRegex(samples) },
      { label: "URL prefix (group đầu tiên + descendants)", regex: buildUrlPrefix(samples) },
    ],
    [samples]
  );

  return (
    <ToolShell
      title="Regex Generator (offline)"
      description="Sinh các biến thể regex đơn giản từ danh sách ví dụ — không cần AI. Để có biến thể AI nâng cao, dùng Regex Generator AI."
      requires={[]}
    >
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <label className="text-xs font-black uppercase block mb-2" style={{ color: "var(--text-muted)" }}>
          Ví dụ ({samples.length})
        </label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
      </div>

      <div className="space-y-3">
        {variants.map((v) => (
          <div
            key={v.label}
            className="rounded-2xl p-4"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
                {v.label}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(v.regex)}
                disabled={!v.regex}
                className="flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
            <pre
              className="text-xs font-mono whitespace-pre-wrap break-all"
              style={{ color: v.regex ? "var(--text-primary)" : "var(--text-muted)" }}
            >
              {v.regex || "—"}
            </pre>
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
