"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function MetaRewriterPage() {
  return (
    <LlmTextTool
      title="Meta Rewriter"
      description="Viết lại meta description theo chuẩn SERP (130–155 ký tự, có CTA, có keyword chính)."
      systemPrompt="Bạn là chuyên gia SEO copywriter người Việt. Mỗi lần được yêu cầu, bạn viết lại meta description tối ưu CTR: dài 130–155 ký tự, có keyword chính, kết thúc bằng CTA tự nhiên, không dùng từ tuyệt đối nếu không có dữ liệu chứng minh. Trả về dạng JSON {variants: [{text, length, score}]} với 5 biến thể, score 1-10."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { variants?: Array<{ text?: string; length?: number; score?: number }> };
        return (x.variants || []).map((v) => ({
          Variant: String(v.text || ""),
          Length: String(v.length ?? (v.text || "").length),
          Score: String(v.score ?? "—"),
        }));
      }}
      listColumns={["Variant", "Length", "Score"]}
      csvName="meta-variants.csv"
      fields={[
        { name: "current", label: "Meta hiện tại (nếu có)", rows: 3, required: false },
        { name: "page_title", label: "Tiêu đề trang", rows: 1 },
        { name: "primary_keyword", label: "Keyword chính" },
        { name: "summary", label: "Tóm tắt nội dung trang (1–2 câu)", rows: 4 },
      ]}
    />
  );
}
