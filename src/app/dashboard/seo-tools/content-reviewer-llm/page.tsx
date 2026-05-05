"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function ContentReviewerLlmPage() {
  return (
    <LlmTextTool
      title="Content Reviewer (LLM)"
      description="AI review nội dung theo các tiêu chí E-E-A-T, on-page SEO, intent fit, readability. Trả về điểm và đề xuất sửa."
      systemPrompt="Bạn là biên tập SEO khắt khe. Trả về JSON {overall_score: 0-100, criteria: [{name, score, comment}], top_actions: [string]}. Tiêu chí gồm: keyword coverage, intent match, E-E-A-T signals, structure (H1/H2/H3), readability, internal links, CTAs, originality."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { criteria?: Array<{ name?: string; score?: number; comment?: string }>; overall_score?: number; top_actions?: string[] };
        const rows = (x.criteria || []).map((c) => ({ Criteria: String(c.name || ""), Score: String(c.score ?? ""), Comment: String(c.comment || "") }));
        rows.unshift({ Criteria: "Overall", Score: String(x.overall_score ?? ""), Comment: (x.top_actions || []).join(" • ") });
        return rows;
      }}
      listColumns={["Criteria", "Score", "Comment"]}
      csvName="content-review.csv"
      fields={[{ name: "content", label: "Nội dung cần review", rows: 16, placeholder: "Dán toàn bộ bài viết..." }]}
    />
  );
}
