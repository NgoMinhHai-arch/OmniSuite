"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function MicroMomentsClassifierPage() {
  return (
    <LlmTextTool
      title="Micro-Moments Classifier"
      description="Phân loại keyword theo Google's micro-moments: I want to know / go / do / buy."
      systemPrompt="Bạn là planner SEO. Phân loại mỗi keyword vào 1 trong 4 micro-moments của Google: know, go, do, buy. Trả JSON {items: [{keyword, moment, why}]}."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { items?: Array<{ keyword?: string; moment?: string; why?: string }> };
        return (x.items || []).map((i) => ({ Keyword: String(i.keyword || ""), Moment: String(i.moment || ""), Why: String(i.why || "") }));
      }}
      listColumns={["Keyword", "Moment", "Why"]}
      csvName="micro-moments.csv"
      fields={[{ name: "keywords", label: "Keyword (mỗi dòng 1)", rows: 14 }]}
    />
  );
}
