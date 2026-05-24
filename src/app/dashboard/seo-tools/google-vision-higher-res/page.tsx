"use client";

import { useState } from "react";
import { Loader2, Play, ExternalLink } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";

interface FullMatchingImage { url?: string; score?: number }
interface VisionResp { responses?: Array<{ webDetection?: { fullMatchingImages?: FullMatchingImage[]; partialMatchingImages?: FullMatchingImage[]; visuallySimilarImages?: FullMatchingImage[] } }> }

export default function GoogleVisionHigherResPage() {
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [matches, setMatches] = useState<FullMatchingImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setMatches([]);
    try {
      const local = JSON.parse(localStorage.getItem("omnisuite_settings") || "{}");
      const resp = await fetch("/api/seo/google-vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url.trim(), apiKey: local.google_vision_api_key, features: ["WEB_DETECTION"] }),
      });
      const data = (await resp.json()) as VisionResp & { error?: string };
      if (!resp.ok) throw new Error(data?.error || "Lỗi");
      const wd = data.responses?.[0]?.webDetection;
      const out: FullMatchingImage[] = [
        ...(wd?.fullMatchingImages || []),
        ...(wd?.partialMatchingImages || []),
      ];
      setMatches(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  return (
    <ToolShell
      title="Google Vision High-Res Finder"
      description="Tìm phiên bản ảnh độ phân giải cao hơn trên web cho 1 URL ảnh (Vision Web Detection)."
      requires={["googlevision"]}
    >
      <div className="rounded-2xl p-6 flex gap-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://shop.example.com/img/product.jpg"
          className="flex-1 rounded-xl px-4 py-2.5 text-sm font-mono"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <button onClick={handleRun} disabled={running || !url.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Tìm
        </button>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {matches.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {matches.slice(0, 24).map((m, i) => (
            <a key={i} href={m.url} target="_blank" rel="noreferrer" className="rounded-xl overflow-hidden block aspect-square" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute right-1 top-1"><ExternalLink size={10} className="text-cyan-400" /></div>
            </a>
          ))}
        </div>
      )}
    </ToolShell>
  );
}
