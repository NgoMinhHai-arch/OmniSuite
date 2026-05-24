"use client";

import { useState } from "react";
import { Loader2, Play, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface ImageProps { color: { red?: number; green?: number; blue?: number }; pixelFraction?: number; score?: number }

interface Row { url: string; isWhite: boolean; dominantColor: string; pixelShare: number; error?: string }

async function checkOne(imageUrl: string, apiKey: string): Promise<Row> {
  const resp = await fetch("/api/seo/google-vision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, apiKey, features: ["IMAGE_PROPERTIES"] }),
  });
  const data = await resp.json();
  if (!resp.ok) return { url: imageUrl, isWhite: false, dominantColor: "", pixelShare: 0, error: data?.error || "Lỗi" };
  const colors = data.responses?.[0]?.imagePropertiesAnnotation?.dominantColors?.colors as ImageProps[] | undefined;
  if (!colors?.length) return { url: imageUrl, isWhite: false, dominantColor: "", pixelShare: 0 };
  const top = colors[0];
  const r = top.color.red ?? 0, g = top.color.green ?? 0, b = top.color.blue ?? 0;
  const isWhite = r > 235 && g > 235 && b > 235 && (top.pixelFraction || 0) > 0.4;
  return { url: imageUrl, isWhite, dominantColor: `rgb(${r},${g},${b})`, pixelShare: (top.pixelFraction || 0) * 100 };
}

export default function NonWhiteBackgroundDetectorPage() {
  const [raw, setRaw] = useState("");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setRows([]);
    try {
      const local = JSON.parse(localStorage.getItem("omnisuite_settings") || "{}");
      const apiKey = local.google_vision_api_key;
      if (!apiKey) throw new Error("Thiếu Google Vision API key");
      const urls = raw.split(/\r?\n/).map((s) => s.trim()).filter((u) => u.startsWith("http"));
      const out: Row[] = [];
      for (const u of urls.slice(0, 25)) out.push(await checkOne(u, apiKey));
      setRows(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    if (!rows.length) return;
    downloadAsCsv("non-white-bg.csv", ["URL", "White?", "Dominant", "Pixel %"], rows.map((r) => [r.url, r.isWhite ? "yes" : "no", r.dominantColor, r.pixelShare.toFixed(1)]));
  };

  return (
    <ToolShell
      title="Non-White Background Detector"
      description="Phát hiện ảnh sản phẩm không có nền trắng (chưa chuẩn product feed) qua Google Vision."
      requires={["googlevision"]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={8} placeholder="https://shop/img1.jpg"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <div className="flex gap-2">
          <button onClick={handleRun} disabled={running || !raw.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Kiểm tra
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
              <tr><th className="text-left p-3">URL</th><th className="text-center p-3">White?</th><th className="text-left p-3">Dominant</th><th className="text-right p-3">Pixel %</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3 truncate max-w-[300px] font-mono" style={{ color: "var(--text-primary)" }}>{r.url}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${r.isWhite ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                      {r.isWhite ? "white" : "non-white"}
                    </span>
                  </td>
                  <td className="p-3 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{r.dominantColor}</td>
                  <td className="p-3 text-right font-mono">{r.pixelShare.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
