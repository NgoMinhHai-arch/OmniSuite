/**
 * Hub SEO — danh mục công cụ sinh từ TOOL_REGISTRY (không nhân đôi metadata).
 * Thêm/sửa tool: chỉ chỉnh `tool-registry.ts`.
 */
import {
  BarChart3,
  Compass,
  Database,
  FileText,
  Link2,
  Search,
  Settings,
  Target,
  type LucideIcon,
} from "lucide-react";
import { TOOL_REGISTRY, type ToolCategory } from "@/lib/seo/tool-registry";

export interface HubTool {
  id: string;
  name: string;
  description: string;
  href: string;
}

export interface HubCategory {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  tools: HubTool[];
}

const CATEGORY_ORDER: ToolCategory[] = [
  "content",
  "keywords",
  "ecommerce",
  "technical",
  "links",
  "reporting",
  "ppc",
  "migration",
];

const CATEGORY_META: Record<
  ToolCategory,
  { id: string; name: string; description: string; icon: LucideIcon; color: string }
> = {
  content: {
    id: "content-analysis",
    name: "Phân tích Nội dung",
    description: "Trích xuất, đánh giá, tối ưu nội dung",
    icon: FileText,
    color: "from-blue-500 to-cyan-500",
  },
  keywords: {
    id: "keyword-research",
    name: "Nghiên cứu Từ khóa",
    description: "Phân tích, clustering, trending",
    icon: Search,
    color: "from-emerald-500 to-teal-500",
  },
  ecommerce: {
    id: "ecommerce",
    name: "Thương mại Điện tử",
    description: "Tối ưu sản phẩm, category",
    icon: Database,
    color: "from-purple-500 to-pink-500",
  },
  technical: {
    id: "technical-seo",
    name: "SEO Kỹ thuật",
    description: "Audit, sitemap, schema, redirects",
    icon: Settings,
    color: "from-orange-500 to-amber-500",
  },
  links: {
    id: "link-building",
    name: "Xây dựng Liên kết",
    description: "Internal, external, citations",
    icon: Link2,
    color: "from-indigo-500 to-violet-500",
  },
  reporting: {
    id: "reporting",
    name: "Báo cáo & Phân tích",
    description: "GSC, traffic, competitors",
    icon: BarChart3,
    color: "from-rose-500 to-red-500",
  },
  ppc: {
    id: "ppc",
    name: "PPC & Paid Search",
    description: "Google Ads, ad copy, keywords",
    icon: Target,
    color: "from-cyan-500 to-blue-500",
  },
  migration: {
    id: "migration",
    name: "Di chuyển & Consolidation",
    description: "Migration, URL mapping, redirects",
    icon: Compass,
    color: "from-gray-500 to-gray-700",
  },
};

/** Công cụ canonical (bỏ alias) nhóm theo category cho hub. */
export function buildHubCategories(): HubCategory[] {
  const byCategory = new Map<ToolCategory, HubTool[]>();

  for (const tool of TOOL_REGISTRY) {
    if (tool.aliasOf) continue;
    const tools = byCategory.get(tool.category) ?? [];
    tools.push({
      id: tool.slug,
      name: tool.title,
      description: tool.description,
      href: `/dashboard/seo-tools/${tool.slug}`,
    });
    byCategory.set(tool.category, tools);
  }

  return CATEGORY_ORDER.map((cat) => ({
    ...CATEGORY_META[cat],
    tools: byCategory.get(cat) ?? [],
  })).filter((c) => c.tools.length > 0);
}
