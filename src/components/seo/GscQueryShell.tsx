"use client";

import React, { useState } from "react";
import { Loader2, Play, Download } from "lucide-react";
import { ToolShell } from "./ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

export interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface GscQueryShellProps {
  title: string;
  description: string;
  defaultDays?: number;
  defaultDimensions?: ("query" | "page" | "date" | "country" | "device")[];
  rowLimit?: number;
  /** Transform rows before display. */
  transform?: (rows: GscRow[]) => GscRow[];
  columns?: string[];
  hint?: string;
}

function defaultDateRange(days: number) {
  const today = new Date();
  const end = new Date(today);
  end.setDate(today.getDate() - 3);
  const start = new Date(end);
  start.setDate(end.getDate() - days);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function GscQueryShell({
  title,
  description,
  defaultDays = 28,
  defaultDimensions = ["query"],
  rowLimit = 1000,
  transform,
  columns,
  hint,
}: GscQueryShellProps) {
  const initial = defaultDateRange(defaultDays);
  const [siteUrl, setSiteUrl] = useState("");
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [rows, setRows] = useState<GscRow[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runQuery = async () => {
    setRunning(true);
    setError(null);
    try {
      const local = JSON.parse(localStorage.getItem("omnisuite_settings") || "{}");
      const resp = await fetch("/api/seo/gsc/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteUrl: siteUrl || local.gsc_property_uri,
          startDate,
          endDate,
          dimensions: defaultDimensions,
          rowLimit,
          serviceAccountKey: local.gsc_service_account_key,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Lỗi GSC");
      const out = transform ? transform(data.rows || []) : (data.rows || []);
      setRows(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const cols = columns || [...(defaultDimensions || []), "clicks", "impressions", "ctr", "position"];

  const handleExport = () => {
    if (!rows.length) return;
    downloadAsCsv(`gsc-${title.toLowerCase().replace(/\s+/g, "-")}.csv`, cols, rows.map((r) => cols.map((c) => {
      if (defaultDimensions.includes(c as never)) {
        const idx = (defaultDimensions as string[]).indexOf(c);
        return r.keys?.[idx] ?? "";
      }
      const v = (r as unknown as Record<string, unknown>)[c];
      return v == null ? "" : (typeof v === "number" ? v : String(v));
    })));
  };

  return (
    <ToolShell title={title} description={description} requires={["gsc"]}>
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://yoursite.com/ hoặc sc-domain:yoursite.com"
            className="rounded-xl px-3 py-2.5 text-sm font-mono"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm font-mono"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm font-mono"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        </div>
        {hint && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{hint}</p>}
        <div className="flex items-center gap-2">
          <button onClick={runQuery} disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "Đang gọi GSC..." : "Lấy dữ liệu"}
          </button>
          {rows.length > 0 && (
            <button onClick={handleExport} className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1">
              <Download size={14} /> CSV
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {rows.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr>
                {cols.map((c) => <th key={c} className="text-left p-3">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  {cols.map((c) => {
                    let val: string | number = "";
                    if (defaultDimensions.includes(c as never)) {
                      const idx = (defaultDimensions as string[]).indexOf(c);
                      val = r.keys?.[idx] ?? "";
                    } else {
                      const v = (r as unknown as Record<string, unknown>)[c];
                      if (typeof v === "number") {
                        val = c === "ctr" ? `${(v * 100).toFixed(2)}%` : c === "position" ? v.toFixed(1) : v.toLocaleString();
                      } else if (v != null) val = String(v);
                    }
                    return <td key={c} className="p-3" style={{ color: "var(--text-primary)" }}>{val}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 500 && (
            <p className="text-xs p-2 text-center" style={{ color: "var(--text-muted)" }}>Hiển thị 500/{rows.length}. Toàn bộ trong CSV.</p>
          )}
        </div>
      )}
    </ToolShell>
  );
}
