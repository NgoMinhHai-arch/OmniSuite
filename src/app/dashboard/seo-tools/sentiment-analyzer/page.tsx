"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function SentimentAnalyzerPage() {
  return (
    <LlmTextTool
      title="Sentiment Analyzer"
      description="Phân tích sắc thái (positive/negative/neutral) và lý do cho mỗi review/comment (mỗi dòng 1)."
      systemPrompt="Bạn là phân tích sentiment. Trả JSON {items: [{text, sentiment, score, reason}]}, sentiment ∈ {positive, neutral, negative}, score -1..1."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { items?: Array<{ text?: string; sentiment?: string; score?: number; reason?: string }> };
        return (x.items || []).map((i) => ({ Text: String(i.text || ""), Sentiment: String(i.sentiment || ""), Score: String(i.score ?? ""), Reason: String(i.reason || "") }));
      }}
      listColumns={["Text", "Sentiment", "Score", "Reason"]}
      csvName="sentiment.csv"
      fields={[{ name: "items", label: "Văn bản (mỗi dòng 1)", rows: 14 }]}
    />
  );
}
