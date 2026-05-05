"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function EntityExtractorPage() {
  return (
    <LlmTextTool
      title="Entity Extractor"
      description="Bóc tách thực thể từ văn bản dài, kèm description ngắn cho từng entity."
      systemPrompt="Bạn là NER expert. Trả JSON {entities: [{text, type, description}]} với type ∈ {PERSON, ORG, LOC, PRODUCT, EVENT, CONCEPT, OTHER}."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { entities?: Array<{ text?: string; type?: string; description?: string }> };
        return (x.entities || []).map((e) => ({ Entity: String(e.text || ""), Type: String(e.type || ""), Description: String(e.description || "") }));
      }}
      listColumns={["Entity", "Type", "Description"]}
      csvName="entities.csv"
      fields={[{ name: "content", label: "Văn bản", rows: 14 }]}
    />
  );
}
