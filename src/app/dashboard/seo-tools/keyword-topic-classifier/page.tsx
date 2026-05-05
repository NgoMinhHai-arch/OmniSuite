"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function KeywordTopicClassifierPage() {
  return (
    <LlmTextTool
      title="Keyword Topic Classifier"
      description="Gắn topic chính cho từng keyword (mỗi dòng 1 keyword)."
      systemPrompt="Bạn phân loại từ khoá vào topic ngắn (1-3 từ). Trả về JSON {items: [{keyword, topic, sub_topic}]}. Giữ nguyên thứ tự đầu vào."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { items?: Array<{ keyword?: string; topic?: string; sub_topic?: string }> };
        return (x.items || []).map((i) => ({ Keyword: String(i.keyword || ""), Topic: String(i.topic || ""), Subtopic: String(i.sub_topic || "") }));
      }}
      listColumns={["Keyword", "Topic", "Subtopic"]}
      csvName="topic-classification.csv"
      fields={[{ name: "keywords", label: "Keyword (mỗi dòng 1)", rows: 14 }]}
    />
  );
}
