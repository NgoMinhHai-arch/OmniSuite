"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function TopicalMapGeneratorPage() {
  return (
    <LlmTextTool
      title="Topical Map Generator"
      description="Sinh bản đồ chủ đề (pillar → cluster → article) đầy đủ cho website."
      systemPrompt="Bạn là SEO topical authority architect. Trả JSON {pillars: [{name, clusters: [{name, articles: [string]}]}]}."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { pillars?: Array<{ name?: string; clusters?: Array<{ name?: string; articles?: string[] }> }> };
        const rows: Array<Record<string, string>> = [];
        (x.pillars || []).forEach((pi) => {
          (pi.clusters || []).forEach((c) => {
            (c.articles || []).forEach((a) => rows.push({ Pillar: String(pi.name || ""), Cluster: String(c.name || ""), Article: String(a) }));
          });
        });
        return rows;
      }}
      listColumns={["Pillar", "Cluster", "Article"]}
      csvName="topical-map.csv"
      fields={[{ name: "seed", label: "Chủ đề trụ", rows: 2, placeholder: "Marketing nội dung B2B" }]}
    />
  );
}
