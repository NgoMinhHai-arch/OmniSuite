"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function CategoryTitleSuggesterPage() {
  return (
    <LlmTextTool
      title="Category Title Suggester"
      description="Đề xuất tiêu đề danh mục e-commerce có ưu hoá keyword."
      systemPrompt="Bạn là SEO copywriter cho e-commerce. Sinh 5 biến thể tiêu đề danh mục cho mỗi danh mục đầu vào. Trả JSON {items: [{category, suggestions: [string]}]}."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { items?: Array<{ category?: string; suggestions?: string[] }> };
        const rows: Array<Record<string, string>> = [];
        (x.items || []).forEach((i) => {
          (i.suggestions || []).forEach((s, idx) => rows.push({ Category: String(i.category || ""), Variant: `#${idx + 1}`, Title: String(s) }));
        });
        return rows;
      }}
      listColumns={["Category", "Variant", "Title"]}
      csvName="category-titles.csv"
      fields={[{ name: "categories", label: "Danh mục (mỗi dòng 1)", rows: 10 }]}
    />
  );
}
