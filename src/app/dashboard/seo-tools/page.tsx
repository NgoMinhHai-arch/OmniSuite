"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Search,
  Link2,
  BarChart3,
  Globe,
  Zap,
  ExternalLink,
  ArrowRight,
  Database,
  Settings,
  Clock,
  Target,
  Compass,
  BookOpen,
  Link,
  KeyRound,
  Filter,
  Stethoscope,
} from "lucide-react";
import { findTool, REQUIREMENTS, RequirementKey } from "@/lib/seo/tool-registry";
import { useSystemKeys } from "@/lib/seo/use-system-keys";

interface ToolCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  tools: Tool[];
}

interface Tool {
  id: string;
  name: string;
  description: string;
  href: string;
  isNew?: boolean;
}

const categories: ToolCategory[] = [
  {
    id: "content-analysis",
    name: "Phân tích Nội dung",
    description: "Trích xuất, đánh giá, tối ưu nội dung",
    icon: FileText,
    color: "from-blue-500 to-cyan-500",
    tools: [
      { id: "content-extractor", name: "Content Extractor", description: "Trích xuất H1, content từ URLs", href: "/dashboard/seo-tools/content-extractor" },
      { id: "meta-grader", name: "Meta Description Grader", description: "Chấm điểm meta theo heuristic", href: "/dashboard/seo-tools/meta-grader" },
      { id: "meta-rewriter", name: "Meta Rewriter", description: "Viết lại meta description bằng AI", href: "/dashboard/seo-tools/meta-rewriter" },
      { id: "content-duplication", name: "Content Duplication Finder", description: "Tìm nội dung trùng lặp", href: "/dashboard/seo-tools/content-duplication" },
      { id: "reading-score", name: "Reading Score", description: "Tính điểm Flesch", href: "/dashboard/seo-tools/reading-score" },
      { id: "intent-classifier", name: "Intent Classifier", description: "Phân loại intent bằng AI", href: "/dashboard/seo-tools/intent-classifier" },
      { id: "entity-extractor", name: "Entity Extractor", description: "Trích xuất thực thể", href: "/dashboard/seo-tools/entity-extractor" },
      { id: "sentiment-analyzer", name: "Sentiment Analyzer", description: "Phân tích cảm xúc", href: "/dashboard/seo-tools/sentiment-analyzer" },
      { id: "title-suggester", name: "Title Suggester", description: "Gợi ý tiêu đề bằng AI", href: "/dashboard/seo-tools/title-suggester" },
      { id: "category-title-suggester", name: "Category Title Suggester", description: "Tiêu đề danh mục e-commerce", href: "/dashboard/seo-tools/category-title-suggester" },
      { id: "content-hub-classification", name: "Content Hub Classifier", description: "Phân loại content hub", href: "/dashboard/seo-tools/content-hub-classification" },
      { id: "content-repurposer", name: "Content Repurposer", description: "Tái sử dụng nội dung", href: "/dashboard/seo-tools/content-repurposer" },
      { id: "content-reviewer-llm", name: "Content Reviewer LLM", description: "Review nội dung bằng AI", href: "/dashboard/seo-tools/content-reviewer-llm" },
      { id: "gist-summary-generator", name: "Gist Summary Generator", description: "Tóm tắt 'at a glance'", href: "/dashboard/seo-tools/gist-summary-generator" },
      { id: "keyword-extractor-llm", name: "Keyword Extractor LLM", description: "AI bóc cụm từ khóa", href: "/dashboard/seo-tools/keyword-extractor-llm" },
      { id: "ngram-serp-extractor", name: "N-Gram SERP Extractor", description: "Đếm tần suất n-gram", href: "/dashboard/seo-tools/ngram-serp-extractor" },
      { id: "openai-entity-visualizer", name: "Entity Visualizer", description: "Trực quan hóa entity", href: "/dashboard/seo-tools/openai-entity-visualizer" },
      { id: "content-merge-planner", name: "Content Merge Planner", description: "Lập kế hoạch gộp bài", href: "/dashboard/seo-tools/content-merge-planner" },
    ],
  },
  {
    id: "keyword-research",
    name: "Nghiên cứu Từ khóa",
    description: "Phân tích, clustering, trending",
    icon: Search,
    color: "from-emerald-500 to-teal-500",
    tools: [
      { id: "bulk-keyword-tagger", name: "Bulk Keyword Tagger", description: "Tag keyword theo bộ luật", href: "/dashboard/seo-tools/bulk-keyword-tagger" },
      { id: "category-keyword-finder", name: "Category Keyword Finder", description: "AI sinh keyword cho category", href: "/dashboard/seo-tools/category-keyword-finder" },
      { id: "dataforseo-suggestions", name: "DataForSEO Suggestions", description: "Suggestions + volume", href: "/dashboard/seo-tools/dataforseo-suggestions" },
      { id: "ebay-related-searches", name: "eBay Related Searches", description: "Cào related search eBay", href: "/dashboard/seo-tools/ebay-related-searches" },
      { id: "keyword-deduplication", name: "Keyword Deduplication", description: "Loại bỏ trùng lặp", href: "/dashboard/seo-tools/keyword-deduplication" },
      { id: "keyword-difficulty-checker", name: "Keyword Difficulty (offline)", description: "Heuristic độ khó", href: "/dashboard/seo-tools/keyword-difficulty-checker" },
      { id: "keyword-grouper", name: "Keyword Grouper", description: "TF-IDF clustering", href: "/dashboard/seo-tools/keyword-grouper" },
      { id: "keyword-to-questions", name: "Keyword → Questions", description: "Sinh câu hỏi outline", href: "/dashboard/seo-tools/keyword-to-questions" },
      { id: "keyword-to-page", name: "Keyword → Page Mapper", description: "Map keyword → URL", href: "/dashboard/seo-tools/keyword-to-page" },
      { id: "keyword-topic-classifier", name: "Topic Classifier", description: "AI phân loại topic", href: "/dashboard/seo-tools/keyword-topic-classifier" },
      { id: "keyword-trends-analyzer", name: "Trends Analyzer", description: "DataForSEO trends", href: "/dashboard/seo-tools/keyword-trends-analyzer" },
      { id: "keywords-everywhere", name: "Keywords Everywhere", description: "Volume/CPC/Competition", href: "/dashboard/seo-tools/keywords-everywhere" },
      { id: "micro-moments-classifier", name: "Micro-Moments", description: "Phân loại micro-moments", href: "/dashboard/seo-tools/micro-moments-classifier" },
      { id: "paa-scraper", name: "PAA Scraper", description: "People Also Ask qua SerpApi", href: "/dashboard/seo-tools/paa-scraper" },
      { id: "related-searches-tree", name: "Related Searches Tree", description: "Cây related search", href: "/dashboard/seo-tools/related-searches-tree" },
      { id: "serp-keyword-extractor", name: "SERP Keyword Extractor", description: "N-gram trong SERP", href: "/dashboard/seo-tools/serp-keyword-extractor" },
      { id: "topical-map-generator", name: "Topical Map Generator", description: "AI bản đồ chủ đề", href: "/dashboard/seo-tools/topical-map-generator" },
      { id: "keyword-consolidation-suggester", name: "Keyword Consolidation", description: "Gộp keyword trùng intent", href: "/dashboard/seo-tools/keyword-consolidation-suggester" },
    ],
  },
  {
    id: "ecommerce",
    name: "Thương mại Điện tử",
    description: "Tối ưu sản phẩm, category",
    icon: Database,
    color: "from-purple-500 to-pink-500",
    tools: [
      { id: "automatic-category-suggester", name: "Auto Category Suggester", description: "Đề xuất cây danh mục", href: "/dashboard/seo-tools/automatic-category-suggester" },
      { id: "best-selling-products-sitemap", name: "Best Sellers Sitemap", description: "Sitemap sản phẩm bán chạy", href: "/dashboard/seo-tools/best-selling-products-sitemap" },
      { id: "breadcrumb-relevancy-checker", name: "Breadcrumb Checker", description: "Chấm độ liên quan breadcrumb", href: "/dashboard/seo-tools/breadcrumb-relevancy-checker" },
      { id: "ecommerce-image-centering", name: "Image Centering", description: "Căn giữa ảnh sản phẩm", href: "/dashboard/seo-tools/ecommerce-image-centering" },
      { id: "ecom-page-title-optimizer", name: "Page Title Optimizer", description: "Tối ưu title từ GSC + AI", href: "/dashboard/seo-tools/ecom-page-title-optimizer" },
      { id: "google-vision-higher-res", name: "Google Vision High Res", description: "Tìm ảnh cao độ phân giải", href: "/dashboard/seo-tools/google-vision-higher-res" },
      { id: "inject-branding-pdfs", name: "Inject Branding PDFs", description: "Stamp brand vào PDF", href: "/dashboard/seo-tools/inject-branding-pdfs" },
      { id: "internal-search-mapper", name: "Internal Search Mapper", description: "Map search → URL", href: "/dashboard/seo-tools/internal-search-mapper" },
      { id: "low-links-high-transactions", name: "Low Links High Sales", description: "Trang bán chạy ít link", href: "/dashboard/seo-tools/low-links-high-transactions" },
      { id: "non-white-background-detector", name: "Background Detector", description: "Ảnh không nền trắng", href: "/dashboard/seo-tools/non-white-background-detector" },
      { id: "product-qa-extractor", name: "Product Q&A Extractor", description: "Bóc Q&A sản phẩm", href: "/dashboard/seo-tools/product-qa-extractor" },
      { id: "product-spec-extractor", name: "Product Spec Extractor", description: "Bóc spec theo CSS", href: "/dashboard/seo-tools/product-spec-extractor" },
      { id: "product-title-gap", name: "Product Title Gap", description: "So sánh title vs đối thủ", href: "/dashboard/seo-tools/product-title-gap" },
      { id: "serp-title-generator", name: "SERP Title Generator", description: "AI sinh title chuẩn SERP", href: "/dashboard/seo-tools/serp-title-generator" },
      { id: "woocommerce-relevancy", name: "Woo Relevancy", description: "Sắp sản phẩm Woo theo độ liên quan", href: "/dashboard/seo-tools/woocommerce-relevancy" },
    ],
  },
  {
    id: "technical-seo",
    name: "SEO Kỹ thuật",
    description: "Audit, sitemap, schema, redirects",
    icon: Settings,
    color: "from-orange-500 to-amber-500",
    tools: [
      { id: "firecrawl-markdown-scraper", name: "Firecrawl Scraper", description: "Cào URL → markdown", href: "/dashboard/seo-tools/firecrawl-markdown-scraper" },
      { id: "hreflang-checker", name: "Hreflang Checker", description: "Validate hreflang", href: "/dashboard/seo-tools/hreflang-checker" },
      { id: "hreflang-generator", name: "Hreflang Generator", description: "Sinh markup hreflang", href: "/dashboard/seo-tools/hreflang-generator" },
      { id: "llm-sitemap-creator", name: "LLM Sitemap Creator", description: "AI dựng sitemap", href: "/dashboard/seo-tools/llm-sitemap-creator" },
      { id: "oncrawl-extractor", name: "Oncrawl Extractor", description: "Lấy crawl OnCrawl", href: "/dashboard/seo-tools/oncrawl-extractor" },
      { id: "qa-schema", name: "Q&A Schema Builder", description: "Sinh JSON-LD FAQPage", href: "/dashboard/seo-tools/qa-schema" },
      { id: "qa-schema-extractor-2", name: "Q&A Schema Extractor", description: "Bóc FAQ JSON-LD", href: "/dashboard/seo-tools/qa-schema-extractor-2" },
      { id: "redirect-validator", name: "Redirect Validator", description: "Kiểm tra chain", href: "/dashboard/seo-tools/redirect-validator" },
      { id: "regex-generator", name: "Regex Generator (offline)", description: "Sinh regex từ ví dụ", href: "/dashboard/seo-tools/regex-generator" },
      { id: "regex-generator-2", name: "Regex Generator (AI)", description: "AI dịch yêu cầu → regex", href: "/dashboard/seo-tools/regex-generator-2" },
      { id: "schema-generator", name: "Schema Generator", description: "Sinh JSON-LD chung", href: "/dashboard/seo-tools/schema-generator" },
      { id: "sitemap-extractor", name: "Sitemap Extractor", description: "Trích URL từ sitemap", href: "/dashboard/seo-tools/sitemap-extractor" },
      { id: "template-fingerprint", name: "Template Fingerprint", description: "Cluster URL theo template", href: "/dashboard/seo-tools/template-fingerprint" },
      { id: "website-checkup", name: "Kiểm tra website", description: "Nội soi SEO on-page + link + heading tree", href: "/dashboard/seo-tools/scraper" },
    ],
  },
  {
    id: "link-building",
    name: "Xây dựng Liên kết",
    description: "Internal, external, citations",
    icon: Link2,
    color: "from-indigo-500 to-violet-500",
    tools: [
      { id: "citation-link-finder", name: "Citation Link Finder", description: "Tìm citation chất lượng", href: "/dashboard/seo-tools/citation-link-finder" },
      { id: "competitor-backlink-gap", name: "Backlink Gap", description: "Khe hở backlink", href: "/dashboard/seo-tools/competitor-backlink-gap" },
      { id: "dead-link-reclaimer", name: "Dead Link Reclaimer", description: "Tìm 404 reclaim", href: "/dashboard/seo-tools/dead-link-reclaimer" },
      { id: "internal-linker", name: "Internal Linker", description: "Cơ hội internal link", href: "/dashboard/seo-tools/internal-linker" },
      { id: "link-bait-suggester", name: "Link Bait Suggester", description: "Ý tưởng nội dung kéo link", href: "/dashboard/seo-tools/link-bait-suggester" },
      { id: "link-intersect-tool", name: "Link Intersect", description: "Domain link tới đối thủ", href: "/dashboard/seo-tools/link-intersect-tool" },
      { id: "wikipedia-citation", name: "Wikipedia Citation", description: "Tìm bài Wikipedia liên quan", href: "/dashboard/seo-tools/wikipedia-citation" },
    ],
  },
  {
    id: "reporting",
    name: "Báo cáo & Phân tích",
    description: "GSC, traffic, competitors",
    icon: BarChart3,
    color: "from-rose-500 to-red-500",
    tools: [
      { id: "advanced", name: "SEO Nâng cao", description: "Domain insights tổng hợp", href: "/dashboard/seo-tools/advanced" },
      { id: "bcg-matrix-ga", name: "BCG Matrix GA", description: "Ma trận BCG từ GA", href: "/dashboard/seo-tools/bcg-matrix-ga" },
      { id: "content-decay-analyzer", name: "Content Decay", description: "Trang sụt traffic", href: "/dashboard/seo-tools/content-decay-analyzer" },
      { id: "forecast-inventory-trends", name: "Inventory Trends", description: "Dự báo time-series", href: "/dashboard/seo-tools/forecast-inventory-trends" },
      { id: "gsc-cannibalization-checker", name: "Cannibalization", description: "1 query, nhiều URL", href: "/dashboard/seo-tools/gsc-cannibalization-checker" },
      { id: "gsc-ctr-trends", name: "GSC CTR Trends", description: "CTR theo ngày", href: "/dashboard/seo-tools/gsc-ctr-trends" },
      { id: "gsc-data-studio-connector", name: "GSC → Looker", description: "Hướng dẫn Looker", href: "/dashboard/seo-tools/gsc-data-studio-connector" },
      { id: "gsc-keyword-level", name: "Keyword Level", description: "Top keyword GSC", href: "/dashboard/seo-tools/gsc-keyword-level" },
      { id: "impressions-analyzer", name: "Impressions", description: "Impressions cao, CTR thấp", href: "/dashboard/seo-tools/impressions-analyzer" },
      { id: "position-improvement", name: "Position Improvement", description: "So sánh 2 khoảng thời gian", href: "/dashboard/seo-tools/position-improvement" },
      { id: "search-console", name: "GSC Downloader", description: "Tải dữ liệu GSC", href: "/dashboard/seo-tools/search-console" },
      { id: "striking-distance-identifier", name: "Striking Distance", description: "Query 4-20", href: "/dashboard/seo-tools/striking-distance-identifier" },
      { id: "traffic-dashboard", name: "Traffic Dashboard", description: "Dashboard traffic", href: "/dashboard/seo-tools/traffic-dashboard" },
      { id: "top-traffic", name: "Top Traffic", description: "Trang top click", href: "/dashboard/seo-tools/top-traffic" },
    ],
  },
  {
    id: "ppc",
    name: "PPC & Paid Search",
    description: "Google Ads, ad copy, keywords",
    icon: Target,
    color: "from-cyan-500 to-blue-500",
    tools: [
      { id: "google-ads-keyword-categorizer", name: "Ads Keyword Categorizer", description: "AI phân nhóm Ads", href: "/dashboard/seo-tools/google-ads-keyword-categorizer" },
      { id: "ppc-ad-copy-generator", name: "Ad Copy Generator", description: "AI sinh ad copy", href: "/dashboard/seo-tools/ppc-ad-copy-generator" },
      { id: "ppc-keyword-gap", name: "PPC Keyword Gap", description: "So sánh keyword PPC", href: "/dashboard/seo-tools/ppc-keyword-gap" },
      { id: "search-term-analyzer", name: "Search Term Analyzer", description: "Phân tích search term Ads", href: "/dashboard/seo-tools/search-term-analyzer" },
    ],
  },
  {
    id: "migration",
    name: "Di chuyển & Consolidation",
    description: "Migration, URL mapping, redirects",
    icon: Compass,
    color: "from-gray-500 to-gray-700",
    tools: [
      { id: "domain-migration-planner", name: "Migration Planner", description: "Checklist migration", href: "/dashboard/seo-tools/domain-migration-planner" },
      { id: "duplicate-content-finder", name: "Duplicate Finder", description: "Nội dung trùng", href: "/dashboard/seo-tools/duplicate-content-finder" },
      { id: "htaccess-redirect-generator", name: "HTAccess Generator", description: "Sinh quy tắc 301", href: "/dashboard/seo-tools/htaccess-redirect-generator" },
      { id: "page-retirement-planner", name: "Page Retirement", description: "Quyết định giữ/xóa/redirect", href: "/dashboard/seo-tools/page-retirement-planner" },
      { id: "site-search", name: "Site Search Analyzer", description: "Phân tích log search nội bộ", href: "/dashboard/seo-tools/site-search" },
      { id: "migration-mapper", name: "URL Migration Mapper", description: "Map URL cũ → mới", href: "/dashboard/seo-tools/migration-mapper" },
      { id: "woocommerce-category-migration", name: "Woo Migration", description: "Migration WooCommerce", href: "/dashboard/seo-tools/woocommerce-category-migration" },
      { id: "competitor-gap", name: "Competitor Gap", description: "So sánh keyword đối thủ", href: "/dashboard/seo-tools/competitor-gap" },
    ],
  },
];

const ALL_REQS: RequirementKey[] = [
  "llm",
  "serpapi",
  "dataforseo",
  "gsc",
  "firecrawl",
  "googlevision",
  "oncrawl",
  "ga",
  "woocommerce",
  "keywordseverywhere",
];

function ReqBadge({ req, ok }: { req: RequirementKey; ok: boolean }) {
  const meta = REQUIREMENTS[req];
  return (
    <span
      title={meta?.label}
      className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${
        ok ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-300"
      }`}
    >
      <KeyRound size={9} />
      {req}
    </span>
  );
}

function ToolRow({
  tool,
  hidden,
  hasRequirement,
}: {
  tool: Tool;
  hidden: boolean;
  hasRequirement: (r: RequirementKey) => boolean;
}) {
  const slug = tool.href.split("/").pop() || "";
  const meta = findTool(slug);
  const reqs = meta?.requires || [];
  if (hidden) return null;
  return (
    <a
      key={tool.id}
      href={tool.href}
      className="group flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{tool.name}</span>
          {meta?.worksOffline && reqs.length === 0 && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/10 text-cyan-400">Offline</span>
          )}
          {reqs.map((r) => (
            <ReqBadge key={r} req={r} ok={hasRequirement(r)} />
          ))}
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>{tool.description}</p>
      </div>
      <ArrowRight size={16} className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
    </a>
  );
}

function CategoryCard({
  category,
  filterReq,
  hasRequirement,
}: {
  category: ToolCategory;
  filterReq: RequirementKey | "all" | "ready" | "missing";
  hasRequirement: (r: RequirementKey) => boolean;
}) {
  const Icon = category.icon;
  const visibleTools = useMemo(() => {
    return category.tools.filter((t) => {
      const meta = findTool(t.href.split("/").pop() || "");
      const reqs = meta?.requires || [];
      if (filterReq === "all") return true;
      if (filterReq === "ready") return reqs.every((r) => hasRequirement(r));
      if (filterReq === "missing") return reqs.some((r) => !hasRequirement(r));
      return reqs.includes(filterReq);
    });
  }, [category.tools, filterReq, hasRequirement]);

  if (!visibleTools.length) return null;
  return (
    <div className="rounded-3xl p-6 overflow-hidden transition-all duration-300 hover:scale-[1.01]"
      style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}
    >
      <div className="flex items-center gap-4 mb-4">
        <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${category.color} flex items-center justify-center text-white`}>
          <Icon size={24} />
        </div>
        <div>
          <h3 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>{category.name}</h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{visibleTools.length} công cụ · {category.description}</p>
        </div>
      </div>
      <div className="space-y-2">
        {visibleTools.map((tool) => (
          <ToolRow key={tool.id} tool={tool} hidden={false} hasRequirement={hasRequirement} />
        ))}
      </div>
    </div>
  );
}

function QuickActionCard({ title, description, icon: Icon, href, color }: { title: string; description: string; icon: React.ElementType; href: string; color: string }) {
  return (
    <a
      href={href}
      className="group flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
      style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}
    >
      <div className={`h-10 w-10 rounded-xl ${color} flex items-center justify-center text-white shrink-0`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{title}</h4>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{description}</p>
      </div>
      <ExternalLink size={14} className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto" />
    </a>
  );
}

export default function SeoToolsDashboard() {
  const { hasRequirement, loaded } = useSystemKeys();
  const [filterReq, setFilterReq] = useState<RequirementKey | "all" | "ready" | "missing">("all");

  const totalTools = categories.reduce((acc, c) => acc + c.tools.length, 0);
  const totalReady = useMemo(() => {
    if (!loaded) return 0;
    let n = 0;
    categories.forEach((c) => c.tools.forEach((t) => {
      const meta = findTool(t.href.split("/").pop() || "");
      const reqs = meta?.requires || [];
      if (reqs.every((r) => hasRequirement(r))) n++;
    }));
    return n;
  }, [loaded, hasRequirement]);

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }} suppressHydrationWarning>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white">
                <Zap size={20} />
              </div>
              <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Bộ Công cụ SEO</h1>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {totalTools} công cụ · <span className="text-emerald-400">{totalReady} sẵn sàng chạy</span> dựa trên cấu hình hiện tại.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-cyan-400" />
            <select
              value={filterReq}
              onChange={(e) => setFilterReq(e.target.value as RequirementKey | "all" | "ready" | "missing")}
              className="rounded-xl px-3 py-2 text-sm font-bold"
              style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            >
              <option value="all">Tất cả</option>
              <option value="ready">Sẵn sàng (đủ key)</option>
              <option value="missing">Còn thiếu key</option>
              <option disabled>──────</option>
              {ALL_REQS.map((r) => (
                <option key={r} value={r}>Yêu cầu: {REQUIREMENTS[r]?.label || r}</option>
              ))}
            </select>
            <a
              href="/dashboard/settings"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold"
            >
              <KeyRound size={14} /> Cấu hình
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionCard title="SEO Nâng cao" description="Phân tích domain với DataForSEO" icon={Target} href="/dashboard/seo-tools/advanced" color="bg-gradient-to-br from-indigo-500 to-purple-500" />
          <QuickActionCard title="Trích xuất Nội dung" description="Cào metadata + content" icon={Database} href="/dashboard/seo-tools/content-extractor" color="bg-gradient-to-br from-blue-500 to-cyan-500" />
          <QuickActionCard title="Wayback Extractor" description="Trích URL lịch sử" icon={Clock} href="/dashboard/seo-tools/wayback-extractor" color="bg-gradient-to-br from-amber-500 to-orange-500" />
          <QuickActionCard title="Sitemap Extractor" description="URL từ sitemap.xml" icon={Globe} href="/dashboard/seo-tools/sitemap-extractor" color="bg-gradient-to-br from-emerald-500 to-teal-500" />
          <QuickActionCard title="Redirect Validator" description="Kiểm tra redirect chain" icon={Settings} href="/dashboard/seo-tools/redirect-validator" color="bg-gradient-to-br from-orange-500 to-red-500" />
          <QuickActionCard title="Schema Generator" description="JSON-LD nhanh" icon={FileText} href="/dashboard/seo-tools/schema-generator" color="bg-gradient-to-br from-cyan-500 to-blue-500" />
          <QuickActionCard title="Internal Linker" description="Cơ hội internal link" icon={Link} href="/dashboard/seo-tools/internal-linker" color="bg-gradient-to-br from-purple-500 to-pink-500" />
          <QuickActionCard title="Kiểm tra website" description="Audit nhanh bài đối thủ" icon={Stethoscope} href="/dashboard/seo-tools/scraper" color="bg-gradient-to-br from-emerald-500 to-cyan-500" />
          <QuickActionCard title="Wikipedia Citation" description="Cơ hội citation" icon={BookOpen} href="/dashboard/seo-tools/wikipedia-citation" color="bg-gradient-to-br from-gray-600 to-gray-800" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} filterReq={filterReq} hasRequirement={hasRequirement} />
          ))}
        </div>
      </div>
    </div>
  );
}
