"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function ContentMergePlannerPage() {
  return (
    <LlmTextTool
      title="Content Merge Planner"
      description="Đề xuất kế hoạch gộp các bài viết trùng intent: bài giữ, bài 301, outline mới."
      systemPrompt="Bạn là SEO content auditor. Khi nhận danh sách URL + tiêu đề, đề xuất nhóm gộp. Trả JSON {merges: [{keep_url, redirect_urls: [string], new_outline: [string], why}]}."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { merges?: Array<{ keep_url?: string; redirect_urls?: string[]; new_outline?: string[]; why?: string }> };
        return (x.merges || []).map((m) => ({
          "Keep URL": String(m.keep_url || ""),
          "301 from": (m.redirect_urls || []).join(", "),
          "New outline": (m.new_outline || []).join(" → "),
          Why: String(m.why || ""),
        }));
      }}
      listColumns={["Keep URL", "301 from", "New outline", "Why"]}
      csvName="merge-plan.csv"
      fields={[{ name: "items", label: "URL | Title (mỗi dòng 1)", rows: 12 }]}
    />
  );
}
