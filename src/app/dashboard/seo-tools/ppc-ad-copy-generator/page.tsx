"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function PpcAdCopyGeneratorPage() {
  return (
    <LlmTextTool
      title="PPC Ad Copy Generator"
      description="Sinh ad copy Google Ads (15 headlines ≤ 30 ký tự, 4 descriptions ≤ 90 ký tự) cho mỗi keyword chủ đề."
      systemPrompt="Bạn là PPC copywriter. Trả JSON {headlines: [string], descriptions: [string]} — đúng giới hạn ký tự. Headlines tối đa 30, descriptions tối đa 90."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { headlines?: string[]; descriptions?: string[] };
        const rows: Array<Record<string, string>> = [];
        (x.headlines || []).forEach((h, i) => rows.push({ Type: "Headline", Index: String(i + 1), Text: String(h), Length: String((h || "").length) }));
        (x.descriptions || []).forEach((d, i) => rows.push({ Type: "Description", Index: String(i + 1), Text: String(d), Length: String((d || "").length) }));
        return rows;
      }}
      listColumns={["Type", "Index", "Text", "Length"]}
      csvName="ppc-copy.csv"
      fields={[
        { name: "product", label: "Sản phẩm/dịch vụ", rows: 1 },
        { name: "usp", label: "USP / khuyến mãi nổi bật", rows: 4 },
        { name: "keywords", label: "Keyword chủ đề (mỗi dòng 1)", rows: 4, required: false },
      ]}
    />
  );
}
