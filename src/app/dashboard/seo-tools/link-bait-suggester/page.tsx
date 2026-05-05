"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function LinkBaitSuggesterPage() {
  return (
    <LlmTextTool
      title="Link Bait Suggester"
      description="AI gợi ý 10 ý tưởng nội dung 'link-bait' (statistics, original research, free tools, controversial takes...)."
      systemPrompt="Bạn là digital PR strategist. Trả JSON {ideas: [{angle, title, link_potential_1to10, why}]}."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { ideas?: Array<{ angle?: string; title?: string; link_potential_1to10?: number; why?: string }> };
        return (x.ideas || []).map((i) => ({ Angle: String(i.angle || ""), Title: String(i.title || ""), Score: String(i.link_potential_1to10 ?? ""), Why: String(i.why || "") }));
      }}
      listColumns={["Angle", "Title", "Score", "Why"]}
      csvName="link-bait.csv"
      fields={[{ name: "topic", label: "Chủ đề / ngành", rows: 2, placeholder: "SaaS chăm sóc khách hàng" }]}
    />
  );
}
