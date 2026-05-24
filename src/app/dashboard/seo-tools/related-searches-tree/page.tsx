"use client";

import { useState } from "react";
import { Loader2, Play, ChevronRight, Download } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";
import { downloadAsCsv } from "@/lib/seo/csv";

interface Node {
  query: string;
  children: Node[];
}

async function fetchRelated(query: string, apiKey: string): Promise<string[]> {
  const resp = await fetch("/api/seo/serpapi-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, apiKey }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || "Lỗi");
  const list: string[] = [];
  (data?.related_searches || []).forEach((r: { query?: string }) => r.query && list.push(r.query));
  return list.slice(0, 8);
}

function flatten(node: Node, out: { level: number; parent: string; query: string }[] = [], parent = "", level = 0) {
  out.push({ level, parent, query: node.query });
  node.children.forEach((c) => flatten(c, out, node.query, level + 1));
  return out;
}

export default function RelatedSearchesTreePage() {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState(2);
  const [running, setRunning] = useState(false);
  const [tree, setTree] = useState<Node | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!query.trim()) return;
    setRunning(true);
    setError(null);
    setTree(null);
    try {
      const apiKey = (typeof window !== "undefined" && JSON.parse(localStorage.getItem("omnisuite_settings") || "{}").serpapi_key) || "";
      const root: Node = { query: query.trim(), children: [] };
      const buildLevel = async (node: Node, level: number) => {
        if (level >= depth) return;
        const related = await fetchRelated(node.query, apiKey);
        node.children = related.map((q) => ({ query: q, children: [] }));
        for (const c of node.children) {
          await buildLevel(c, level + 1);
        }
      };
      await buildLevel(root, 0);
      setTree(root);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    if (!tree) return;
    const flat = flatten(tree);
    downloadAsCsv("related-tree.csv", ["Level", "Parent", "Query"], flat.map((f) => [f.level, f.parent, f.query]));
  };

  const renderNode = (n: Node, level: number): React.ReactNode => (
    <div key={`${level}-${n.query}`} className="ml-4 border-l pl-3 mt-1" style={{ borderColor: "rgba(6,182,212,0.15)" }}>
      <p className="text-sm font-mono flex items-center gap-1" style={{ color: "var(--text-primary)" }}>
        <ChevronRight size={12} className="text-cyan-400" /> {n.query}
      </p>
      {n.children.map((c) => renderNode(c, level + 1))}
    </div>
  );

  return (
    <ToolShell
      title="Related Searches Tree"
      description="Đệ quy lấy related searches từ Google (qua SerpApi) thành cây."
      requires={["serpapi"]}
    >
      <div className="rounded-2xl p-6 flex flex-wrap gap-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="seed keyword"
          className="flex-1 min-w-[200px] rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="rounded-xl px-3 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}>
          <option value={1}>Depth 1</option>
          <option value={2}>Depth 2</option>
          <option value={3}>Depth 3</option>
        </select>
        <button onClick={handleRun} disabled={running || !query.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Phân tích
        </button>
        {tree && (
          <button onClick={handleExport} className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1">
            <Download size={14} /> CSV
          </button>
        )}
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {tree && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{tree.query}</p>
          {tree.children.map((c) => renderNode(c, 1))}
        </div>
      )}
    </ToolShell>
  );
}
