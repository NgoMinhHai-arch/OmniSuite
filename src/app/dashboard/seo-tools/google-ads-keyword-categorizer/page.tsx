"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function GoogleAdsKeywordCategorizerPage() {
  return (
    <LlmTextTool
      title="Google Ads Keyword Categorizer"
      description="Phân nhóm keyword Ads theo ad group hợp lý + match type khuyến nghị (broad/phrase/exact)."
      systemPrompt="Bạn là Google Ads strategist. Trả JSON {groups: [{name, keywords: [{kw, match_type}]}]}."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { groups?: Array<{ name?: string; keywords?: Array<{ kw?: string; match_type?: string }> }> };
        const rows: Array<Record<string, string>> = [];
        (x.groups || []).forEach((g) => {
          (g.keywords || []).forEach((k) => rows.push({ "Ad group": String(g.name || ""), Keyword: String(k.kw || ""), "Match type": String(k.match_type || "") }));
        });
        return rows;
      }}
      listColumns={["Ad group", "Keyword", "Match type"]}
      csvName="ads-categorizer.csv"
      fields={[{ name: "keywords", label: "Keyword (mỗi dòng 1)", rows: 14 }]}
    />
  );
}
