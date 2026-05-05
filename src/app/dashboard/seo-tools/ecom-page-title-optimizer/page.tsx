"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function EcomPageTitleOptimizerPage() {
  return (
    <LlmTextTool
      title="E-com Page Title Optimizer"
      description="Tối ưu title trang sản phẩm dựa trên impressions/CTR thực tế (paste từ GSC) — AI gợi ý biến thể tốt hơn."
      systemPrompt="Bạn là SEO cho e-commerce. Với mỗi sản phẩm, đọc keyword + CTR hiện tại, đề xuất 3 title cải thiện CTR. Trả JSON {items: [{product, current_title, suggestions: [string], reason}]}."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { items?: Array<{ product?: string; current_title?: string; suggestions?: string[]; reason?: string }> };
        const rows: Array<Record<string, string>> = [];
        (x.items || []).forEach((it) => {
          (it.suggestions || []).forEach((s, i) => rows.push({
            Product: String(it.product || ""),
            "Current title": String(it.current_title || ""),
            Variant: `#${i + 1}`,
            "Suggested title": String(s),
            Reason: String(it.reason || ""),
          }));
        });
        return rows;
      }}
      listColumns={["Product", "Current title", "Variant", "Suggested title", "Reason"]}
      csvName="title-optimizer.csv"
      fields={[
        { name: "data", label: "Dữ liệu (Product | Current title | Top keyword | CTR%)", rows: 12, placeholder: "iPhone 15 Pro Max | iPhone 15 Pro Max chính hãng | iphone 15 pro max | 1.2" },
      ]}
    />
  );
}
