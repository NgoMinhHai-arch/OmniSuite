"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function ContentRepurposerPage() {
  return (
    <LlmTextTool
      title="Content Repurposer"
      description="Chuyển bài viết thành các format khác: thread Twitter, LinkedIn post, video script ngắn, email newsletter."
      systemPrompt="Bạn là copywriter đa nền tảng. Tái sử dụng bài viết đầu vào theo định dạng người dùng yêu cầu. Giữ nguyên tone (chuyên nghiệp), thêm CTA, không bịa số liệu."
      fields={[
        { name: "format", label: "Format mục tiêu", rows: 1, placeholder: "Twitter thread / LinkedIn post / 60-second video / Email newsletter" },
        { name: "content", label: "Bài viết gốc", rows: 14 },
      ]}
    />
  );
}
