"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function TitleSuggesterPage() {
  return (
    <LlmTextTool
      title="Title Suggester"
      description="Sinh 10 biến thể title bài viết tối ưu CTR (≤ 60 ký tự, có keyword chính)."
      systemPrompt="Bạn là copywriter SEO. Sinh 10 biến thể title trong 60 ký tự, có keyword chính, mỗi biến thể có angle khác nhau (How-to, List, Question, Provoke, Benefit-driven). Trả JSON {variants: [{title, length, angle}]}."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { variants?: Array<{ title?: string; length?: number; angle?: string }> };
        return (x.variants || []).map((v) => ({ Title: String(v.title || ""), Length: String(v.length ?? (v.title || "").length), Angle: String(v.angle || "") }));
      }}
      listColumns={["Title", "Length", "Angle"]}
      csvName="title-variants.csv"
      fields={[
        { name: "primary_keyword", label: "Keyword chính", rows: 1 },
        { name: "summary", label: "Tóm tắt nội dung", rows: 5 },
      ]}
    />
  );
}
