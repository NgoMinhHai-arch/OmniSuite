"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Globe,
  Zap,
  ExternalLink,
  ArrowRight,
  Database,
  Settings,
  Clock,
  Target,
  BookOpen,
  Link,
  KeyRound,
  Filter,
  Stethoscope,
} from "lucide-react";
import { findTool, REQUIREMENTS, RequirementKey } from "@/lib/seo/tool-registry";
import { buildHubCategories, type HubCategory, type HubTool } from "@/lib/seo/hub-catalog";
import { useSystemKeys } from "@/lib/seo/use-system-keys";

const categories = buildHubCategories();

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
  tool: HubTool;
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
  category: HubCategory;
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
