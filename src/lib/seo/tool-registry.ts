/* Single source of truth for SEO toolkit pages.
 * Hub + ToolShell read from here so every tool can show:
 *  - human title / description
 *  - which API keys are required
 *  - which category it belongs to */

export type RequirementKey =
  | "llm"
  | "serpapi"
  | "dataforseo"
  | "gsc"
  | "firecrawl"
  | "valueserp"
  | "keywordseverywhere"
  | "oncrawl"
  | "pexels"
  | "outscraper"
  | "scraperapi"
  | "tavily"
  | "ga"
  | "googlevision"
  | "googleads"
  | "wp"
  | "woocommerce";

export interface RequirementMeta {
  id: RequirementKey;
  label: string;
  /** Field id in `omnisuite_settings` localStorage (or any of these). */
  settingsKeys: string[];
  helpUrl?: string;
}

export const REQUIREMENTS: Record<RequirementKey, RequirementMeta> = {
  llm: {
    id: "llm",
    label: "LLM (OpenAI/Gemini/Claude/Groq/DeepSeek/OpenRouter/Ollama)",
    settingsKeys: [
      "openai_api_key",
      "gemini_api_key",
      "claude_api_key",
      "groq_api_key",
      "deepseek_api_key",
      "openrouter_api_key",
      "ollama_base_url",
      "ollama_api_key",
    ],
  },
  serpapi: { id: "serpapi", label: "SerpApi", settingsKeys: ["serpapi_key"], helpUrl: "https://serpapi.com" },
  dataforseo: {
    id: "dataforseo",
    label: "DataForSEO",
    settingsKeys: ["dataforseo_user", "dataforseo_pass"],
    helpUrl: "https://dataforseo.com",
  },
  gsc: {
    id: "gsc",
    label: "Google Search Console",
    settingsKeys: ["gsc_service_account_key", "gsc_use_oauth"],
    helpUrl: "https://search.google.com/search-console",
  },
  firecrawl: {
    id: "firecrawl",
    label: "Firecrawl",
    settingsKeys: ["firecrawl_api_key"],
    helpUrl: "https://firecrawl.dev",
  },
  valueserp: {
    id: "valueserp",
    label: "ValueSERP",
    settingsKeys: ["valueserp_api_key"],
    helpUrl: "https://valueserp.com",
  },
  keywordseverywhere: {
    id: "keywordseverywhere",
    label: "Keywords Everywhere",
    settingsKeys: ["keywords_everywhere_api_key"],
    helpUrl: "https://keywordseverywhere.com",
  },
  oncrawl: {
    id: "oncrawl",
    label: "OnCrawl",
    settingsKeys: ["oncrawl_api_key", "oncrawl_project_id"],
    helpUrl: "https://www.oncrawl.com",
  },
  pexels: { id: "pexels", label: "Pexels", settingsKeys: ["pexels_api_key"] },
  outscraper: { id: "outscraper", label: "Outscraper", settingsKeys: ["outscraper_key"] },
  scraperapi: { id: "scraperapi", label: "ScraperAPI", settingsKeys: ["scraperapi_key"] },
  tavily: { id: "tavily", label: "Tavily", settingsKeys: ["tavily_api_key"] },
  ga: {
    id: "ga",
    label: "Google Analytics 4",
    settingsKeys: ["ga4_property_id"],
    helpUrl: "https://analytics.google.com",
  },
  googlevision: {
    id: "googlevision",
    label: "Google Vision API",
    settingsKeys: ["google_vision_api_key"],
  },
  googleads: {
    id: "googleads",
    label: "Google Ads (Developer Token)",
    settingsKeys: ["google_ads_dev_token"],
  },
  wp: { id: "wp", label: "WordPress App Pass", settingsKeys: ["wp_app_pass"] },
  woocommerce: {
    id: "woocommerce",
    label: "WooCommerce REST",
    settingsKeys: ["woo_consumer_key", "woo_consumer_secret", "woo_store_url"],
  },
};

export type ToolCategory =
  | "content"
  | "keywords"
  | "ecommerce"
  | "technical"
  | "links"
  | "reporting"
  | "ppc"
  | "migration";

export interface ToolMeta {
  slug: string;
  title: string;
  description: string;
  category: ToolCategory;
  requires: RequirementKey[];
  /** True if our implementation gives a real result without any external SaaS. */
  worksOffline?: boolean;
  /** When set, this slug is just an alias of another slug's page. */
  aliasOf?: string;
}

export const TOOL_REGISTRY: ToolMeta[] = [
  // ---------- content
  { slug: "content-extractor", title: "Content Extractor", description: "Trích xuất H1/title/meta/nội dung từ danh sách URL.", category: "content", requires: [], worksOffline: true },
  { slug: "content-extractor-2", title: "Content Extractor (v2)", description: "Bản thay thế của Content Extractor.", category: "content", requires: [], aliasOf: "content-extractor" },
  { slug: "meta-grader", title: "Meta Description Grader", description: "Chấm điểm meta theo heuristic chuẩn SERP.", category: "content", requires: [], worksOffline: true },
  { slug: "meta-rewriter", title: "Meta Rewriter", description: "Viết lại meta description bằng AI theo target length.", category: "content", requires: ["llm"] },
  { slug: "content-duplication", title: "Content Duplication Finder", description: "So sánh 2 đoạn văn bản theo Jaccard + containment.", category: "content", requires: [], worksOffline: true },
  { slug: "content-duplication-finder", title: "Content Duplication Finder", description: "Alias của Content Duplication.", category: "content", requires: [], aliasOf: "content-duplication" },
  { slug: "reading-score", title: "Reading Score", description: "Flesch reading ease + thống kê tiếng Việt.", category: "content", requires: [], worksOffline: true },
  { slug: "intent-classifier", title: "Intent Classifier", description: "Phân loại ý định trang/keyword bằng AI.", category: "content", requires: ["llm"] },
  { slug: "entity-extractor", title: "Entity Extractor", description: "Bóc tách thực thể từ văn bản bằng AI.", category: "content", requires: ["llm"] },
  { slug: "entity-extractor-2", title: "Entity Extractor (v2)", description: "Alias.", category: "content", requires: ["llm"], aliasOf: "entity-extractor" },
  { slug: "sentiment-analyzer", title: "Sentiment Analyzer", description: "Phân tích cảm xúc, gắn nhãn theo chủ đề.", category: "content", requires: ["llm"] },
  { slug: "category-title-suggester", title: "Category Title Suggester", description: "Đề xuất tiêu đề danh mục dựa trên dữ liệu nhập.", category: "content", requires: ["llm"] },
  { slug: "title-suggester", title: "Title Suggester", description: "Sinh title biến thể bằng AI.", category: "content", requires: ["llm"] },
  { slug: "content-hub-classification", title: "Content Hub Classifier", description: "Gán bài viết vào hub/cluster.", category: "content", requires: ["llm"] },
  { slug: "content-repurposer", title: "Content Repurposer", description: "Tái sử dụng bài viết thành format khác.", category: "content", requires: ["llm"] },
  { slug: "content-reviewer-llm", title: "Content Reviewer LLM", description: "AI review/đánh giá nội dung.", category: "content", requires: ["llm"] },
  { slug: "gist-summary-generator", title: "Gist Summary Generator", description: "Tóm tắt 'at a glance' bằng AI.", category: "content", requires: ["llm"] },
  { slug: "keyword-extractor-llm", title: "Keyword Extractor LLM", description: "AI bóc cụm từ khóa từ văn bản.", category: "content", requires: ["llm"] },
  { slug: "ngram-serp-extractor", title: "N-Gram SERP Extractor", description: "Tần suất n-gram từ tiêu đề/snippet SERP.", category: "content", requires: [], worksOffline: true },
  { slug: "openai-entity-visualizer", title: "Entity Visualizer", description: "Trực quan thực thể từ văn bản.", category: "content", requires: ["llm"] },
  { slug: "content-merge-planner", title: "Content Merge Planner", description: "Lập kế hoạch gộp bài.", category: "content", requires: ["llm"] },

  // ---------- keywords
  { slug: "bulk-keyword-tagger", title: "Bulk Keyword Tagger", description: "Gắn nhãn từ khóa theo bộ luật bạn nhập.", category: "keywords", requires: [], worksOffline: true },
  { slug: "category-keyword-finder", title: "Category Keyword Finder", description: "Sinh keyword theo cụm danh mục.", category: "keywords", requires: ["llm"] },
  { slug: "dataforseo-suggestions", title: "DataForSEO Suggestions", description: "Gợi ý keyword + volume từ DataForSEO.", category: "keywords", requires: ["dataforseo"] },
  { slug: "ebay-related-searches", title: "eBay Related Searches", description: "Cào related search trên eBay.", category: "keywords", requires: [], worksOffline: true },
  { slug: "keyword-deduplication", title: "Keyword Deduplication", description: "Lọc trùng + sắp xếp keyword list.", category: "keywords", requires: [], worksOffline: true },
  { slug: "keyword-difficulty-checker", title: "Keyword Difficulty (offline)", description: "Ước lượng độ khó qua heuristic SERP.", category: "keywords", requires: [], worksOffline: true },
  { slug: "keyword-grouper", title: "Keyword Grouper", description: "Cluster keyword bằng TF-IDF/cosine.", category: "keywords", requires: [], worksOffline: true },
  { slug: "keyword-to-questions", title: "Keyword → Questions", description: "Sinh câu hỏi outline từ keyword.", category: "keywords", requires: [], worksOffline: true },
  { slug: "keyword-topic-classifier", title: "Topic Classifier", description: "AI gắn topic cho danh sách keyword.", category: "keywords", requires: ["llm"] },
  { slug: "keyword-trends-analyzer", title: "Trends Analyzer", description: "Xu hướng keyword qua DataForSEO Trends.", category: "keywords", requires: ["dataforseo"] },
  { slug: "keywords-everywhere", title: "Keywords Everywhere", description: "Volume/CPC qua KE; fallback DataForSEO.", category: "keywords", requires: ["keywordseverywhere"] },
  { slug: "micro-moments-classifier", title: "Micro-Moments Classifier", description: "Phân loại keyword theo micro-moments.", category: "keywords", requires: ["llm"] },
  { slug: "paa-scraper", title: "PAA Scraper", description: "Cào People Also Ask qua SerpApi.", category: "keywords", requires: ["serpapi"] },
  { slug: "related-searches-tree", title: "Related Searches Tree", description: "Cây related searches qua SerpApi.", category: "keywords", requires: ["serpapi"] },
  { slug: "serp-keyword-extractor", title: "SERP Keyword Extractor", description: "Trích keyword + cụm từ SERP qua SerpApi.", category: "keywords", requires: ["serpapi"] },
  { slug: "topical-map-generator", title: "Topical Map Generator", description: "AI sinh bản đồ chủ đề.", category: "keywords", requires: ["llm"] },
  { slug: "keyword-consolidation-suggester", title: "Keyword Consolidation", description: "Đề xuất gộp keyword trùng intent.", category: "keywords", requires: [], worksOffline: true },
  { slug: "keyword-to-page", title: "Keyword → Page Mapper", description: "Map keyword vào URL theo similarity.", category: "keywords", requires: [], worksOffline: true },

  // ---------- ecommerce
  { slug: "automatic-category-suggester", title: "Auto Category Suggester", description: "Gợi ý danh mục từ feed sản phẩm.", category: "ecommerce", requires: ["llm"] },
  { slug: "best-selling-products-sitemap", title: "Best Sellers Sitemap", description: "Sitemap XML cho sản phẩm bán chạy.", category: "ecommerce", requires: [], worksOffline: true },
  { slug: "breadcrumb-relevancy-checker", title: "Breadcrumb Checker", description: "Chấm điểm độ liên quan breadcrumb.", category: "ecommerce", requires: [], worksOffline: true },
  { slug: "ecommerce-image-centering", title: "Image Centering", description: "Hướng dẫn căn giữa ảnh sản phẩm.", category: "ecommerce", requires: [] },
  { slug: "ecom-page-title-optimizer", title: "Page Title Optimizer", description: "Tối ưu title trang sản phẩm dựa GSC.", category: "ecommerce", requires: ["gsc", "llm"] },
  { slug: "google-vision-higher-res", title: "Google Vision High Res", description: "Tìm ảnh độ phân giải cao hơn.", category: "ecommerce", requires: ["googlevision"] },
  { slug: "inject-branding-pdfs", title: "Inject Branding PDFs", description: "Stamp brand text vào PDF.", category: "ecommerce", requires: [] },
  { slug: "internal-search-mapper", title: "Internal Search Mapper", description: "Map từ khóa search nội bộ → URL.", category: "ecommerce", requires: [], worksOffline: true },
  { slug: "low-links-high-transactions", title: "Low Links High Sales", description: "Tìm trang ít link nhưng bán chạy.", category: "ecommerce", requires: [], worksOffline: true },
  { slug: "non-white-background-detector", title: "Background Detector", description: "Phát hiện ảnh không nền trắng.", category: "ecommerce", requires: ["googlevision"] },
  { slug: "product-qa-extractor", title: "Product Q&A Extractor", description: "Trích Q&A/Reviews trong trang sản phẩm.", category: "ecommerce", requires: [] },
  { slug: "product-spec-extractor", title: "Product Spec Extractor", description: "Trích spec theo CSS selector.", category: "ecommerce", requires: [] },
  { slug: "product-title-gap", title: "Product Title Gap", description: "So sánh title của bạn vs đối thủ.", category: "ecommerce", requires: [], worksOffline: true },
  { slug: "serp-title-generator", title: "SERP Title Generator", description: "AI sinh title chuẩn SERP.", category: "ecommerce", requires: ["llm"] },
  { slug: "woocommerce-relevancy", title: "Woo Relevancy", description: "Sắp xếp sản phẩm Woo theo độ liên quan danh mục.", category: "ecommerce", requires: ["woocommerce"] },

  // ---------- technical
  { slug: "firecrawl-markdown-scraper", title: "Firecrawl Scraper", description: "Cào URL → markdown bằng Firecrawl.", category: "technical", requires: ["firecrawl"] },
  { slug: "hreflang-checker", title: "Hreflang Checker", description: "Trích/validate hreflang từ URL.", category: "technical", requires: [] },
  { slug: "hreflang-checker-2", title: "Hreflang Checker (v2)", description: "Alias.", category: "technical", requires: [], aliasOf: "hreflang-checker" },
  { slug: "hreflang-generator", title: "Hreflang Generator", description: "Sinh markup hreflang.", category: "technical", requires: [], worksOffline: true },
  { slug: "llm-sitemap-creator", title: "LLM Sitemap Creator", description: "AI dựng cấu trúc sitemap từ keyword.", category: "technical", requires: ["llm"] },
  { slug: "oncrawl-extractor", title: "Oncrawl Extractor", description: "Lấy crawl dataset từ OnCrawl.", category: "technical", requires: ["oncrawl"] },
  { slug: "qa-schema", title: "Q&A Schema Builder", description: "Sinh Q&A Schema JSON-LD.", category: "technical", requires: [], worksOffline: true },
  { slug: "qa-schema-extractor-2", title: "Q&A Schema Extractor", description: "Bóc Q&A schema từ URL.", category: "technical", requires: [] },
  { slug: "redirect-validator", title: "Redirect Validator", description: "Kiểm tra chain redirect cho URLs.", category: "technical", requires: [] },
  { slug: "redirect-validator-2", title: "Redirect Validator (v2)", description: "Alias.", category: "technical", requires: [], aliasOf: "redirect-validator" },
  { slug: "regex-generator", title: "Regex Generator (offline)", description: "Sinh regex từ ví dụ + rule.", category: "technical", requires: [], worksOffline: true },
  { slug: "regex-generator-2", title: "Regex Generator AI", description: "AI dịch yêu cầu sang regex.", category: "technical", requires: ["llm"] },
  { slug: "schema-generator", title: "Schema Generator", description: "Sinh JSON-LD theo template.", category: "technical", requires: [], worksOffline: true },
  { slug: "schema-markup-generator-2", title: "Schema Generator (v2)", description: "Alias.", category: "technical", requires: [], aliasOf: "schema-generator" },
  { slug: "sitemap-extractor", title: "Sitemap URL Extractor", description: "Trích toàn bộ URL từ sitemap.", category: "technical", requires: [] },
  { slug: "sitemap-url-extractor-2", title: "Sitemap URL Extractor (v2)", description: "Alias.", category: "technical", requires: [], aliasOf: "sitemap-extractor" },
  { slug: "template-fingerprint", title: "Template Fingerprint", description: "Cluster URL theo signature HTML.", category: "technical", requires: [] },
  { slug: "template-fingerprinting-2", title: "Template Fingerprinting (v2)", description: "Alias.", category: "technical", requires: [], aliasOf: "template-fingerprint" },
  { slug: "scraper", title: "Kiểm tra website", description: "Audit SEO on-page, heading tree, link profile và mật độ từ khóa.", category: "technical", requires: [], worksOffline: true },

  // ---------- links
  { slug: "citation-link-finder", title: "Citation Link Finder", description: "Tìm link citation cho bài viết.", category: "links", requires: ["serpapi"] },
  { slug: "competitor-backlink-gap", title: "Backlink Gap", description: "Khe hở backlink so với đối thủ.", category: "links", requires: ["dataforseo"] },
  { slug: "dead-link-reclaimer", title: "Dead Link Reclaimer", description: "Tìm 404 đang nhận backlink.", category: "links", requires: [] },
  { slug: "internal-linker", title: "Internal Linker", description: "Tìm cơ hội internal link cho money page.", category: "links", requires: [], worksOffline: true },
  { slug: "link-bait-suggester", title: "Link Bait Suggester", description: "AI gợi ý chủ đề thu hút backlink.", category: "links", requires: ["llm"] },
  { slug: "link-intersect-tool", title: "Link Intersect", description: "Domain link tới đối thủ nhưng chưa tới bạn.", category: "links", requires: ["dataforseo"] },
  { slug: "wikipedia-citation", title: "Wikipedia Citation", description: "Tìm cơ hội citation trên Wikipedia.", category: "links", requires: [], worksOffline: true },

  // ---------- reporting
  { slug: "bcg-matrix-ga", title: "BCG Matrix GA", description: "Ma trận BCG từ landing page GA.", category: "reporting", requires: ["ga"] },
  { slug: "content-decay-analyzer", title: "Content Decay", description: "Phát hiện trang sụt giảm traffic.", category: "reporting", requires: ["gsc"] },
  { slug: "forecast-inventory-trends", title: "Inventory Trend Forecast", description: "Dự báo xu hướng đơn giản theo time-series.", category: "reporting", requires: [], worksOffline: true },
  { slug: "gsc-cannibalization-checker", title: "Cannibalization Checker", description: "Phát hiện 2 URL ăn nhau từ GSC.", category: "reporting", requires: ["gsc"] },
  { slug: "gsc-ctr-trends", title: "GSC CTR Trends", description: "Xu hướng CTR theo ngày.", category: "reporting", requires: ["gsc"] },
  { slug: "gsc-data-studio-connector", title: "GSC → Looker", description: "Hướng dẫn nối Looker Studio với GSC.", category: "reporting", requires: ["gsc"] },
  { slug: "gsc-keyword-level", title: "Keyword Level (GSC)", description: "Xếp hạng keyword theo hiệu năng.", category: "reporting", requires: ["gsc"] },
  { slug: "impressions-analyzer", title: "Impressions Analyzer", description: "Phân tích impressions chi tiết.", category: "reporting", requires: ["gsc"] },
  { slug: "position-improvement", title: "Position Improvement", description: "Tăng/giảm vị trí giữa 2 khoảng thời gian.", category: "reporting", requires: ["gsc"] },
  { slug: "search-console", title: "GSC Downloader", description: "Tải dữ liệu GSC theo dimension/khoảng ngày.", category: "reporting", requires: ["gsc"] },
  { slug: "search-console-downloader-2", title: "GSC Downloader (v2)", description: "Alias.", category: "reporting", requires: ["gsc"], aliasOf: "search-console" },
  { slug: "striking-distance-identifier", title: "Striking Distance", description: "Lọc query đang ở vị trí 4–20.", category: "reporting", requires: ["gsc"] },
  { slug: "traffic-dashboard", title: "Traffic Dashboard", description: "Tổng quan traffic GSC.", category: "reporting", requires: ["gsc"] },
  { slug: "top-traffic", title: "Top Traffic Pages", description: "Trang traffic cao nhất theo GSC.", category: "reporting", requires: ["gsc"] },

  // ---------- ppc
  { slug: "google-ads-keyword-categorizer", title: "Ads Keyword Categorizer", description: "Phân nhóm keyword Ads bằng AI.", category: "ppc", requires: ["llm"] },
  { slug: "ppc-ad-copy-generator", title: "Ad Copy Generator", description: "Sinh ad copy bằng AI.", category: "ppc", requires: ["llm"] },
  { slug: "ppc-keyword-gap", title: "PPC Keyword Gap", description: "So sánh keyword Ads bạn vs đối thủ.", category: "ppc", requires: [], worksOffline: true },
  { slug: "search-term-analyzer", title: "Search Term Analyzer", description: "Bóc keyword cần negative từ search-term report.", category: "ppc", requires: [], worksOffline: true },

  // ---------- migration
  { slug: "domain-migration-planner", title: "Domain Migration Planner", description: "Lên kế hoạch migration tổng thể.", category: "migration", requires: [], worksOffline: true },
  { slug: "duplicate-content-finder", title: "Duplicate Content Finder", description: "Alias của Content Duplication.", category: "migration", requires: [], aliasOf: "content-duplication" },
  { slug: "htaccess-redirect-generator", title: "HTAccess Redirect Generator", description: "Sinh quy tắc Apache .htaccess + Nginx.", category: "migration", requires: [], worksOffline: true },
  { slug: "page-retirement-planner", title: "Page Retirement Planner", description: "Quyết định giữ/xóa/redirect URL.", category: "migration", requires: [], worksOffline: true },
  { slug: "site-search", title: "Site Search Analyzer", description: "Phân tích log search nội bộ.", category: "migration", requires: [], worksOffline: true },
  { slug: "migration-mapper", title: "URL Migration Mapper", description: "Map URL cũ → URL mới theo similarity.", category: "migration", requires: [], worksOffline: true },
  { slug: "url-migration-mapper-2", title: "URL Migration Mapper (v2)", description: "Alias.", category: "migration", requires: [], aliasOf: "migration-mapper" },
  { slug: "woocommerce-category-migration", title: "Woo Category Migration", description: "Map danh mục Woo cũ → mới.", category: "migration", requires: ["woocommerce"] },
  { slug: "competitor-gap", title: "Competitor Gap", description: "So sánh keyword với đối thủ.", category: "migration", requires: [], worksOffline: true },

  // ---------- standalone existing
  { slug: "advanced", title: "SEO Nâng cao", description: "Domain insights tổng hợp.", category: "reporting", requires: ["dataforseo"] },
  { slug: "wayback-extractor", title: "Wayback Extractor", description: "Trích URL từ Wayback Machine.", category: "technical", requires: [] },
];

export function findTool(slug: string): ToolMeta | undefined {
  const entry = TOOL_REGISTRY.find((t) => t.slug === slug);
  if (!entry) return undefined;
  if (entry.aliasOf) {
    const canonical = TOOL_REGISTRY.find((t) => t.slug === entry.aliasOf);
    return canonical ?? entry;
  }
  return entry;
}

export function resolveRequirements(reqs: RequirementKey[] = []): RequirementMeta[] {
  return reqs.map((r) => REQUIREMENTS[r]).filter(Boolean);
}
