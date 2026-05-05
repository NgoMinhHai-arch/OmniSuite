"use client";

import React from "react";
import { ArrowLeft, AlertTriangle, ExternalLink, KeyRound } from "lucide-react";
import { REQUIREMENTS, RequirementKey } from "@/lib/seo/tool-registry";
import { useSystemKeys } from "@/lib/seo/use-system-keys";

export interface ToolShellProps {
  title: string;
  description?: string;
  requires?: RequirementKey[];
  /** Additional badges to display (e.g. "Beta"). */
  badges?: React.ReactNode;
  children: React.ReactNode;
  /** Force showing the run UI even when keys missing (advanced). */
  allowRunWithoutKeys?: boolean;
  /** Width preset. */
  maxWidth?: "md" | "lg" | "xl" | "2xl";
}

const WIDTH = {
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
  "2xl": "max-w-6xl",
};

export function ToolShell({
  title,
  description,
  requires = [],
  badges,
  children,
  allowRunWithoutKeys = false,
  maxWidth = "xl",
}: ToolShellProps) {
  const { missing, loaded } = useSystemKeys();
  const missingReqs = loaded ? missing(requires) : [];
  const blocked = !allowRunWithoutKeys && missingReqs.length > 0;

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className={`mx-auto ${WIDTH[maxWidth]} space-y-6`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <a
              href="/dashboard/seo-tools"
              className="text-cyan-400 hover:text-cyan-300 mt-1.5 shrink-0"
              aria-label="Quay lại Bộ công cụ SEO"
            >
              <ArrowLeft size={22} />
            </a>
            <div className="min-w-0">
              <h1 className="text-2xl font-black truncate" style={{ color: "var(--text-primary)" }}>
                {title}
              </h1>
              {description && (
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  {description}
                </p>
              )}
            </div>
          </div>
          {badges && <div className="shrink-0">{badges}</div>}
        </div>

        {requires.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {requires.map((r) => {
              const m = REQUIREMENTS[r];
              const ok = !missingReqs.includes(r);
              return (
                <span
                  key={r}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                    ok
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  }`}
                >
                  <KeyRound size={12} />
                  {m?.label || r}
                  {ok ? " · sẵn sàng" : " · cần kết nối"}
                </span>
              );
            })}
          </div>
        )}

        {blocked && (
          <div
            className="rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
            }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-300">
                  Công cụ này cần thêm cấu hình trước khi chạy.
                </p>
                <p className="text-xs text-amber-200/80 mt-1">
                  Thiếu key cho:{" "}
                  {missingReqs.map((r, i) => (
                    <span key={r} className="font-mono">
                      {REQUIREMENTS[r]?.label || r}
                      {i < missingReqs.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              </div>
            </div>
            <a
              href="/dashboard/settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-black transition-colors shrink-0"
            >
              Mở Cấu hình hệ thống
              <ExternalLink size={14} />
            </a>
          </div>
        )}

        <div className={blocked ? "opacity-60 pointer-events-none select-none" : ""}>{children}</div>
      </div>
    </div>
  );
}
