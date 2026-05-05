"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function LlmSitemapCreatorPage() {
  return (
    <LlmTextTool
      title="LLM Sitemap Creator"
      description="AI dựng cấu trúc sitemap (URL slug + tiêu đề) cho website mới dựa trên seed keyword."
      systemPrompt="Bạn là information architect. Trả JSON {pages: [{url_slug, title, parent_slug, intent}]}. parent_slug rỗng = trang gốc."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { pages?: Array<{ url_slug?: string; title?: string; parent_slug?: string; intent?: string }> };
        return (x.pages || []).map((p) => ({ URL: String(p.url_slug || ""), Title: String(p.title || ""), Parent: String(p.parent_slug || ""), Intent: String(p.intent || "") }));
      }}
      listColumns={["URL", "Title", "Parent", "Intent"]}
      csvName="llm-sitemap.csv"
      fields={[
        { name: "seed", label: "Seed keyword / chủ đề", rows: 1 },
        { name: "scope", label: "Mô tả phạm vi & target audience", rows: 4 },
      ]}
    />
  );
}
