"use client";

import { useState } from "react";
import { Loader2, Play, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface Row { keyword: string; volume?: number; cpc?: number; competition?: number; source: "KE" | "DataForSEO" }

interface KEResult { keyword?: string; vol?: number; cpc?: { value?: number } | number; competition?: number }
interface DfsRow { keyword?: string; search_volume?: number; cpc?: number; competition?: number }

export default function KeywordsEverywherePage() {
  const [raw, setRaw] = useState("");
  const [country, setCountry] = useState("us");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"KE" | "DataForSEO" | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setRows([]);
    setSource(null);
    try {
      const local = JSON.parse(localStorage.getItem("omnisuite_settings") || "{}");
      const keywords = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (!keywords.length) throw new Error("Hãy nhập keyword");

      const keKey = (local.keywords_everywhere_api_key || "").trim();
      if (keKey) {
        const formData = new URLSearchParams();
        keywords.forEach((k) => formData.append("kw[]", k));
        formData.set("country", country);
        formData.set("currency", "USD");
        formData.set("dataSource", "gkp");
        const resp = await fetch("https://api.keywordseverywhere.com/v1/get_keyword_data", {
          method: "POST",
          headers: { Authorization: `Bearer ${keKey}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error((data && (data.message || data.error)) || `KE HTTP ${resp.status}`);
        const out: Row[] = ((data.data || []) as KEResult[]).map((d) => ({
          keyword: d.keyword || "",
          volume: typeof d.vol === "number" ? d.vol : undefined,
          cpc: typeof d.cpc === "object" && d.cpc ? (d.cpc as { value?: number }).value : (typeof d.cpc === "number" ? d.cpc : undefined),
          competition: d.competition,
          source: "KE",
        }));
        setRows(out);
        setSource("KE");
        return;
      }

      // fallback DataForSEO
      const resp = await fetch("/api/seo/dataforseo/volume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          location_code: 2840,
          language_code: "vi",
          user: local.dataforseo_user,
          pass: local.dataforseo_pass,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Cần Keywords Everywhere hoặc DataForSEO key.");
      const out: Row[] = (data.items as DfsRow[]).map((d) => ({
        keyword: d.keyword || "",
        volume: d.search_volume,
        cpc: d.cpc,
        competition: d.competition,
        source: "DataForSEO",
      }));
      setRows(out);
      setSource("DataForSEO");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    if (!rows.length) return;
    downloadAsCsv("keywords-everywhere.csv", ["Keyword", "Volume", "CPC", "Competition", "Source"],
      rows.map((r) => [r.keyword, r.volume ?? "", r.cpc ?? "", r.competition ?? "", r.source]));
  };

  return (
    <ToolShell
      title="Keywords Everywhere"
      description="Volume/CPC/Competition cho danh sách keyword. Ưu tiên Keywords Everywhere; nếu không có key, fallback DataForSEO."
      requires={["keywordseverywhere"]}
      allowRunWithoutKeys
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={10} placeholder="seed keyword (mỗi dòng 1)"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
            Country (KE):
            <input value={country} onChange={(e) => setCountry(e.target.value)} className="ml-2 w-16 rounded-lg px-2 py-1 text-sm font-mono"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
          </label>
          <button onClick={handleRun} disabled={running || !raw.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "Đang gọi..." : "Lấy data"}
          </button>
          {rows.length > 0 && (
            <button onClick={handleExport} className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1">
              <Download size={14} /> CSV
            </button>
          )}
        </div>
      </div>
      {source && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nguồn dữ liệu: <b className="text-cyan-400">{source}</b></p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {rows.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr>
                <th className="text-left p-3">Keyword</th>
                <th className="text-right p-3">Volume</th>
                <th className="text-right p-3">CPC</th>
                <th className="text-right p-3">Competition</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3" style={{ color: "var(--text-primary)" }}>{r.keyword}</td>
                  <td className="p-3 text-right font-mono text-cyan-400">{r.volume ?? "—"}</td>
                  <td className="p-3 text-right font-mono">{r.cpc ?? "—"}</td>
                  <td className="p-3 text-right font-mono">{r.competition ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
