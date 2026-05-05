"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function SerpTitleGeneratorPage() {
  return (
    <LlmTextTool
      title="SERP Title Generator"
      description="Sinh title chuẩn SERP — phân tích ý đồ từ khoá rồi tối ưu."
      systemPrompt="Bạn là chuyên gia SERP. Trả JSON {best, alternatives: [string], reasoning} — best là title tối ưu nhất, alternatives là 5 biến thể khác."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { best?: string; alternatives?: string[] };
        const rows: Array<Record<string, string>> = [{ Title: String(x.best || ""), Type: "Best" }];
        (x.alternatives || []).forEach((a) => rows.push({ Title: String(a), Type: "Alternative" }));
        return rows;
      }}
      listColumns={["Type", "Title"]}
      csvName="serp-titles.csv"
      fields={[
        { name: "keyword", label: "Keyword", rows: 1 },
        { name: "competitors", label: "Title của top SERP (paste, mỗi dòng 1)", rows: 8, required: false },
      ]}
    />
  );
}
