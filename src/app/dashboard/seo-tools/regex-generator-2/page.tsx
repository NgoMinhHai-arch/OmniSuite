"use client";

import { LlmTextTool } from "@/components/seo/LlmTextTool";

export default function RegexGenerator2Page() {
  return (
    <LlmTextTool
      title="Regex Generator (AI)"
      description="Mô tả nhu cầu bằng tiếng Việt → AI sinh regex + giải thích từng phần."
      systemPrompt="Bạn là chuyên gia regex (PCRE2). Trả JSON {regex, flags, explanation, examples_match: [string], examples_nomatch: [string]}."
      jsonMode
      jsonExtractList={(p) => {
        const x = p as { regex?: string; flags?: string; explanation?: string; examples_match?: string[]; examples_nomatch?: string[] };
        return [
          { Field: "Regex", Value: String(x.regex || "") },
          { Field: "Flags", Value: String(x.flags || "") },
          { Field: "Explanation", Value: String(x.explanation || "") },
          { Field: "✅ Match", Value: (x.examples_match || []).join(" | ") },
          { Field: "❌ No match", Value: (x.examples_nomatch || []).join(" | ") },
        ];
      }}
      listColumns={["Field", "Value"]}
      csvName="regex.csv"
      fields={[{ name: "request", label: "Mô tả", rows: 5, placeholder: "Bắt mọi URL có /product/[id] với id là số ≥ 4 chữ số" }]}
    />
  );
}
