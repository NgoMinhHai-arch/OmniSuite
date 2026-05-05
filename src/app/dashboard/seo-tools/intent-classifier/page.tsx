"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function IntentClassifierPage() {
  return (
    <LlmTextTool
      title="Intent Classifier"
      description="Phân loại ý định tìm kiếm: Informational / Navigational / Commercial / Transactional."
      systemPrompt="Bạn là chuyên gia SEO. Phân loại intent của từng keyword. Trả JSON {items: [{keyword, intent, confidence}]}, confidence 0-1."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { items?: Array<{ keyword?: string; intent?: string; confidence?: number }> };
        return (x.items || []).map((i) => ({ Keyword: String(i.keyword || ""), Intent: String(i.intent || ""), Confidence: String(i.confidence ?? "") }));
      }}
      listColumns={["Keyword", "Intent", "Confidence"]}
      csvName="intent.csv"
      fields={[{ name: "keywords", label: "Keyword (mỗi dòng 1)", rows: 14 }]}
    />
  );
}
