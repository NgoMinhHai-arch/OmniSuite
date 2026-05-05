"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function GistSummaryGeneratorPage() {
  return (
    <LlmTextTool
      title="Gist Summary Generator"
      description="Tóm tắt 'at a glance' (ngắn, gạch đầu dòng, có TL;DR) cho bài viết dài."
      systemPrompt="Bạn là biên tập viên. Trả về Markdown gồm: 1) TL;DR 1 câu, 2) 3-5 ý chính bullet, 3) Quote tâm đắc nhất."
      fields={[{ name: "content", label: "Nội dung", rows: 16 }]}
    />
  );
}
