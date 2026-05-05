"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function ContentHubClassificationPage() {
  return (
    <LlmTextTool
      title="Content Hub Classification"
      description="Gán mỗi bài viết vào hub/cluster phù hợp dựa trên cấu trúc bạn định nghĩa."
      systemPrompt="Bạn là content strategist. Gán mỗi bài viết vào 1 hub/cluster. Trả JSON {items: [{title, hub, cluster, why}]}."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { items?: Array<{ title?: string; hub?: string; cluster?: string; why?: string }> };
        return (x.items || []).map((i) => ({ Title: String(i.title || ""), Hub: String(i.hub || ""), Cluster: String(i.cluster || ""), Why: String(i.why || "") }));
      }}
      listColumns={["Title", "Hub", "Cluster", "Why"]}
      csvName="hub-classification.csv"
      fields={[
        { name: "structure", label: "Cấu trúc hub/cluster có sẵn", rows: 6, placeholder: "Hub: SEO\n  - Cluster: Technical SEO\n  - Cluster: Local SEO" },
        { name: "titles", label: "Tiêu đề bài (mỗi dòng 1)", rows: 12 },
      ]}
    />
  );
}
