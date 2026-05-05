"use client";

import { useState } from "react";
import { Loader2, Play, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { rankBySimilarity } from "@/lib/seo/embeddings";
import { downloadAsCsv } from "@/lib/seo/csv";

interface WooProduct { id: number; name: string; permalink: string; slug?: string; categories?: { name: string }[] }

export default function WooRelevancyPage() {
  const [categoryName, setCategoryName] = useState("");
  const [running, setRunning] = useState(false);
  const [products, setProducts] = useState<WooProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!categoryName.trim()) return;
    setRunning(true);
    setError(null);
    setProducts([]);
    try {
      const local = JSON.parse(localStorage.getItem("omnisuite_settings") || "{}");
      const resp = await fetch("/api/seo/woocommerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeUrl: local.woo_store_url,
          consumerKey: local.woo_consumer_key,
          consumerSecret: local.woo_consumer_secret,
          endpoint: "products",
          query: { search: categoryName.trim(), per_page: 100 },
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Lỗi");
      const items: WooProduct[] = data.data || [];
      const ranked = rankBySimilarity(categoryName, items.map((p) => `${p.name} ${(p.categories || []).map((c) => c.name).join(" ")}`));
      const sorted: WooProduct[] = ranked
        .map((r) => items.find((p) => `${p.name} ${(p.categories || []).map((c) => c.name).join(" ")}` === r.text)!)
        .filter(Boolean);
      setProducts(sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    if (!products.length) return;
    downloadAsCsv("woo-relevancy.csv", ["Rank", "ID", "Name", "Permalink", "Categories"],
      products.map((p, i) => [i + 1, p.id, p.name, p.permalink, (p.categories || []).map((c) => c.name).join(" | ")]));
  };

  return (
    <ToolShell
      title="WooCommerce Relevancy"
      description="Sắp xếp sản phẩm WooCommerce theo độ liên quan với một category/keyword (TF-IDF)."
      requires={["woocommerce"]}
    >
      <div className="rounded-2xl p-6 flex gap-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Tên danh mục / keyword"
          className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <button onClick={handleRun} disabled={running || !categoryName.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Phân tích
        </button>
        {products.length > 0 && (
          <button onClick={handleExport} className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1">
            <Download size={14} /> CSV
          </button>
        )}
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {products.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <table className="w-full text-sm">
            <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              <tr><th className="text-right p-3">#</th><th className="text-left p-3">Name</th><th className="text-left p-3">Categories</th></tr>
            </thead>
            <tbody>
              {products.slice(0, 200).map((p, i) => (
                <tr key={p.id} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                  <td className="p-3 text-right font-mono text-cyan-400">{i + 1}</td>
                  <td className="p-3" style={{ color: "var(--text-primary)" }}>
                    <a href={p.permalink} target="_blank" rel="noreferrer" className="hover:underline">{p.name}</a>
                  </td>
                  <td className="p-3 text-xs" style={{ color: "var(--text-secondary)" }}>{(p.categories || []).map((c) => c.name).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToolShell>
  );
}
