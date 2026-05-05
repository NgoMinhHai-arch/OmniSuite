"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv, parseCsv } from "@/lib/seo/csv";

interface Row { date: string; value: number }

function parseSeries(raw: string): Row[] {
  const rows = parseCsv(raw);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  const idxDate = header.findIndex((h) => /date|ngày/.test(h));
  const idxValue = header.findIndex((h) => /value|qty|sales|stock|impression|click/.test(h));
  if (idxDate === -1 || idxValue === -1) return [];
  return rows
    .slice(1)
    .map((r) => ({ date: (r[idxDate] || "").trim(), value: Number(String(r[idxValue] || "0").replace(/[^0-9.\-]/g, "")) || 0 }))
    .filter((r) => r.date);
}

function movingAverage(values: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
}

function linearRegression(values: number[]) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0 };
  const xs = values.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * values[i], 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);
  const denom = n * sumXX - sumX * sumX || 1;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function forecast(values: number[], horizon: number) {
  const ma = movingAverage(values, Math.min(7, values.length));
  const { slope, intercept } = linearRegression(values);
  const seasonalFactor = values.length >= 14 ? values.slice(-7).reduce((a, b) => a + b, 0) / Math.max(1, values.slice(-14, -7).reduce((a, b) => a + b, 0)) : 1;
  const last = values.length;
  const out: number[] = [];
  for (let i = 1; i <= horizon; i++) {
    const trend = slope * (last + i) + intercept;
    const blended = (trend * 0.6 + (ma.at(-1) || trend) * 0.4) * (isFinite(seasonalFactor) ? seasonalFactor : 1);
    out.push(Math.max(0, blended));
  }
  return out;
}

export default function ForecastInventoryTrendsPage() {
  const [raw, setRaw] = useState("");
  const [horizon, setHorizon] = useState(14);

  const series = useMemo(() => parseSeries(raw), [raw]);
  const projected = useMemo(() => (series.length ? forecast(series.map((s) => s.value), horizon) : []), [series, horizon]);

  const handleExport = () => {
    if (!projected.length) return;
    const lastDate = series.at(-1)?.date || new Date().toISOString().slice(0, 10);
    let baseDate = new Date(lastDate);
    if (Number.isNaN(baseDate.getTime())) baseDate = new Date();
    const rows: (string | number)[][] = [];
    series.forEach((s) => rows.push([s.date, s.value, "actual"]));
    projected.forEach((v, i) => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i + 1);
      rows.push([d.toISOString().slice(0, 10), v.toFixed(2), "forecast"]);
    });
    downloadAsCsv("forecast.csv", ["Date", "Value", "Type"], rows);
  };

  return (
    <ToolShell
      title="Forecast (Inventory / Trends)"
      description="Dự báo theo time-series đơn giản (linear trend + moving average + tỉ lệ tuần). Phù hợp cho stock sản phẩm hoặc impressions."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          placeholder={"Date,Value\n2025-01-01,120\n2025-01-02,135"}
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
        />
        <div className="flex items-center gap-3">
          <label className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
            Horizon (ngày):
            <input
              type="number"
              value={horizon}
              onChange={(e) => setHorizon(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
              className="ml-2 w-20 rounded-lg px-2 py-1 text-sm font-bold text-cyan-400"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)" }}
            />
          </label>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{series.length} điểm dữ liệu</span>
          {projected.length > 0 && (
            <button onClick={handleExport} className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
              <Download size={14} /> CSV
            </button>
          )}
        </div>
      </div>

      {projected.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr><th className="text-left p-3">+ngày</th><th className="text-right p-3">Forecast</th></tr>
            </thead>
            <tbody>
              {projected.slice(0, 60).map((v, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3 font-bold" style={{ color: "var(--text-primary)" }}>+{i + 1}</td>
                  <td className="p-3 text-right font-mono text-cyan-400">{v.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
