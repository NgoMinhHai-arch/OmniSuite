"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function AutomaticCategorySuggesterPage() {
  return (
    <LlmTextTool
      title="Auto Category Suggester"
      description="Đọc danh sách sản phẩm → đề xuất cây danh mục (parent/child) hợp lý cho e-commerce."
      systemPrompt="Bạn là e-commerce taxonomist. Trả JSON {tree: [{category, sub_categories: [string], example_products: [string]}]}."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { tree?: Array<{ category?: string; sub_categories?: string[]; example_products?: string[] }> };
        const rows: Array<Record<string, string>> = [];
        (x.tree || []).forEach((c) => {
          (c.sub_categories || []).forEach((s) => rows.push({
            Category: String(c.category || ""),
            Subcategory: String(s),
            "Example products": (c.example_products || []).join(", "),
          }));
        });
        return rows;
      }}
      listColumns={["Category", "Subcategory", "Example products"]}
      csvName="auto-categories.csv"
      fields={[{ name: "products", label: "Tên sản phẩm (mỗi dòng 1)", rows: 14 }]}
    />
  );
}
