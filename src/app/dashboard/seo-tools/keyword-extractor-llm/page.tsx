"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function KeywordExtractorLlmPage() {
  return (
    <LlmTextTool
      title="Keyword Extractor (LLM)"
      description="AI bóc cụm từ khoá quan trọng và phân loại: head, body, long-tail, branded."
      systemPrompt="Bạn là chuyên gia SEO. Trả về JSON {keywords: [{phrase, category, intent}]} với category là head|body|long_tail|branded; intent là informational|navigational|commercial|transactional."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { keywords?: Array<{ phrase?: string; category?: string; intent?: string }> };
        return (x.keywords || []).map((k) => ({ Phrase: String(k.phrase || ""), Category: String(k.category || ""), Intent: String(k.intent || "") }));
      }}
      listColumns={["Phrase", "Category", "Intent"]}
      csvName="keywords.csv"
      fields={[{ name: "content", label: "Văn bản", rows: 14 }]}
    />
  );
}
