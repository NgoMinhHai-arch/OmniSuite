"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function OpenAIEntityVisualizerPage() {
  return (
    <LlmTextTool
      title="Entity Visualizer"
      description="AI bóc tách các entity (PERSON, ORG, LOC, PRODUCT, EVENT, OTHER) và độ liên quan."
      systemPrompt="Bạn là NER expert. Trả JSON {entities: [{text, type, salience, context}]} salience 0-1."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { entities?: Array<{ text?: string; type?: string; salience?: number; context?: string }> };
        return (x.entities || []).map((e) => ({ Entity: String(e.text || ""), Type: String(e.type || ""), Salience: String(e.salience ?? ""), Context: String(e.context || "") }));
      }}
      listColumns={["Entity", "Type", "Salience", "Context"]}
      csvName="entities.csv"
      fields={[{ name: "content", label: "Văn bản", rows: 14 }]}
    />
  );
}
