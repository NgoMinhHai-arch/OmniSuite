"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function CategoryKeywordFinderPage() {
  return (
    <LlmTextTool
      title="Category Keyword Finder"
      description="Sinh 30 keyword cho mỗi category, có gắn intent."
      systemPrompt="Bạn là SEO strategist. Sinh 30 keyword cho category, gắn intent. Trả JSON {items: [{keyword, intent}]}."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { items?: Array<{ keyword?: string; intent?: string }> };
        return (x.items || []).map((i) => ({ Keyword: String(i.keyword || ""), Intent: String(i.intent || "") }));
      }}
      listColumns={["Keyword", "Intent"]}
      csvName="category-keywords.csv"
      fields={[{ name: "category", label: "Category", rows: 1, placeholder: "Thời trang nam công sở" }]}
    />
  );
}
