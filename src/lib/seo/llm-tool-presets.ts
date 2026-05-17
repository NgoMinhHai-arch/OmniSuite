/**
 * Cấu hình LlmTextTool theo slug — một nguồn thay cho ~25 page.tsx mỏng.
 * Title/description lấy từ tool-registry khi render.
 */
import type { ComponentProps } from "react";
import type { LlmTextTool } from "@/components/seo/LlmTextTool";

export type LlmToolPreset = Omit<ComponentProps<typeof LlmTextTool>, "title" | "description">;

export const LLM_TOOL_PRESETS: Record<string, LlmToolPreset> = {
  "automatic-category-suggester": {
    systemPrompt:
      "Bạn là e-commerce taxonomist. Trả JSON {tree: [{category, sub_categories: [string], example_products: [string]}]}.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { tree?: Array<{ category?: string; sub_categories?: string[]; example_products?: string[] }> };
      const rows: Array<Record<string, string>> = [];
      (x.tree || []).forEach((c) => {
        (c.sub_categories || []).forEach((s) =>
          rows.push({
            Category: String(c.category || ""),
            Subcategory: String(s),
            "Example products": (c.example_products || []).join(", "),
          }),
        );
      });
      return rows;
    },
    listColumns: ["Category", "Subcategory", "Example products"],
    csvName: "auto-categories.csv",
    fields: [{ name: "products", label: "Tên sản phẩm (mỗi dòng 1)", rows: 14 }],
  },
  "category-keyword-finder": {
    systemPrompt: "Bạn là SEO strategist. Sinh 30 keyword cho category, gắn intent. Trả JSON {items: [{keyword, intent}]}.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { items?: Array<{ keyword?: string; intent?: string }> };
      return (x.items || []).map((i) => ({ Keyword: String(i.keyword || ""), Intent: String(i.intent || "") }));
    },
    listColumns: ["Keyword", "Intent"],
    csvName: "category-keywords.csv",
    fields: [{ name: "category", label: "Category", rows: 1, placeholder: "Thời trang nam công sở" }],
  },
  "category-title-suggester": {
    systemPrompt:
      "Bạn là SEO copywriter cho e-commerce. Sinh 5 biến thể tiêu đề danh mục cho mỗi danh mục đầu vào. Trả JSON {items: [{category, suggestions: [string]}]}.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { items?: Array<{ category?: string; suggestions?: string[] }> };
      const rows: Array<Record<string, string>> = [];
      (x.items || []).forEach((i) => {
        (i.suggestions || []).forEach((s, idx) =>
          rows.push({ Category: String(i.category || ""), Variant: `#${idx + 1}`, Title: String(s) }),
        );
      });
      return rows;
    },
    listColumns: ["Category", "Variant", "Title"],
    csvName: "category-titles.csv",
    fields: [{ name: "categories", label: "Danh mục (mỗi dòng 1)", rows: 10 }],
  },
  "content-hub-classification": {
    systemPrompt: "Bạn là content strategist. Gán mỗi bài viết vào 1 hub/cluster. Trả JSON {items: [{title, hub, cluster, why}]}.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { items?: Array<{ title?: string; hub?: string; cluster?: string; why?: string }> };
      return (x.items || []).map((i) => ({
        Title: String(i.title || ""),
        Hub: String(i.hub || ""),
        Cluster: String(i.cluster || ""),
        Why: String(i.why || ""),
      }));
    },
    listColumns: ["Title", "Hub", "Cluster", "Why"],
    csvName: "hub-classification.csv",
    fields: [
      {
        name: "structure",
        label: "Cấu trúc hub/cluster có sẵn",
        rows: 6,
        placeholder: "Hub: SEO\n  - Cluster: Technical SEO\n  - Cluster: Local SEO",
      },
      { name: "titles", label: "Tiêu đề bài (mỗi dòng 1)", rows: 12 },
    ],
  },
  "content-merge-planner": {
    systemPrompt:
      "Bạn là SEO content auditor. Khi nhận danh sách URL + tiêu đề, đề xuất nhóm gộp. Trả JSON {merges: [{keep_url, redirect_urls: [string], new_outline: [string], why}]}.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { merges?: Array<{ keep_url?: string; redirect_urls?: string[]; new_outline?: string[]; why?: string }> };
      return (x.merges || []).map((m) => ({
        "Keep URL": String(m.keep_url || ""),
        "301 from": (m.redirect_urls || []).join(", "),
        "New outline": (m.new_outline || []).join(" → "),
        Why: String(m.why || ""),
      }));
    },
    listColumns: ["Keep URL", "301 from", "New outline", "Why"],
    csvName: "merge-plan.csv",
    fields: [{ name: "items", label: "URL | Title (mỗi dòng 1)", rows: 12 }],
  },
  "content-repurposer": {
    systemPrompt:
      "Bạn là copywriter đa nền tảng. Tái sử dụng bài viết đầu vào theo định dạng người dùng yêu cầu. Giữ nguyên tone (chuyên nghiệp), thêm CTA, không bịa số liệu.",
    fields: [
      {
        name: "format",
        label: "Format mục tiêu",
        rows: 1,
        placeholder: "Twitter thread / LinkedIn post / 60-second video / Email newsletter",
      },
      { name: "content", label: "Bài viết gốc", rows: 14 },
    ],
  },
  "content-reviewer-llm": {
    systemPrompt:
      "Bạn là biên tập SEO khắt khe. Trả về JSON {overall_score: 0-100, criteria: [{name, score, comment}], top_actions: [string]}. Tiêu chí gồm: keyword coverage, intent match, E-E-A-T signals, structure (H1/H2/H3), readability, internal links, CTAs, originality.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as {
        criteria?: Array<{ name?: string; score?: number; comment?: string }>;
        overall_score?: number;
        top_actions?: string[];
      };
      const rows = (x.criteria || []).map((c) => ({
        Criteria: String(c.name || ""),
        Score: String(c.score ?? ""),
        Comment: String(c.comment || ""),
      }));
      rows.unshift({
        Criteria: "Overall",
        Score: String(x.overall_score ?? ""),
        Comment: (x.top_actions || []).join(" • "),
      });
      return rows;
    },
    listColumns: ["Criteria", "Score", "Comment"],
    csvName: "content-review.csv",
    fields: [{ name: "content", label: "Nội dung cần review", rows: 16, placeholder: "Dán toàn bộ bài viết..." }],
  },
  "ecom-page-title-optimizer": {
    systemPrompt:
      "Bạn là SEO cho e-commerce. Với mỗi sản phẩm, đọc keyword + CTR hiện tại, đề xuất 3 title cải thiện CTR. Trả JSON {items: [{product, current_title, suggestions: [string], reason}]}.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { items?: Array<{ product?: string; current_title?: string; suggestions?: string[]; reason?: string }> };
      const rows: Array<Record<string, string>> = [];
      (x.items || []).forEach((it) => {
        (it.suggestions || []).forEach((s, i) =>
          rows.push({
            Product: String(it.product || ""),
            "Current title": String(it.current_title || ""),
            Variant: `#${i + 1}`,
            "Suggested title": String(s),
            Reason: String(it.reason || ""),
          }),
        );
      });
      return rows;
    },
    listColumns: ["Product", "Current title", "Variant", "Suggested title", "Reason"],
    csvName: "title-optimizer.csv",
    fields: [
      {
        name: "data",
        label: "Dữ liệu (Product | Current title | Top keyword | CTR%)",
        rows: 12,
        placeholder: "iPhone 15 Pro Max | iPhone 15 Pro Max chính hãng | iphone 15 pro max | 1.2",
      },
    ],
  },
  "entity-extractor": {
    systemPrompt:
      "Bạn là NER expert. Trả JSON {entities: [{text, type, description}]} với type ∈ {PERSON, ORG, LOC, PRODUCT, EVENT, CONCEPT, OTHER}.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { entities?: Array<{ text?: string; type?: string; description?: string }> };
      return (x.entities || []).map((e) => ({
        Entity: String(e.text || ""),
        Type: String(e.type || ""),
        Description: String(e.description || ""),
      }));
    },
    listColumns: ["Entity", "Type", "Description"],
    csvName: "entities.csv",
    fields: [{ name: "content", label: "Văn bản", rows: 14 }],
  },
  "gist-summary-generator": {
    systemPrompt:
      "Bạn là biên tập viên. Trả về Markdown gồm: 1) TL;DR 1 câu, 2) 3-5 ý chính bullet, 3) Quote tâm đắc nhất.",
    fields: [{ name: "content", label: "Nội dung", rows: 16 }],
  },
  "google-ads-keyword-categorizer": {
    systemPrompt: "Bạn là Google Ads strategist. Trả JSON {groups: [{name, keywords: [{kw, match_type}]}]}.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { groups?: Array<{ name?: string; keywords?: Array<{ kw?: string; match_type?: string }> }> };
      const rows: Array<Record<string, string>> = [];
      (x.groups || []).forEach((g) => {
        (g.keywords || []).forEach((k) =>
          rows.push({
            "Ad group": String(g.name || ""),
            Keyword: String(k.kw || ""),
            "Match type": String(k.match_type || ""),
          }),
        );
      });
      return rows;
    },
    listColumns: ["Ad group", "Keyword", "Match type"],
    csvName: "ads-categorizer.csv",
    fields: [{ name: "keywords", label: "Keyword (mỗi dòng 1)", rows: 14 }],
  },
  "intent-classifier": {
    systemPrompt:
      "Bạn là chuyên gia SEO. Phân loại intent của từng keyword. Trả JSON {items: [{keyword, intent, confidence}]}, confidence 0-1.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { items?: Array<{ keyword?: string; intent?: string; confidence?: number }> };
      return (x.items || []).map((i) => ({
        Keyword: String(i.keyword || ""),
        Intent: String(i.intent || ""),
        Confidence: String(i.confidence ?? ""),
      }));
    },
    listColumns: ["Keyword", "Intent", "Confidence"],
    csvName: "intent.csv",
    fields: [{ name: "keywords", label: "Keyword (mỗi dòng 1)", rows: 14 }],
  },
  "keyword-extractor-llm": {
    systemPrompt:
      "Bạn là chuyên gia SEO. Trả về JSON {keywords: [{phrase, category, intent}]} với category là head|body|long_tail|branded; intent là informational|navigational|commercial|transactional.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { keywords?: Array<{ phrase?: string; category?: string; intent?: string }> };
      return (x.keywords || []).map((k) => ({
        Phrase: String(k.phrase || ""),
        Category: String(k.category || ""),
        Intent: String(k.intent || ""),
      }));
    },
    listColumns: ["Phrase", "Category", "Intent"],
    csvName: "keywords.csv",
    fields: [{ name: "content", label: "Văn bản", rows: 14 }],
  },
  "keyword-topic-classifier": {
    systemPrompt:
      "Bạn phân loại từ khoá vào topic ngắn (1-3 từ). Trả về JSON {items: [{keyword, topic, sub_topic}]}. Giữ nguyên thứ tự đầu vào.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { items?: Array<{ keyword?: string; topic?: string; sub_topic?: string }> };
      return (x.items || []).map((i) => ({
        Keyword: String(i.keyword || ""),
        Topic: String(i.topic || ""),
        Subtopic: String(i.sub_topic || ""),
      }));
    },
    listColumns: ["Keyword", "Topic", "Subtopic"],
    csvName: "topic-classification.csv",
    fields: [{ name: "keywords", label: "Keyword (mỗi dòng 1)", rows: 14 }],
  },
  "link-bait-suggester": {
    systemPrompt: "Bạn là digital PR strategist. Trả JSON {ideas: [{angle, title, link_potential_1to10, why}]}.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { ideas?: Array<{ angle?: string; title?: string; link_potential_1to10?: number; why?: string }> };
      return (x.ideas || []).map((i) => ({
        Angle: String(i.angle || ""),
        Title: String(i.title || ""),
        Score: String(i.link_potential_1to10 ?? ""),
        Why: String(i.why || ""),
      }));
    },
    listColumns: ["Angle", "Title", "Score", "Why"],
    csvName: "link-bait.csv",
    fields: [{ name: "topic", label: "Chủ đề / ngành", rows: 2, placeholder: "SaaS chăm sóc khách hàng" }],
  },
  "llm-sitemap-creator": {
    systemPrompt:
      "Bạn là information architect. Trả JSON {pages: [{url_slug, title, parent_slug, intent}]}. parent_slug rỗng = trang gốc.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { pages?: Array<{ url_slug?: string; title?: string; parent_slug?: string; intent?: string }> };
      return (x.pages || []).map((pg) => ({
        URL: String(pg.url_slug || ""),
        Title: String(pg.title || ""),
        Parent: String(pg.parent_slug || ""),
        Intent: String(pg.intent || ""),
      }));
    },
    listColumns: ["URL", "Title", "Parent", "Intent"],
    csvName: "llm-sitemap.csv",
    fields: [
      { name: "seed", label: "Seed keyword / chủ đề", rows: 1 },
      { name: "scope", label: "Mô tả phạm vi & target audience", rows: 4 },
    ],
  },
  "meta-rewriter": {
    systemPrompt:
      "Bạn là chuyên gia SEO copywriter người Việt. Mỗi lần được yêu cầu, bạn viết lại meta description tối ưu CTR: dài 130–155 ký tự, có keyword chính, kết thúc bằng CTA tự nhiên, không dùng từ tuyệt đối nếu không có dữ liệu chứng minh. Trả về dạng JSON {variants: [{text, length, score}]} với 5 biến thể, score 1-10.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { variants?: Array<{ text?: string; length?: number; score?: number }> };
      return (x.variants || []).map((v) => ({
        Variant: String(v.text || ""),
        Length: String(v.length ?? (v.text || "").length),
        Score: String(v.score ?? "—"),
      }));
    },
    listColumns: ["Variant", "Length", "Score"],
    csvName: "meta-variants.csv",
    fields: [
      { name: "current", label: "Meta hiện tại (nếu có)", rows: 3, required: false },
      { name: "page_title", label: "Tiêu đề trang", rows: 1 },
      { name: "primary_keyword", label: "Keyword chính" },
      { name: "summary", label: "Tóm tắt nội dung trang (1–2 câu)", rows: 4 },
    ],
  },
  "micro-moments-classifier": {
    systemPrompt:
      "Bạn là planner SEO. Phân loại mỗi keyword vào 1 trong 4 micro-moments của Google: know, go, do, buy. Trả JSON {items: [{keyword, moment, why}]}.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { items?: Array<{ keyword?: string; moment?: string; why?: string }> };
      return (x.items || []).map((i) => ({
        Keyword: String(i.keyword || ""),
        Moment: String(i.moment || ""),
        Why: String(i.why || ""),
      }));
    },
    listColumns: ["Keyword", "Moment", "Why"],
    csvName: "micro-moments.csv",
    fields: [{ name: "keywords", label: "Keyword (mỗi dòng 1)", rows: 14 }],
  },
  "openai-entity-visualizer": {
    systemPrompt: "Bạn là NER expert. Trả JSON {entities: [{text, type, salience, context}]} salience 0-1.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { entities?: Array<{ text?: string; type?: string; salience?: number; context?: string }> };
      return (x.entities || []).map((e) => ({
        Entity: String(e.text || ""),
        Type: String(e.type || ""),
        Salience: String(e.salience ?? ""),
        Context: String(e.context || ""),
      }));
    },
    listColumns: ["Entity", "Type", "Salience", "Context"],
    csvName: "entities.csv",
    fields: [{ name: "content", label: "Văn bản", rows: 14 }],
  },
  "ppc-ad-copy-generator": {
    systemPrompt:
      "Bạn là PPC copywriter. Trả JSON {headlines: [string], descriptions: [string]} — đúng giới hạn ký tự. Headlines tối đa 30, descriptions tối đa 90.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { headlines?: string[]; descriptions?: string[] };
      const rows: Array<Record<string, string>> = [];
      (x.headlines || []).forEach((h, i) =>
        rows.push({ Type: "Headline", Index: String(i + 1), Text: String(h), Length: String((h || "").length) }),
      );
      (x.descriptions || []).forEach((d, i) =>
        rows.push({ Type: "Description", Index: String(i + 1), Text: String(d), Length: String((d || "").length) }),
      );
      return rows;
    },
    listColumns: ["Type", "Index", "Text", "Length"],
    csvName: "ppc-copy.csv",
    fields: [
      { name: "product", label: "Sản phẩm/dịch vụ", rows: 1 },
      { name: "usp", label: "USP / khuyến mãi nổi bật", rows: 4 },
      { name: "keywords", label: "Keyword chủ đề (mỗi dòng 1)", rows: 4, required: false },
    ],
  },
  "regex-generator-2": {
    systemPrompt:
      "Bạn là chuyên gia regex (PCRE2). Trả JSON {regex, flags, explanation, examples_match: [string], examples_nomatch: [string]}.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as {
        regex?: string;
        flags?: string;
        explanation?: string;
        examples_match?: string[];
        examples_nomatch?: string[];
      };
      return [
        { Field: "Regex", Value: String(x.regex || "") },
        { Field: "Flags", Value: String(x.flags || "") },
        { Field: "Explanation", Value: String(x.explanation || "") },
        { Field: "✅ Match", Value: (x.examples_match || []).join(" | ") },
        { Field: "❌ No match", Value: (x.examples_nomatch || []).join(" | ") },
      ];
    },
    listColumns: ["Field", "Value"],
    csvName: "regex.csv",
    fields: [
      {
        name: "request",
        label: "Mô tả",
        rows: 5,
        placeholder: "Bắt mọi URL có /product/[id] với id là số ≥ 4 chữ số",
      },
    ],
  },
  "sentiment-analyzer": {
    systemPrompt:
      "Bạn là phân tích sentiment. Trả JSON {items: [{text, sentiment, score, reason}]}, sentiment ∈ {positive, neutral, negative}, score -1..1.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { items?: Array<{ text?: string; sentiment?: string; score?: number; reason?: string }> };
      return (x.items || []).map((i) => ({
        Text: String(i.text || ""),
        Sentiment: String(i.sentiment || ""),
        Score: String(i.score ?? ""),
        Reason: String(i.reason || ""),
      }));
    },
    listColumns: ["Text", "Sentiment", "Score", "Reason"],
    csvName: "sentiment.csv",
    fields: [{ name: "items", label: "Văn bản (mỗi dòng 1)", rows: 14 }],
  },
  "serp-title-generator": {
    systemPrompt:
      "Bạn là chuyên gia SERP. Trả JSON {best, alternatives: [string], reasoning} — best là title tối ưu nhất, alternatives là 5 biến thể khác.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { best?: string; alternatives?: string[] };
      const rows: Array<Record<string, string>> = [{ Title: String(x.best || ""), Type: "Best" }];
      (x.alternatives || []).forEach((a) => rows.push({ Title: String(a), Type: "Alternative" }));
      return rows;
    },
    listColumns: ["Type", "Title"],
    csvName: "serp-titles.csv",
    fields: [
      { name: "keyword", label: "Keyword", rows: 1 },
      { name: "competitors", label: "Title của top SERP (paste, mỗi dòng 1)", rows: 8, required: false },
    ],
  },
  "title-suggester": {
    systemPrompt:
      "Bạn là copywriter SEO. Sinh 10 biến thể title trong 60 ký tự, có keyword chính, mỗi biến thể có angle khác nhau (How-to, List, Question, Provoke, Benefit-driven). Trả JSON {variants: [{title, length, angle}]}.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { variants?: Array<{ title?: string; length?: number; angle?: string }> };
      return (x.variants || []).map((v) => ({
        Title: String(v.title || ""),
        Length: String(v.length ?? (v.title || "").length),
        Angle: String(v.angle || ""),
      }));
    },
    listColumns: ["Title", "Length", "Angle"],
    csvName: "title-variants.csv",
    fields: [
      { name: "primary_keyword", label: "Keyword chính", rows: 1 },
      { name: "summary", label: "Tóm tắt nội dung", rows: 5 },
    ],
  },
  "topical-map-generator": {
    systemPrompt:
      "Bạn là SEO topical authority architect. Trả JSON {pillars: [{name, clusters: [{name, articles: [string]}]}]}.",
    jsonMode: true,
    jsonExtractList: (p) => {
      const x = p as { pillars?: Array<{ name?: string; clusters?: Array<{ name?: string; articles?: string[] }> }> };
      const rows: Array<Record<string, string>> = [];
      (x.pillars || []).forEach((pi) => {
        (pi.clusters || []).forEach((c) => {
          (c.articles || []).forEach((a) =>
            rows.push({ Pillar: String(pi.name || ""), Cluster: String(c.name || ""), Article: String(a) }),
          );
        });
      });
      return rows;
    },
    listColumns: ["Pillar", "Cluster", "Article"],
    csvName: "topical-map.csv",
    fields: [{ name: "seed", label: "Chủ đề trụ", rows: 2, placeholder: "Marketing nội dung B2B" }],
  },
};

export function getLlmToolPreset(slug: string): LlmToolPreset | undefined {
  return LLM_TOOL_PRESETS[slug];
}
